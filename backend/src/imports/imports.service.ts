import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ApartmentResidentRole,
  ApartmentStatus,
  ImportJobStatus,
  ImportMode,
  ImportRowOperation,
  ImportRowStatus,
  ImportType,
  MeterReadingSource,
  MeterStatus,
  MeterType,
  Prisma,
  ResidentAccountStatus,
  ResidentType,
} from '@prisma/client';
import * as XLSX from 'xlsx';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type { MvpUser } from '../security/mvp-auth.guard';

type AuthUser = {
  id?: string;
  sub?: string;
  role?: string;
  organizationId?: string | null;
};

type ParsedCsv = {
  rows: Array<Record<string, string>>;
  headers: string[];
};

type ImportSummary = {
  totalRows: number;
  validRows: number;
  warningRows: number;
  errorRows: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  errorsCount: number;
  warningsCount: number;
  duplicateRows: number;
  linkedCount?: number;
  primaryContactChanges?: number;
};

type ApartmentImportData = {
  apartmentNumber: string;
  building: string;
  staircase: string;
  floor: number | null;
  floorLabel: string;
  areaM2: number | null;
  cadastralNumber: string;
  status: 'OCCUPIED' | 'VACANT' | 'UNKNOWN';
  apartmentStatus: ApartmentStatus;
  internalNotes: string;
  existingApartmentId?: string | null;
};

type ResidentImportData = {
  fullName: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  apartmentNumber: string;
  apartmentId?: string | null;
  role: ApartmentResidentRole;
  roleLabel: 'OWNER' | 'TENANT' | 'REPRESENTATIVE';
  isPrimaryContact: boolean;
  preferredContactMethod: string;
  status: 'ACTIVE' | 'INVITED' | 'NOT_INVITED' | 'INACTIVE';
  accountStatus: ResidentAccountStatus;
  internalNotes: string;
  existingResidentId?: string | null;
  existingPrimaryContactId?: string | null;
};

type MeterImportData = {
  apartmentNumber: string;
  apartmentId: string;
  building: string;
  staircase: string;
  meterType: MeterType;
  externalMeterType: string;
  meterNumber: string;
  label: string;
  unit: string;
  location: string;
  status: 'ACTIVE' | 'INACTIVE' | 'REPLACED' | 'ARCHIVED';
  prismaStatus: MeterStatus;
  installedAt: string | null;
  notes: string;
  existingMeterId?: string | null;
};

type MeterReadingImportData = {
  apartmentNumber: string;
  apartmentId: string;
  meterType: MeterType;
  externalMeterType: string;
  meterNumber: string;
  meterId?: string | null;
  periodMonth: string;
  readingValue: number;
  previousReadingValue: number | null;
  consumptionValue: number | null;
  unit: string;
  status: 'SUBMITTED' | 'APPROVED' | 'NEEDS_REVIEW';
  source: 'ADMIN' | 'RESIDENT' | 'SYSTEM';
  submittedAt: string;
  adminComment: string;
  residentComment: string;
  existingReadingId?: string | null;
  createMissingMeter?: boolean;
};

type MeterWorkflowMetadata = {
  version?: number;
  meters: Record<string, Record<string, unknown>>;
  readings: Record<string, Record<string, unknown>>;
};

const MAX_IMPORT_ROWS = 5000;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const APARTMENT_METADATA_TITLE = 'Apartment CRM metadata';
const RESIDENT_METADATA_TITLE = 'Resident CRM metadata';
const METER_METADATA_TITLE = 'ESPACE_METER_WORKFLOW_METADATA_V1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function normalizeSearch(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

@Injectable()
export class ImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private userId(user: AuthUser) {
    return user.id || user.sub || '';
  }

  private payload(body: unknown): Record<string, unknown> {
    return isRecord(body) ? body : {};
  }

  private isSuperadmin(user: AuthUser) {
    const role = String(user.role || '').toUpperCase();
    return role === 'SUPERADMIN' || role === 'SUPER_ADMIN';
  }

  private resolveOrganizationId(user: AuthUser, activeOrganizationId?: string, payload?: Record<string, unknown>) {
    if (!this.isSuperadmin(user)) {
      if (!user.organizationId) throw new ForbiddenException('Organization context missing');
      return user.organizationId;
    }
    const requested = this.optionalString(payload?.organizationId) || this.optionalString(activeOrganizationId) || this.optionalString(user.organizationId);
    if (!requested) throw new BadRequestException('Asociația este obligatorie.');
    return requested;
  }

  private assertAdmin(user: AuthUser, activeOrganizationId?: string, payload?: Record<string, unknown>) {
    const role = String(user.role || '').toUpperCase();
    if (!['ADMIN', 'SUPERADMIN', 'SUPER_ADMIN'].includes(role)) throw new ForbiddenException('Admin access required');
    return { organizationId: this.resolveOrganizationId(user, activeOrganizationId, payload), userId: this.userId(user) };
  }

  private async assertOrganizationExists(organizationId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!organization) throw new NotFoundException('Asociația nu a fost găsită.');
  }

  private optionalString(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : '';
  }

  private bool(value: unknown) {
    const normalized = String(value ?? '').trim().toLowerCase();
    return ['true', '1', 'yes', 'y', 'da', 'd'].includes(normalized);
  }

  private parseMode(value: unknown): ImportMode {
    const mode = String(value || ImportMode.CREATE_ONLY).trim().toUpperCase();
    if (mode === ImportMode.UPSERT_SAFE) return ImportMode.UPSERT_SAFE;
    return ImportMode.CREATE_ONLY;
  }

  private parseDelimiter(value: unknown) {
    return String(value || ';').trim() === ',' ? ',' : ';';
  }

  private parsePage(query: Record<string, unknown>) {
    const page = Math.max(1, Number(query.page || 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20) || 20));
    return { page, limit, skip: (page - 1) * limit };
  }

  private buildCsv(columns: string[], rows: string[][]) {
    const escape = (value: unknown) => {
      if (value === null || value === undefined) return '';
      const text = String(value);
      if (/^[=+\-@]/.test(text)) return `'${text}`;
      if (text.includes(';') || text.includes(',') || text.includes('"') || text.includes('\n') || text.includes('\r')) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    };
    return `\uFEFF${[columns, ...rows].map((row) => row.map(escape).join(';')).join('\n')}\n`;
  }

  private sanitizeFileName(value: string) {
    return value.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'import-template.csv';
  }

  templateApartmentsCsv() {
    return {
      fileName: 'espace-template-apartments.csv',
      csv: this.buildCsv(
        ['apartmentNumber', 'building', 'staircase', 'floor', 'areaM2', 'cadastralNumber', 'status', 'internalNotes'],
        [
          ['24', 'A', '1', '5', '67.4', '', 'OCCUPIED', ''],
          ['25', 'A', '1', '5', '52.1', '', 'UNKNOWN', ''],
        ],
      ),
    };
  }

  templateResidentsCsv() {
    return {
      fileName: 'espace-template-residents.csv',
      csv: this.buildCsv(
        ['fullName', 'phone', 'email', 'apartmentNumber', 'role', 'isPrimaryContact', 'preferredContactMethod', 'status', 'internalNotes'],
        [
          ['Ion Popescu', '+37369123456', 'ion@example.com', '24', 'OWNER', 'true', 'PHONE', 'ACTIVE', ''],
          ['Maria Popescu', '+37369222222', '', '24', 'REPRESENTATIVE', 'false', 'PHONE', 'ACTIVE', ''],
          ['Andrei Rusu', '+37369333333', 'andrei@example.com', '25', 'TENANT', 'true', 'WHATSAPP', 'ACTIVE', ''],
        ],
      ),
    };
  }

  templateMetersCsv() {
    return {
      fileName: 'espace-template-meters.csv',
      csv: this.buildCsv(
        ['apartmentNumber', 'building', 'staircase', 'meterType', 'meterNumber', 'label', 'unit', 'location', 'status', 'installedAt', 'notes'],
        [
          ['24', 'A', '1', 'COLD_WATER', 'CW-24-1', 'Apă rece baie', 'm³', 'Baie', 'ACTIVE', '2024-01-10', ''],
          ['24', 'A', '1', 'HOT_WATER', 'HW-24-1', 'Apă caldă baie', 'm³', 'Baie', 'ACTIVE', '2024-01-10', ''],
          ['25', 'A', '1', 'ELECTRICITY', 'EL-25-1', 'Contor electric', 'kWh', 'Hol', 'ACTIVE', '', ''],
        ],
      ),
    };
  }

  templateMeterReadingsCsv() {
    return {
      fileName: 'espace-template-meter-readings.csv',
      csv: this.buildCsv(
        ['apartmentNumber', 'meterType', 'meterNumber', 'periodMonth', 'readingValue', 'previousReadingValue', 'unit', 'status', 'source', 'submittedAt', 'adminComment', 'residentComment'],
        [
          ['24', 'COLD_WATER', 'CW-24-1', '2026-05', '131.2', '124.5', 'm³', 'APPROVED', 'ADMIN', '2026-05-25', 'Indice inițial importat', ''],
          ['24', 'HOT_WATER', 'HW-24-1', '2026-05', '88.4', '84.0', 'm³', 'APPROVED', 'ADMIN', '2026-05-25', '', ''],
          ['25', 'ELECTRICITY', 'EL-25-1', '2026-05', '2400', '2320', 'kWh', 'SUBMITTED', 'ADMIN', '2026-05-25', '', ''],
        ],
      ),
    };
  }

  private validateCsvFile(file: Express.Multer.File | undefined) {
    if (!file?.buffer?.length) throw new BadRequestException('Fișierul CSV este obligatoriu.');
    if (file.buffer.length > MAX_FILE_BYTES) throw new BadRequestException('Fișierul este prea mare. Limita MVP este 5 MB.');
    if (!/\.csv$/i.test(file.originalname || '')) throw new BadRequestException('Încarcă un fișier .csv.');
  }

  private normalizeHeader(value: string) {
    const normalized = value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '');
    const aliases: Record<string, string> = {
      apartment: 'apartmentNumber',
      apartament: 'apartmentNumber',
      apartmentnumber: 'apartmentNumber',
      apartmentnr: 'apartmentNumber',
      nrapartament: 'apartmentNumber',
      numarapartament: 'apartmentNumber',
      building: 'building',
      bloc: 'building',
      corp: 'building',
      staircase: 'staircase',
      scara: 'staircase',
      entrance: 'staircase',
      floor: 'floor',
      etaj: 'floor',
      aream2: 'areaM2',
      suprafata: 'areaM2',
      suprafatam2: 'areaM2',
      cadastralnumber: 'cadastralNumber',
      cadastral: 'cadastralNumber',
      numarcadastral: 'cadastralNumber',
      status: 'status',
      internalnotes: 'internalNotes',
      observatii: 'internalNotes',
      note: 'internalNotes',
      notes: 'internalNotes',
      fullname: 'fullName',
      fullName: 'fullName',
      nume: 'fullName',
      numecomplet: 'fullName',
      phone: 'phone',
      telefon: 'phone',
      email: 'email',
      role: 'role',
      rol: 'role',
      isprimarycontact: 'isPrimaryContact',
      contactprincipal: 'isPrimaryContact',
      primarycontact: 'isPrimaryContact',
      preferredcontactmethod: 'preferredContactMethod',
      metodacontact: 'preferredContactMethod',
      contactpreferat: 'preferredContactMethod',
      metertype: 'meterType',
      tipcontor: 'meterType',
      tip: 'meterType',
      meternumber: 'meterNumber',
      serialnumber: 'meterNumber',
      numarcontor: 'meterNumber',
      seriecontor: 'meterNumber',
      label: 'label',
      eticheta: 'label',
      unit: 'unit',
      unitate: 'unit',
      location: 'location',
      locatie: 'location',
      installedat: 'installedAt',
      datainstalare: 'installedAt',
      periodmonth: 'periodMonth',
      luna: 'periodMonth',
      perioada: 'periodMonth',
      readingvalue: 'readingValue',
      indice: 'readingValue',
      valoareindice: 'readingValue',
      currentreadingvalue: 'readingValue',
      previousreadingvalue: 'previousReadingValue',
      indiceanterior: 'previousReadingValue',
      previousvalue: 'previousReadingValue',
      source: 'source',
      sursa: 'source',
      submittedat: 'submittedAt',
      datasubmitere: 'submittedAt',
      datatrimiterii: 'submittedAt',
      admincomment: 'adminComment',
      comentariuadmin: 'adminComment',
      residentcomment: 'residentComment',
      comentariulocatar: 'residentComment',
    };
    return aliases[normalized] || normalized;
  }

  private parseCsvText(text: string, delimiter: string): ParsedCsv {
    const rows: string[][] = [];
    let current: string[] = [];
    let field = '';
    let inQuotes = false;
    const source = text.replace(/^\uFEFF/, '');
    for (let i = 0; i < source.length; i += 1) {
      const char = source[i];
      const next = source[i + 1];
      if (char === '"') {
        if (inQuotes && next === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        current.push(field);
        field = '';
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && next === '\n') i += 1;
        current.push(field);
        field = '';
        if (current.some((cell) => cell.trim())) rows.push(current);
        current = [];
      } else {
        field += char;
      }
    }
    current.push(field);
    if (current.some((cell) => cell.trim())) rows.push(current);
    if (!rows.length) throw new BadRequestException('Fișierul nu conține rânduri.');
    const headers = rows[0].map((header) => this.normalizeHeader(header.trim()));
    if (!headers.some(Boolean)) throw new BadRequestException('Fișierul nu conține header valid.');
    const dataRows = rows.slice(1).filter((row) => row.some((cell) => cell.trim()));
    if (!dataRows.length) throw new BadRequestException('Fișierul nu conține rânduri valide.');
    if (dataRows.length > MAX_IMPORT_ROWS) throw new BadRequestException('Fișierul conține prea multe rânduri. Limita MVP este 5,000.');
    return {
      headers,
      rows: dataRows.map((row) =>
        headers.reduce<Record<string, string>>((acc, header, index) => {
          if (header) acc[header] = String(row[index] ?? '').trim();
          return acc;
        }, {}),
      ),
    };
  }

  private parseCsvBuffer(file: Express.Multer.File, delimiter: string) {
    this.validateCsvFile(file);
    return this.parseCsvText(file.buffer.toString('utf8'), delimiter);
  }

  private parseDecimal(value: unknown) {
    const raw = String(value ?? '').trim().replace(',', '.');
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : NaN;
  }

  private parseApartmentStatus(value: unknown) {
    const status = String(value || '').trim().toUpperCase();
    if (!status || status === 'UNKNOWN') return { uiStatus: 'UNKNOWN' as const, prismaStatus: ApartmentStatus.ACTIVE };
    if (status === 'OCCUPIED') return { uiStatus: 'OCCUPIED' as const, prismaStatus: ApartmentStatus.OCCUPIED };
    if (status === 'VACANT') return { uiStatus: 'VACANT' as const, prismaStatus: ApartmentStatus.EMPTY };
    return null;
  }

  private parseResidentRole(value: unknown, fallback: unknown) {
    const role = String(value || fallback || 'OWNER').trim().toUpperCase();
    if (role === 'OWNER') return ApartmentResidentRole.OWNER;
    if (role === 'TENANT') return ApartmentResidentRole.TENANT;
    if (role === 'REPRESENTATIVE') return ApartmentResidentRole.REPRESENTATIVE;
    return null;
  }

  private roleLabel(role: ApartmentResidentRole): 'OWNER' | 'TENANT' | 'REPRESENTATIVE' {
    if (role === ApartmentResidentRole.TENANT) return 'TENANT';
    if (role === ApartmentResidentRole.REPRESENTATIVE) return 'REPRESENTATIVE';
    return 'OWNER';
  }

  private parsePreferredContactMethod(value: unknown) {
    const method = String(value || 'PHONE').trim().toUpperCase();
    return ['PHONE', 'EMAIL', 'APP', 'WHATSAPP', 'TELEGRAM'].includes(method) ? method : null;
  }

  private parseResidentStatus(value: unknown, fallback: unknown) {
    const status = String(value || fallback || 'ACTIVE').trim().toUpperCase();
    if (['ACTIVE', 'INVITED', 'NOT_INVITED', 'INACTIVE'].includes(status)) return status as ResidentImportData['status'];
    return null;
  }

  private accountStatusFromImport(status: ResidentImportData['status']) {
    if (status === 'ACTIVE') return ResidentAccountStatus.CREATED;
    if (status === 'INVITED') return ResidentAccountStatus.INVITED;
    return ResidentAccountStatus.NO_ACCOUNT;
  }

  private parseMeterType(value: unknown) {
    const raw = String(value || '').trim().toUpperCase();
    if (!raw) return null;
    const mapped = raw === 'HEAT' ? 'HEATING' : raw;
    const allowed = Object.values(MeterType) as string[];
    if (!allowed.includes(mapped)) return null;
    return {
      prismaType: mapped as MeterType,
      externalType: mapped === 'HEATING' ? 'HEAT' : mapped,
    };
  }

  private defaultMeterUnit(type: MeterType | string | null | undefined) {
    const normalized = String(type || '').toUpperCase();
    if (normalized === 'ELECTRICITY') return 'kWh';
    if (normalized === 'HEATING' || normalized === 'HEAT') return 'Gcal';
    if (normalized === 'OTHER') return 'unit';
    return 'm³';
  }

  private parseMeterStatus(value: unknown) {
    const status = String(value || 'ACTIVE').trim().toUpperCase();
    if (status === 'ACTIVE') return { status: 'ACTIVE' as const, prismaStatus: MeterStatus.ACTIVE };
    if (status === 'INACTIVE') return { status: 'INACTIVE' as const, prismaStatus: MeterStatus.INACTIVE };
    if (status === 'REPLACED') return { status: 'REPLACED' as const, prismaStatus: MeterStatus.INACTIVE };
    if (status === 'ARCHIVED') return { status: 'ARCHIVED' as const, prismaStatus: MeterStatus.INACTIVE };
    return null;
  }

  private parseReadingStatus(value: unknown, fallback: unknown): MeterReadingImportData['status'] | null {
    const status = String(value || fallback || 'APPROVED').trim().toUpperCase();
    if (status === 'APPROVED' || status === 'SUBMITTED' || status === 'NEEDS_REVIEW') return status;
    return null;
  }

  private parseReadingSource(value: unknown): MeterReadingImportData['source'] | null {
    const source = String(value || 'ADMIN').trim().toUpperCase();
    if (source === 'ADMIN' || source === 'RESIDENT' || source === 'SYSTEM') return source;
    return null;
  }

  private parsePeriodMonth(value: unknown) {
    const raw = String(value || '').trim();
    if (!/^\d{4}-\d{2}$/.test(raw)) return null;
    const month = Number(raw.slice(5, 7));
    return month >= 1 && month <= 12 ? raw : null;
  }

  private dateFromPeriodMonth(periodMonth: string) {
    return new Date(`${periodMonth}-01T12:00:00.000Z`);
  }

  private periodMonth(value: Date | string) {
    const date = value instanceof Date ? value : new Date(value);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  private parseDateIso(value: unknown) {
    const raw = String(value || '').trim();
    if (!raw) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined;
    const date = new Date(`${raw}T12:00:00.000Z`);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }

  private round(value: number) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  }

  private residentTypeFromRole(role: ApartmentResidentRole) {
    if (role === ApartmentResidentRole.TENANT) return ResidentType.TENANT;
    if (role === ApartmentResidentRole.OWNER) return ResidentType.OWNER;
    return ResidentType.RESIDENT;
  }

  private splitFullName(fullName: string) {
    const parts = fullName.trim().replace(/\s+/g, ' ').split(' ');
    const firstName = parts.shift() || '';
    return { firstName, lastName: parts.join(' ') };
  }

  private isEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  private normalizePhone(value: unknown) {
    return String(value || '').trim().replace(/\s+/g, ' ');
  }

  private rowStatus(errors: string[], warnings: string[]): ImportRowStatus {
    if (errors.length) return ImportRowStatus.ERROR;
    if (warnings.length) return ImportRowStatus.WARNING;
    return ImportRowStatus.VALID;
  }

  private importJobSelect(): Prisma.ImportJobSelect {
    return {
      id: true,
      organizationId: true,
      type: true,
      mode: true,
      fileName: true,
      status: true,
      delimiter: true,
      totalRows: true,
      validRows: true,
      invalidRows: true,
      warningRows: true,
      errorRows: true,
      createdCount: true,
      updatedCount: true,
      skippedCount: true,
      errorsCount: true,
      warningsCount: true,
      options: true,
      summary: true,
      startedAt: true,
      completedAt: true,
      cancelledAt: true,
      createdAt: true,
      updatedAt: true,
      createdBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    };
  }

  private toImportJobResponse(job: any) {
    return {
      id: job.id,
      organizationId: job.organizationId,
      importType: job.type,
      type: job.type,
      mode: job.mode,
      fileName: job.fileName,
      status: job.status,
      delimiter: job.delimiter,
      totalRows: job.totalRows,
      validRows: job.validRows,
      warningRows: job.warningRows,
      errorRows: job.errorRows ?? job.invalidRows ?? 0,
      invalidRows: job.invalidRows ?? job.errorRows ?? 0,
      createdCount: job.createdCount,
      updatedCount: job.updatedCount,
      skippedCount: job.skippedCount,
      errorsCount: job.errorsCount,
      warningsCount: job.warningsCount,
      options: job.options || {},
      summary: job.summary || {},
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      cancelledAt: job.cancelledAt,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      actor: job.createdBy
        ? {
            id: job.createdBy.id,
            fullName: `${job.createdBy.firstName || ''} ${job.createdBy.lastName || ''}`.trim() || job.createdBy.email,
            email: job.createdBy.email,
          }
        : null,
    };
  }

  private toImportRowResponse(row: any) {
    return {
      id: row.id,
      rowNumber: row.rowNumber,
      status: row.status,
      operation: row.operation,
      rawData: row.rawData || {},
      normalizedData: row.normalizedData || {},
      errors: row.errors || [],
      warnings: row.warnings || [],
      createdEntityId: row.createdEntityId,
      updatedEntityId: row.updatedEntityId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private summaryFromRows(rows: Array<{ status: ImportRowStatus; operation: ImportRowOperation; errors: string[]; warnings: string[] }>): ImportSummary {
    return {
      totalRows: rows.length,
      validRows: rows.filter((row) => row.status === ImportRowStatus.VALID || row.status === ImportRowStatus.WARNING).length,
      warningRows: rows.filter((row) => row.status === ImportRowStatus.WARNING).length,
      errorRows: rows.filter((row) => row.status === ImportRowStatus.ERROR).length,
      createdCount: rows.filter((row) => row.operation === ImportRowOperation.CREATE).length,
      updatedCount: rows.filter((row) => row.operation === ImportRowOperation.UPDATE).length,
      skippedCount: rows.filter((row) => row.operation === ImportRowOperation.SKIP).length,
      errorsCount: rows.reduce((sum, row) => sum + row.errors.length, 0),
      warningsCount: rows.reduce((sum, row) => sum + row.warnings.length, 0),
      duplicateRows: rows.filter((row) => [...row.errors, ...row.warnings].some((message) => message.toLowerCase().includes('duplic'))).length,
      linkedCount: rows.filter((row) => row.operation === ImportRowOperation.LINK).length,
      primaryContactChanges: 0,
    };
  }

  private async createPreviewJob(input: {
    organizationId: string;
    userId: string;
    type: ImportType;
    mode: ImportMode;
    delimiter: string;
    fileName: string;
    options: Record<string, unknown>;
    rows: Array<{
      rowNumber: number;
      status: ImportRowStatus;
      operation: ImportRowOperation;
      rawData: Record<string, unknown>;
      normalizedData: Record<string, unknown> | null;
      errors: string[];
      warnings: string[];
    }>;
  }) {
    const summary = this.summaryFromRows(input.rows);
    const job = await this.prisma.importJob.create({
      data: {
        organizationId: input.organizationId,
        type: input.type,
        mode: input.mode,
        fileName: this.sanitizeFileName(input.fileName || `${input.type.toLowerCase()}-import.csv`),
        status: ImportJobStatus.VALIDATED,
        delimiter: input.delimiter,
        totalRows: summary.totalRows,
        validRows: summary.validRows,
        invalidRows: summary.errorRows,
        warningRows: summary.warningRows,
        errorRows: summary.errorRows,
        createdCount: summary.createdCount,
        updatedCount: summary.updatedCount,
        skippedCount: summary.skippedCount,
        errorsCount: summary.errorsCount,
        warningsCount: summary.warningsCount,
        options: input.options as Prisma.InputJsonValue,
        summary: summary as unknown as Prisma.InputJsonValue,
        errorsJson: { summary, rows: input.rows.slice(0, 100) } as Prisma.InputJsonValue,
        createdByUserId: input.userId,
        rows: {
          create: input.rows.map((row) => ({
            organizationId: input.organizationId,
            rowNumber: row.rowNumber,
            status: row.status,
            operation: row.operation,
            rawData: row.rawData as Prisma.InputJsonValue,
            normalizedData: (row.normalizedData || {}) as Prisma.InputJsonValue,
            errors: row.errors as Prisma.InputJsonValue,
            warnings: row.warnings as Prisma.InputJsonValue,
          })),
        },
      },
      select: this.importJobSelect(),
    });
    await this.auditImport(input.organizationId, input.userId, 'IMPORT_PREVIEW_CREATED', 'Previzualizare import creată', {
      importType: input.type,
      mode: input.mode,
      totalRows: summary.totalRows,
      errorsCount: summary.errorsCount,
      warningsCount: summary.warningsCount,
    });
    return this.importJobWithRows(job.id, input.organizationId, 50);
  }

  async listAdmin(user: AuthUser, query: Record<string, unknown> = {}, activeOrganizationId?: string) {
    const { organizationId } = this.assertAdmin(user, activeOrganizationId, this.payload(query));
    const { page, limit, skip } = this.parsePage(query);
    const where: Prisma.ImportJobWhereInput = { organizationId };
    const importType = String(query.importType || query.type || '').trim().toUpperCase();
    const status = String(query.status || '').trim().toUpperCase();
    if (importType && importType !== 'ALL') where.type = importType as ImportType;
    if (status && status !== 'ALL') where.status = status as ImportJobStatus;
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.gte = new Date(String(query.dateFrom));
      if (query.dateTo) where.createdAt.lte = new Date(String(query.dateTo));
    }
    const [items, total] = await Promise.all([
      this.prisma.importJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: this.importJobSelect(),
      }),
      this.prisma.importJob.count({ where }),
    ]);
    return {
      items: items.map((job) => this.toImportJobResponse(job)),
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  async getImportJob(user: AuthUser, id: string, activeOrganizationId?: string) {
    const { organizationId } = this.assertAdmin(user, activeOrganizationId);
    return this.importJobWithRows(id, organizationId, 100);
  }

  async previewAdmin(user: AuthUser, id: string, activeOrganizationId?: string) {
    const detail = await this.getImportJob(user, id, activeOrganizationId);
    return {
      ...detail.importJob,
      previewRows: detail.previewRows,
      errorsJson: { rows: detail.previewRows, summary: detail.summary },
      summary: detail.summary,
    };
  }

  private async importJobWithRows(id: string, organizationId: string, take: number) {
    const job = await this.prisma.importJob.findFirst({
      where: { id, organizationId },
      select: this.importJobSelect(),
    });
    if (!job) throw new NotFoundException('Importul nu a fost găsit.');
    const rows = await this.prisma.importRow.findMany({
      where: { importJobId: id, organizationId },
      orderBy: { rowNumber: 'asc' },
      take,
    });
    return {
      importJob: this.toImportJobResponse(job),
      summary: job.summary || {},
      previewRows: rows.map((row) => this.toImportRowResponse(row)),
    };
  }

  async getImportRows(user: AuthUser, id: string, query: Record<string, unknown>, activeOrganizationId?: string) {
    const { organizationId } = this.assertAdmin(user, activeOrganizationId);
    const job = await this.prisma.importJob.findFirst({ where: { id, organizationId }, select: { id: true } });
    if (!job) throw new NotFoundException('Importul nu a fost găsit.');
    const { page, limit, skip } = this.parsePage(query);
    const where: Prisma.ImportRowWhereInput = { importJobId: id, organizationId };
    const status = String(query.status || '').trim().toUpperCase();
    const operation = String(query.operation || '').trim().toUpperCase();
    if (status && status !== 'ALL') where.status = status as ImportRowStatus;
    if (operation && operation !== 'ALL') where.operation = operation as ImportRowOperation;
    const [rows, total] = await Promise.all([
      this.prisma.importRow.findMany({ where, orderBy: { rowNumber: 'asc' }, skip, take: limit }),
      this.prisma.importRow.count({ where }),
    ]);
    return {
      items: rows.map((row) => this.toImportRowResponse(row)),
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  async cancelImport(user: AuthUser, id: string, activeOrganizationId?: string) {
    const { organizationId, userId } = this.assertAdmin(user, activeOrganizationId);
    const job = await this.prisma.importJob.findFirst({ where: { id, organizationId }, select: { id: true, status: true, type: true } });
    if (!job) throw new NotFoundException('Importul nu a fost găsit.');
    if (job.status === ImportJobStatus.COMPLETED || job.status === ImportJobStatus.IMPORTED) {
      throw new BadRequestException('Importul finalizat nu poate fi anulat.');
    }
    const updated = await this.prisma.importJob.update({
      where: { id },
      data: { status: ImportJobStatus.CANCELLED, cancelledAt: new Date() },
      select: this.importJobSelect(),
    });
    await this.auditImport(organizationId, userId, 'IMPORT_CANCELLED', 'Import anulat', { importType: job.type, importJobId: id });
    return { importJob: this.toImportJobResponse(updated) };
  }

  async previewApartmentsCsv(user: AuthUser, body: unknown, file: Express.Multer.File | undefined, activeOrganizationId?: string) {
    const payload = this.payload(body);
    const { organizationId, userId } = this.assertAdmin(user, activeOrganizationId, payload);
    await this.assertOrganizationExists(organizationId);
    const mode = this.parseMode(payload.mode);
    const delimiter = this.parseDelimiter(payload.delimiter);
    const parsed = this.parseCsvBuffer(file, delimiter);
    const existing = await this.prisma.apartment.findMany({
      where: { organizationId },
      select: { id: true, number: true },
    });
    const existingByNumber = new Map(existing.map((apartment) => [apartment.number.trim().toLowerCase(), apartment.id]));
    const seen = new Map<string, number>();
    const rows = parsed.rows.map((row, index) => {
      const rowNumber = index + 2;
      const warnings: string[] = [];
      const errors: string[] = [];
      const apartmentNumber = String(row.apartmentNumber || '').trim();
      const key = apartmentNumber.toLowerCase();
      if (!apartmentNumber) errors.push('apartmentNumber este obligatoriu.');
      if (key) {
        if (seen.has(key)) errors.push(`apartmentNumber duplicat în fișier. Primul rând: ${seen.get(key)}.`);
        else seen.set(key, rowNumber);
      }
      const areaM2 = this.parseDecimal(row.areaM2);
      if (Number.isNaN(areaM2)) errors.push('areaM2 trebuie să fie număr pozitiv.');
      if (areaM2 !== null && !Number.isNaN(areaM2) && areaM2 <= 0) errors.push('areaM2 trebuie să fie mai mare decât 0.');
      if (areaM2 === null) warnings.push('Suprafața lipsește.');
      const rawFloor = String(row.floor || '').trim();
      const floorNumber = rawFloor ? Number(rawFloor) : null;
      const floor = floorNumber !== null && Number.isFinite(floorNumber) ? Math.trunc(floorNumber) : null;
      if (rawFloor && floor === null) warnings.push('Etajul nu este numeric și va fi lăsat necompletat.');
      const statusParsed = this.parseApartmentStatus(row.status);
      if (!statusParsed) errors.push('status trebuie să fie OCCUPIED, VACANT sau UNKNOWN.');
      if (!String(row.status || '').trim()) warnings.push('Status lipsă, se va folosi UNKNOWN.');
      const staircase = String(row.staircase || '').trim();
      if (!staircase) warnings.push('Scara lipsește, se va folosi „Fără scară”.');
      if (!String(row.cadastralNumber || '').trim()) warnings.push('Numărul cadastral lipsește.');
      const existingApartmentId = key ? existingByNumber.get(key) || null : null;
      let operation: ImportRowOperation = ImportRowOperation.CREATE;
      if (existingApartmentId && mode === ImportMode.CREATE_ONLY) {
        errors.push('Apartamentul există deja în asociație. Folosește UPSERT_SAFE pentru actualizare controlată.');
        operation = ImportRowOperation.NONE;
      } else if (existingApartmentId) {
        operation = ImportRowOperation.UPDATE;
      }
      const normalized: ApartmentImportData | null = apartmentNumber && statusParsed
        ? {
            apartmentNumber,
            building: String(row.building || '').trim() || 'Bloc principal',
            staircase: staircase || 'Fără scară',
            floor,
            floorLabel: rawFloor,
            areaM2: areaM2 === null || Number.isNaN(areaM2) ? null : Number(areaM2),
            cadastralNumber: String(row.cadastralNumber || '').trim(),
            status: statusParsed.uiStatus,
            apartmentStatus: statusParsed.prismaStatus,
            internalNotes: String(row.internalNotes || '').trim(),
            existingApartmentId,
          }
        : null;
      return {
        rowNumber,
        status: this.rowStatus(errors, warnings),
        operation,
        rawData: row,
        normalizedData: normalized as unknown as Record<string, unknown> | null,
        errors,
        warnings,
      };
    });
    return this.createPreviewJob({
      organizationId,
      userId,
      type: ImportType.APARTMENTS,
      mode,
      delimiter,
      fileName: file?.originalname || 'apartments.csv',
      options: { mode, delimiter },
      rows,
    });
  }

  async previewResidentsCsv(user: AuthUser, body: unknown, file: Express.Multer.File | undefined, activeOrganizationId?: string) {
    const payload = this.payload(body);
    const { organizationId, userId } = this.assertAdmin(user, activeOrganizationId, payload);
    await this.assertOrganizationExists(organizationId);
    const mode = this.parseMode(payload.mode);
    const delimiter = this.parseDelimiter(payload.delimiter);
    const primaryContactStrategy = String(payload.primaryContactStrategy || 'KEEP_FIRST').trim().toUpperCase();
    const defaultRole = String(payload.defaultRole || 'OWNER').trim().toUpperCase();
    const defaultStatus = String(payload.defaultStatus || 'ACTIVE').trim().toUpperCase();
    if (!['KEEP_FIRST', 'LAST_WINS', 'ERROR'].includes(primaryContactStrategy)) throw new BadRequestException('Strategia de contact principal nu este validă.');
    const parsed = this.parseCsvBuffer(file, delimiter);
    const [apartments, residents] = await Promise.all([
      this.prisma.apartment.findMany({
        where: { organizationId },
        select: {
          id: true,
          number: true,
          apartmentResidents: {
            where: { isPrimary: true },
            select: { residentId: true },
          },
        },
      }),
      this.prisma.residentProfile.findMany({
        where: { organizationId },
        select: { id: true, firstName: true, lastName: true, phone: true, email: true },
      }),
    ]);
    const apartmentsByNumber = new Map(apartments.map((apartment) => [apartment.number.trim().toLowerCase(), apartment]));
    const residentsByEmail = new Map(residents.filter((resident) => resident.email).map((resident) => [String(resident.email).toLowerCase(), resident.id]));
    const residentsByPhone = new Map(residents.filter((resident) => resident.phone).map((resident) => [String(resident.phone).trim(), resident.id]));
    const duplicateKeys = new Map<string, number>();
    const primaryRowsByApartment = new Map<string, number[]>();
    const rows = parsed.rows.map((row, index) => {
      const rowNumber = index + 2;
      const warnings: string[] = [];
      const errors: string[] = [];
      const fullName = String(row.fullName || '').trim().replace(/\s+/g, ' ');
      if (!fullName) errors.push('fullName este obligatoriu.');
      const email = String(row.email || '').trim().toLowerCase();
      const phone = this.normalizePhone(row.phone);
      if (email && !this.isEmail(email)) errors.push('Emailul nu este valid.');
      if (!phone && !email) warnings.push('Persoana nu are telefon sau email.');
      const role = this.parseResidentRole(row.role, defaultRole);
      if (!role) errors.push('role trebuie să fie OWNER, TENANT sau REPRESENTATIVE.');
      if (!String(row.role || '').trim()) warnings.push(`Rol lipsă, se va folosi ${defaultRole || 'OWNER'}.`);
      const method = this.parsePreferredContactMethod(row.preferredContactMethod);
      if (!method) errors.push('preferredContactMethod nu este valid.');
      const status = this.parseResidentStatus(row.status, defaultStatus);
      if (!status) errors.push('status trebuie să fie ACTIVE, INVITED, NOT_INVITED sau INACTIVE.');
      const apartmentNumber = String(row.apartmentNumber || '').trim();
      if (!apartmentNumber) warnings.push('Persoana nu are apartament.');
      const apartment = apartmentNumber ? apartmentsByNumber.get(apartmentNumber.toLowerCase()) : null;
      if (apartmentNumber && !apartment) warnings.push('Apartamentul nu există. Persoana va fi importată fără legătură la apartament.');
      const isPrimaryContact = this.bool(row.isPrimaryContact);
      if (apartment?.apartmentResidents?.length && isPrimaryContact) warnings.push('Apartamentul are deja contact principal. Noul contact îl va înlocui la confirmare.');
      const duplicateCandidates = [
        email ? `email:${email}` : '',
        phone && fullName ? `phone-name:${phone}:${fullName.toLowerCase()}` : '',
        fullName && apartmentNumber && role ? `relation:${fullName.toLowerCase()}:${apartmentNumber.toLowerCase()}:${role}` : '',
      ].filter(Boolean);
      duplicateCandidates.forEach((key) => {
        const firstRow = duplicateKeys.get(key);
        if (firstRow) errors.push(`Duplicat evident în fișier. Primul rând: ${firstRow}.`);
        else duplicateKeys.set(key, rowNumber);
      });
      const existingResidentId = email ? residentsByEmail.get(email) || null : phone ? residentsByPhone.get(phone) || null : null;
      let operation: ImportRowOperation = ImportRowOperation.CREATE;
      if (existingResidentId && mode === ImportMode.CREATE_ONLY) {
        warnings.push('Persoana pare să existe deja. Rândul va fi ignorat în CREATE_ONLY.');
        operation = ImportRowOperation.SKIP;
      } else if (existingResidentId) {
        operation = ImportRowOperation.UPDATE;
      } else if (apartment) {
        operation = ImportRowOperation.CREATE;
      }
      if (isPrimaryContact && apartmentNumber) {
        const key = apartmentNumber.toLowerCase();
        primaryRowsByApartment.set(key, [...(primaryRowsByApartment.get(key) || []), rowNumber]);
      }
      const name = this.splitFullName(fullName);
      const normalized: ResidentImportData | null = fullName && role && method && status
        ? {
            fullName,
            firstName: name.firstName,
            lastName: name.lastName,
            phone,
            email,
            apartmentNumber,
            apartmentId: apartment?.id || null,
            role,
            roleLabel: this.roleLabel(role),
            isPrimaryContact,
            preferredContactMethod: method,
            status,
            accountStatus: this.accountStatusFromImport(status),
            internalNotes: String(row.internalNotes || '').trim(),
            existingResidentId,
            existingPrimaryContactId: apartment?.apartmentResidents?.[0]?.residentId || null,
          }
        : null;
      return {
        rowNumber,
        status: this.rowStatus(errors, warnings),
        operation,
        rawData: row,
        normalizedData: normalized as unknown as Record<string, unknown> | null,
        errors,
        warnings,
      };
    });
    for (const [apartmentNumber, rowNumbers] of primaryRowsByApartment.entries()) {
      if (rowNumbers.length <= 1) continue;
      rows.forEach((row) => {
        const normalized = row.normalizedData as unknown as ResidentImportData | null;
        if (!normalized || normalized.apartmentNumber.toLowerCase() !== apartmentNumber || !normalized.isPrimaryContact) return;
        if (primaryContactStrategy === 'ERROR') {
          row.errors.push('Există mai mulți primary contact pentru același apartament.');
          row.status = ImportRowStatus.ERROR;
          return;
        }
        if (primaryContactStrategy === 'KEEP_FIRST' && row.rowNumber !== rowNumbers[0]) {
          normalized.isPrimaryContact = false;
          row.warnings.push(`Contact principal duplicat. Se păstrează primul rând (${rowNumbers[0]}).`);
        }
        if (primaryContactStrategy === 'LAST_WINS' && row.rowNumber !== rowNumbers[rowNumbers.length - 1]) {
          normalized.isPrimaryContact = false;
          row.warnings.push(`Contact principal duplicat. Se păstrează ultimul rând (${rowNumbers[rowNumbers.length - 1]}).`);
        }
        row.status = this.rowStatus(row.errors, row.warnings);
      });
    }
    return this.createPreviewJob({
      organizationId,
      userId,
      type: ImportType.RESIDENTS,
      mode,
      delimiter,
      fileName: file?.originalname || 'residents.csv',
      options: { mode, delimiter, primaryContactStrategy, defaultRole, defaultStatus },
      rows,
    });
  }

  async previewMetersCsv(user: AuthUser, body: unknown, file: Express.Multer.File | undefined, activeOrganizationId?: string) {
    const payload = this.payload(body);
    const { organizationId, userId } = this.assertAdmin(user, activeOrganizationId, payload);
    await this.assertOrganizationExists(organizationId);
    const mode = this.parseMode(payload.mode);
    const delimiter = this.parseDelimiter(payload.delimiter);
    const parsed = this.parseCsvBuffer(file, delimiter);
    const [apartments, meters, store] = await Promise.all([
      this.prisma.apartment.findMany({
        where: { organizationId },
        select: {
          id: true,
          number: true,
          staircase: { select: { name: true } },
          building: { select: { name: true } },
        },
      }),
      this.prisma.meter.findMany({
        where: { organizationId },
        select: { id: true, apartmentId: true, type: true, serialNumber: true, status: true },
      }),
      this.loadMeterWorkflowMetadata(organizationId),
    ]);
    const apartmentsByNumber = new Map(apartments.map((apartment) => [apartment.number.trim().toLowerCase(), apartment]));
    const metersBySerial = new Map(meters.filter((meter) => meter.serialNumber).map((meter) => [String(meter.serialNumber).trim().toLowerCase(), meter]));
    const metersByApartmentTypeSerial = new Map(
      meters.map((meter) => [`${meter.apartmentId}:${meter.type}:${String(meter.serialNumber || '').trim().toLowerCase()}`, meter]),
    );
    const seen = new Map<string, number>();
    const rows = parsed.rows.map((row, index) => {
      const rowNumber = index + 2;
      const warnings: string[] = [];
      const errors: string[] = [];
      const apartmentNumber = String(row.apartmentNumber || '').trim();
      if (!apartmentNumber) errors.push('apartmentNumber este obligatoriu.');
      const apartment = apartmentNumber ? apartmentsByNumber.get(apartmentNumber.toLowerCase()) : null;
      if (apartmentNumber && !apartment) errors.push('Apartamentul nu există în asociația curentă.');
      const meterType = this.parseMeterType(row.meterType);
      if (!meterType) errors.push('meterType trebuie să fie COLD_WATER, HOT_WATER, ELECTRICITY, GAS, HEAT sau OTHER.');
      const meterNumber = String(row.meterNumber || '').trim();
      if (!meterNumber) warnings.push('meterNumber lipsește.');
      const unit = String(row.unit || '').trim() || (meterType ? this.defaultMeterUnit(meterType.prismaType) : '');
      if (!String(row.unit || '').trim()) warnings.push('unit lipsește, se va completa automat.');
      const status = this.parseMeterStatus(row.status);
      if (!status) errors.push('status trebuie să fie ACTIVE, INACTIVE, REPLACED sau ARCHIVED.');
      if (!String(row.status || '').trim()) warnings.push('Status lipsă, se va folosi ACTIVE.');
      const installedAt = this.parseDateIso(row.installedAt);
      if (installedAt === undefined) errors.push('installedAt trebuie să fie dată validă în format YYYY-MM-DD.');
      if (installedAt === null) warnings.push('installedAt lipsește.');
      if (apartment && row.staircase && String(row.staircase).trim() !== String(apartment.staircase?.name || '').trim()) {
        warnings.push('Scara din CSV nu coincide cu scara apartamentului existent.');
      }
      if (apartment && row.building && String(row.building).trim() !== String(apartment.building?.name || '').trim()) {
        warnings.push('Blocul din CSV nu coincide cu blocul apartamentului existent.');
      }
      let existingMeterId: string | null = null;
      if (meterType && apartment) {
        const fileKey = `${apartmentNumber.toLowerCase()}:${meterType.prismaType}:${meterNumber.toLowerCase()}`;
        const firstRow = seen.get(fileKey);
        if (firstRow) errors.push(`Contor duplicat în fișier. Primul rând: ${firstRow}.`);
        else seen.set(fileKey, rowNumber);
        const sameSerial = meterNumber ? metersBySerial.get(meterNumber.toLowerCase()) : null;
        if (sameSerial) {
          if (sameSerial.apartmentId !== apartment.id) errors.push('meterNumber există deja în aceeași asociație pentru alt apartament.');
          existingMeterId = sameSerial.id;
        }
        const sameApartmentMeter = metersByApartmentTypeSerial.get(`${apartment.id}:${meterType.prismaType}:${meterNumber.toLowerCase()}`);
        if (sameApartmentMeter) existingMeterId = sameApartmentMeter.id;
        if (!existingMeterId) {
          const similar = meters.find((meter) => meter.apartmentId === apartment.id && meter.type === meterType.prismaType);
          if (similar) warnings.push('Există deja un contor similar pentru acest apartament și tip.');
        }
      }
      let operation: ImportRowOperation = ImportRowOperation.CREATE;
      if (existingMeterId && mode === ImportMode.CREATE_ONLY) {
        errors.push('Contorul există deja. Folosește UPSERT_SAFE pentru actualizare controlată.');
        operation = ImportRowOperation.NONE;
      } else if (existingMeterId) {
        operation = ImportRowOperation.UPDATE;
      }
      const normalized: MeterImportData | null = apartment && meterType && status
        ? {
            apartmentNumber,
            apartmentId: apartment.id,
            building: String(row.building || apartment.building?.name || '').trim(),
            staircase: String(row.staircase || apartment.staircase?.name || '').trim(),
            meterType: meterType.prismaType,
            externalMeterType: meterType.externalType,
            meterNumber,
            label: String(row.label || '').trim(),
            unit,
            location: String(row.location || '').trim(),
            status: status.status,
            prismaStatus: status.prismaStatus,
            installedAt: installedAt || null,
            notes: String(row.notes || '').trim(),
            existingMeterId,
          }
        : null;
      return {
        rowNumber,
        status: this.rowStatus(errors, warnings),
        operation,
        rawData: row,
        normalizedData: normalized as unknown as Record<string, unknown> | null,
        errors,
        warnings,
      };
    });
    return this.createPreviewJob({
      organizationId,
      userId,
      type: ImportType.METERS,
      mode,
      delimiter,
      fileName: file?.originalname || 'meters.csv',
      options: { mode, delimiter },
      rows,
    });
  }

  async previewMeterReadingsCsv(user: AuthUser, body: unknown, file: Express.Multer.File | undefined, activeOrganizationId?: string) {
    const payload = this.payload(body);
    const { organizationId, userId } = this.assertAdmin(user, activeOrganizationId, payload);
    await this.assertOrganizationExists(organizationId);
    const mode = this.parseMode(payload.mode);
    const delimiter = this.parseDelimiter(payload.delimiter);
    const defaultStatus = String(payload.defaultStatus || 'APPROVED').trim().toUpperCase();
    const duplicateApprovedPolicy = String(payload.duplicateApprovedPolicy || 'ERROR').trim().toUpperCase();
    const lowerThanPreviousPolicy = String(payload.lowerThanPreviousPolicy || 'MARK_NEEDS_REVIEW').trim().toUpperCase();
    const createMissingMeters = this.bool(payload.createMissingMeters);
    if (!['APPROVED', 'SUBMITTED', 'NEEDS_REVIEW'].includes(defaultStatus)) throw new BadRequestException('defaultStatus nu este valid.');
    if (!['ERROR', 'SKIP', 'UPDATE_ONLY_IF_NOT_FINAL'].includes(duplicateApprovedPolicy)) throw new BadRequestException('duplicateApprovedPolicy nu este valid.');
    if (!['ERROR', 'MARK_NEEDS_REVIEW'].includes(lowerThanPreviousPolicy)) throw new BadRequestException('lowerThanPreviousPolicy nu este valid.');
    const parsed = this.parseCsvBuffer(file, delimiter);
    const [apartments, meters, readings, store] = await Promise.all([
      this.prisma.apartment.findMany({
        where: { organizationId },
        select: { id: true, number: true },
      }),
      this.prisma.meter.findMany({
        where: { organizationId },
        select: { id: true, apartmentId: true, type: true, serialNumber: true, status: true },
      }),
      this.prisma.meterReading.findMany({
        where: { organizationId },
        orderBy: [{ readingDate: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, meterId: true, apartmentId: true, organizationId: true, value: true, readingDate: true, source: true },
      }),
      this.loadMeterWorkflowMetadata(organizationId),
    ]);
    const apartmentsByNumber = new Map(apartments.map((apartment) => [apartment.number.trim().toLowerCase(), apartment]));
    const metersByApartment = new Map<string, typeof meters>();
    for (const meter of meters) {
      metersByApartment.set(meter.apartmentId, [...(metersByApartment.get(meter.apartmentId) || []), meter]);
    }
    const readingsByMeter = new Map<string, typeof readings>();
    for (const reading of readings) {
      readingsByMeter.set(reading.meterId, [...(readingsByMeter.get(reading.meterId) || []), reading]);
    }
    const seen = new Map<string, number>();
    const rows = parsed.rows.map((row, index) => {
      const rowNumber = index + 2;
      const warnings: string[] = [];
      const errors: string[] = [];
      const apartmentNumber = String(row.apartmentNumber || '').trim();
      if (!apartmentNumber) errors.push('apartmentNumber este obligatoriu.');
      const apartment = apartmentNumber ? apartmentsByNumber.get(apartmentNumber.toLowerCase()) : null;
      if (apartmentNumber && !apartment) errors.push('Apartamentul nu există în asociația curentă.');
      const meterType = this.parseMeterType(row.meterType);
      if (!meterType) errors.push('meterType trebuie să fie COLD_WATER, HOT_WATER, ELECTRICITY, GAS, HEAT sau OTHER.');
      const meterNumber = String(row.meterNumber || '').trim();
      const periodMonth = this.parsePeriodMonth(row.periodMonth);
      if (!periodMonth) errors.push('periodMonth este obligatoriu și trebuie să fie YYYY-MM.');
      const readingValue = this.parseDecimal(row.readingValue);
      if (readingValue === null || Number.isNaN(readingValue)) errors.push('readingValue este obligatoriu și numeric.');
      if (readingValue !== null && !Number.isNaN(readingValue) && readingValue < 0) errors.push('readingValue trebuie să fie pozitiv sau zero.');
      const previousRaw = this.parseDecimal(row.previousReadingValue);
      if (Number.isNaN(previousRaw)) errors.push('previousReadingValue trebuie să fie numeric dacă este completat.');
      if (previousRaw !== null && !Number.isNaN(previousRaw) && previousRaw < 0) errors.push('previousReadingValue trebuie să fie pozitiv sau zero.');
      let status = this.parseReadingStatus(row.status, defaultStatus);
      if (!status) errors.push('status trebuie să fie SUBMITTED, APPROVED sau NEEDS_REVIEW.');
      if (!String(row.status || '').trim()) warnings.push(`Status lipsă, se va folosi ${defaultStatus}.`);
      const source = this.parseReadingSource(row.source);
      if (!source) errors.push('source trebuie să fie ADMIN, RESIDENT sau SYSTEM.');
      const submittedAt = this.parseDateIso(row.submittedAt);
      if (submittedAt === undefined) errors.push('submittedAt trebuie să fie dată validă în format YYYY-MM-DD.');
      let meter: typeof meters[number] | null = null;
      if (apartment && meterType) {
        const apartmentMeters = metersByApartment.get(apartment.id) || [];
        if (meterNumber) {
          meter = apartmentMeters.find((candidate) => String(candidate.serialNumber || '').trim().toLowerCase() === meterNumber.toLowerCase()) || null;
        } else {
          const sameType = apartmentMeters.filter((candidate) => candidate.type === meterType.prismaType);
          if (sameType.length === 1) {
            meter = sameType[0];
            warnings.push('meterNumber lipsește, contorul a fost identificat după apartament și tip.');
          } else if (sameType.length > 1) {
            errors.push('Există mai multe contoare de acest tip pentru apartament. Completează meterNumber.');
          }
        }
        if (!meter && !createMissingMeters) errors.push('Contorul nu există. Activează createMissingMeters doar dacă vrei creare controlată.');
        if (!meter && createMissingMeters) {
          if (!meterNumber) errors.push('createMissingMeters cere meterNumber completat.');
          else warnings.push('Contorul lipsește și va fi creat minimal înainte de importul indicelui.');
        }
      }
      const duplicateKey = `${apartmentNumber.toLowerCase()}:${meterNumber.toLowerCase() || meterType?.prismaType || ''}:${periodMonth || ''}`;
      if (apartmentNumber && periodMonth && meterType) {
        const firstRow = seen.get(duplicateKey);
        if (firstRow) errors.push(`Indice duplicat în fișier. Primul rând: ${firstRow}.`);
        else seen.set(duplicateKey, rowNumber);
      }
      let previousReadingValue = previousRaw === null || Number.isNaN(previousRaw) ? null : Number(previousRaw);
      let consumptionValue: number | null = null;
      let existingReadingId: string | null = null;
      if (meter && periodMonth && readingValue !== null && !Number.isNaN(readingValue)) {
        const meterReadings = readingsByMeter.get(meter.id) || [];
        const samePeriod = meterReadings.filter((reading) => this.periodMonth(reading.readingDate) === periodMonth);
        const approved = samePeriod.find((reading) => this.readingMeta(store, reading).status === 'APPROVED') || null;
        const notApproved = samePeriod.find((reading) => this.readingMeta(store, reading).status !== 'APPROVED') || null;
        if (approved) {
          if (duplicateApprovedPolicy === 'ERROR') errors.push('Există deja un indice APPROVED pentru acest contor și perioada selectată.');
          if (duplicateApprovedPolicy === 'SKIP') {
            warnings.push('Există deja un indice APPROVED. Rândul va fi ignorat.');
          }
          if (duplicateApprovedPolicy === 'UPDATE_ONLY_IF_NOT_FINAL') errors.push('Indicele APPROVED existent nu poate fi actualizat automat.');
          existingReadingId = approved.id;
        } else if (notApproved) {
          existingReadingId = notApproved.id;
        }
        if (previousReadingValue === null) {
          const previous = [...meterReadings]
            .filter((reading) => this.periodMonth(reading.readingDate) < periodMonth && this.readingMeta(store, reading).status === 'APPROVED')
            .sort((a, b) => String(b.readingDate).localeCompare(String(a.readingDate)))[0] || null;
          if (previous) {
            previousReadingValue = Number(previous.value || 0);
            const prevMeta = this.readingMeta(store, previous);
            consumptionValue = prevMeta.consumptionValue;
          } else {
            warnings.push('Primul indice pentru acest contor. Consumul nu poate fi calculat încă.');
          }
        }
      }
      if (!String(row.previousReadingValue ?? '').trim()) warnings.push('previousReadingValue lipsește, se va încerca calculul din ultimul indice aprobat.');
      if (previousReadingValue !== null && readingValue !== null && !Number.isNaN(readingValue)) {
        const computed = this.round(Number(readingValue) - previousReadingValue);
        if (computed < 0) {
          if (lowerThanPreviousPolicy === 'ERROR') errors.push('readingValue este mai mic decât previousReadingValue.');
          else {
            status = 'NEEDS_REVIEW';
            warnings.push('readingValue este mai mic decât precedentul. Rândul va fi marcat NEEDS_REVIEW.');
          }
        }
        consumptionValue = computed;
      }
      if (status === 'SUBMITTED') warnings.push('Indicele va fi importat ca SUBMITTED de admin.');
      const unit = String(row.unit || '').trim() || (meterType ? this.defaultMeterUnit(meterType.prismaType) : '');
      if (!String(row.unit || '').trim()) warnings.push('unit lipsește, se va lua din contor sau din tipul contorului.');
      let operation: ImportRowOperation = ImportRowOperation.CREATE;
      if (existingReadingId) {
        if (duplicateApprovedPolicy === 'SKIP') operation = ImportRowOperation.SKIP;
        else if (mode === ImportMode.UPSERT_SAFE) operation = ImportRowOperation.UPDATE;
        else {
          errors.push('Există deja un indice pentru acest contor și perioadă. Folosește UPSERT_SAFE pentru actualizare controlată.');
          operation = ImportRowOperation.NONE;
        }
      }
      const normalized: MeterReadingImportData | null = apartment && meterType && periodMonth && readingValue !== null && !Number.isNaN(readingValue) && status && source
        ? {
            apartmentNumber,
            apartmentId: apartment.id,
            meterType: meterType.prismaType,
            externalMeterType: meterType.externalType,
            meterNumber,
            meterId: meter?.id || null,
            periodMonth,
            readingValue: Number(readingValue),
            previousReadingValue,
            consumptionValue,
            unit,
            status,
            source,
            submittedAt: submittedAt || new Date().toISOString(),
            adminComment: String(row.adminComment || '').trim(),
            residentComment: String(row.residentComment || '').trim(),
            existingReadingId,
            createMissingMeter: Boolean(createMissingMeters && !meter),
          }
        : null;
      return {
        rowNumber,
        status: this.rowStatus(errors, warnings),
        operation,
        rawData: row,
        normalizedData: normalized as unknown as Record<string, unknown> | null,
        errors,
        warnings,
      };
    });
    return this.createPreviewJob({
      organizationId,
      userId,
      type: ImportType.METER_READINGS,
      mode,
      delimiter,
      fileName: file?.originalname || 'meter-readings.csv',
      options: { mode, delimiter, defaultStatus, duplicateApprovedPolicy, lowerThanPreviousPolicy, createMissingMeters },
      rows,
    });
  }

  async confirmAdmin(user: AuthUser, id: string, body: unknown = {}, activeOrganizationId?: string) {
    const { organizationId } = this.assertAdmin(user, activeOrganizationId, this.payload(body));
    const job = await this.prisma.importJob.findFirst({ where: { id, organizationId }, select: { id: true, type: true } });
    if (!job) throw new NotFoundException('Importul nu a fost găsit.');
    if (job.type === ImportType.APARTMENTS) return this.confirmApartmentsCsv(user, id, body, activeOrganizationId);
    if (job.type === ImportType.RESIDENTS) return this.confirmResidentsCsv(user, id, body, activeOrganizationId);
    if (job.type === ImportType.METERS) return this.confirmMetersCsv(user, id, body, activeOrganizationId);
    if (job.type === ImportType.METER_READINGS) return this.confirmMeterReadingsCsv(user, id, body, activeOrganizationId);
    return this.confirmLegacy(organizationId, id);
  }

  async confirmApartmentsCsv(user: AuthUser, id: string, body: unknown = {}, activeOrganizationId?: string) {
    const payload = this.payload(body);
    if (payload.confirm !== true && payload.confirm !== 'true') throw new BadRequestException('Confirmarea importului este obligatorie.');
    const { organizationId, userId } = this.assertAdmin(user, activeOrganizationId, payload);
    const job = await this.requireConfirmableJob(id, organizationId, ImportType.APARTMENTS);
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        await tx.importJob.update({ where: { id }, data: { status: ImportJobStatus.PROCESSING, startedAt: new Date() } });
        const rows = await tx.importRow.findMany({
          where: { importJobId: id, organizationId, status: { in: [ImportRowStatus.VALID, ImportRowStatus.WARNING] } },
          orderBy: { rowNumber: 'asc' },
        });
        let createdCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;
        const touchedBuildings = new Set<string>();
        for (const row of rows) {
          const normalized = row.normalizedData as unknown as ApartmentImportData;
          if (!normalized?.apartmentNumber) {
            skippedCount += 1;
            await tx.importRow.update({ where: { id: row.id }, data: { status: ImportRowStatus.SKIPPED } });
            continue;
          }
          const building = await this.findOrCreateBuilding(tx, organizationId, normalized.building);
          const staircase = await this.findOrCreateStaircase(tx, organizationId, building.id, normalized.staircase);
          touchedBuildings.add(building.id);
          const data = {
            organizationId,
            buildingId: building.id,
            staircaseId: staircase.id,
            number: normalized.apartmentNumber,
            floor: normalized.floor,
            areaM2: normalized.areaM2,
            status: normalized.apartmentStatus,
          };
          if (row.operation === ImportRowOperation.UPDATE && job.mode === ImportMode.UPSERT_SAFE && normalized.existingApartmentId) {
            const updated = await tx.apartment.update({
              where: { id: normalized.existingApartmentId },
              data,
              select: { id: true },
            });
            updatedCount += 1;
            await tx.importRow.update({ where: { id: row.id }, data: { status: ImportRowStatus.IMPORTED, updatedEntityId: updated.id } });
            await this.updateApartmentMetadata(tx, organizationId, userId, updated.id, normalized);
          } else if (row.operation === ImportRowOperation.CREATE) {
            const created = await tx.apartment.create({ data, select: { id: true } });
            createdCount += 1;
            await tx.importRow.update({ where: { id: row.id }, data: { status: ImportRowStatus.IMPORTED, createdEntityId: created.id } });
            await this.updateApartmentMetadata(tx, organizationId, userId, created.id, normalized);
          } else {
            skippedCount += 1;
            await tx.importRow.update({ where: { id: row.id }, data: { status: ImportRowStatus.SKIPPED } });
          }
        }
        for (const buildingId of touchedBuildings) {
          await this.syncBuildingCounters(tx, buildingId);
        }
        const summary = {
          ...(job.summary as Record<string, unknown> | null || {}),
          createdCount,
          updatedCount,
          skippedCount,
        };
        const updated = await tx.importJob.update({
          where: { id },
          data: {
            status: ImportJobStatus.COMPLETED,
            completedAt: new Date(),
            createdCount,
            updatedCount,
            skippedCount,
            summary: summary as Prisma.InputJsonValue,
          },
          select: this.importJobSelect(),
        });
        return updated;
      });
      await this.auditImport(organizationId, userId, 'IMPORT_COMPLETED', 'Import apartamente finalizat', {
        importType: ImportType.APARTMENTS,
        importJobId: id,
        createdCount: result.createdCount,
        updatedCount: result.updatedCount,
        skippedCount: result.skippedCount,
      });
      return this.importJobWithRows(id, organizationId, 100);
    } catch (error) {
      await this.markImportFailed(id, organizationId, userId, ImportType.APARTMENTS, error);
      throw error;
    }
  }

  async confirmResidentsCsv(user: AuthUser, id: string, body: unknown = {}, activeOrganizationId?: string) {
    const payload = this.payload(body);
    if (payload.confirm !== true && payload.confirm !== 'true') throw new BadRequestException('Confirmarea importului este obligatorie.');
    const { organizationId, userId } = this.assertAdmin(user, activeOrganizationId, payload);
    const job = await this.requireConfirmableJob(id, organizationId, ImportType.RESIDENTS);
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        await tx.importJob.update({ where: { id }, data: { status: ImportJobStatus.PROCESSING, startedAt: new Date() } });
        const rows = await tx.importRow.findMany({
          where: { importJobId: id, organizationId, status: { in: [ImportRowStatus.VALID, ImportRowStatus.WARNING] } },
          orderBy: { rowNumber: 'asc' },
        });
        let createdCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;
        let linkedCount = 0;
        let primaryContactChanges = 0;
        for (const row of rows) {
          const normalized = row.normalizedData as unknown as ResidentImportData;
          if (!normalized?.fullName || row.operation === ImportRowOperation.SKIP) {
            skippedCount += 1;
            await tx.importRow.update({ where: { id: row.id }, data: { status: ImportRowStatus.SKIPPED } });
            continue;
          }
          let residentId = normalized.existingResidentId || '';
          if (residentId && job.mode === ImportMode.UPSERT_SAFE) {
            await tx.residentProfile.update({
              where: { id: residentId },
              data: {
                firstName: normalized.firstName,
                lastName: normalized.lastName,
                phone: normalized.phone || null,
                email: normalized.email || null,
                accountStatus: normalized.accountStatus,
                type: this.residentTypeFromRole(normalized.role),
              },
            });
            updatedCount += 1;
          }
          if (!residentId) {
            const created = await tx.residentProfile.create({
              data: {
                organizationId,
                firstName: normalized.firstName,
                lastName: normalized.lastName,
                phone: normalized.phone || null,
                email: normalized.email || null,
                accountStatus: normalized.accountStatus,
                type: this.residentTypeFromRole(normalized.role),
                apartmentId: normalized.apartmentId || null,
                isPrimary: normalized.isPrimaryContact,
              },
              select: { id: true },
            });
            residentId = created.id;
            createdCount += 1;
          }
          await this.updateResidentMetadata(tx, organizationId, userId, residentId, normalized);
          if (normalized.apartmentId) {
            const existingRelation = await tx.apartmentResident.findUnique({
              where: {
                apartmentId_residentId_role: {
                  apartmentId: normalized.apartmentId,
                  residentId,
                  role: normalized.role,
                },
              },
              select: { apartmentId: true },
            });
            if (!existingRelation) {
              await tx.apartmentResident.create({
                data: {
                  apartmentId: normalized.apartmentId,
                  residentId,
                  role: normalized.role,
                  isPrimary: normalized.isPrimaryContact,
                },
              });
              linkedCount += 1;
            } else {
              await tx.apartmentResident.update({
                where: {
                  apartmentId_residentId_role: {
                    apartmentId: normalized.apartmentId,
                    residentId,
                    role: normalized.role,
                  },
                },
                data: { isPrimary: normalized.isPrimaryContact },
              });
            }
            if (normalized.isPrimaryContact) {
              await tx.apartmentResident.updateMany({
                where: { apartmentId: normalized.apartmentId, residentId: { not: residentId }, isPrimary: true },
                data: { isPrimary: false },
              });
              await tx.apartment.update({
                where: { id: normalized.apartmentId },
                data: { ownerResidentId: residentId, status: ApartmentStatus.OCCUPIED },
              });
              primaryContactChanges += 1;
            }
            await this.updateApartmentResidentContactMethod(tx, organizationId, userId, normalized.apartmentId, residentId, normalized.role, normalized.preferredContactMethod);
          }
          await tx.importRow.update({
            where: { id: row.id },
            data: {
              status: ImportRowStatus.IMPORTED,
              createdEntityId: row.operation === ImportRowOperation.CREATE ? residentId : null,
              updatedEntityId: row.operation !== ImportRowOperation.CREATE ? residentId : null,
            },
          });
        }
        const summary = {
          ...(job.summary as Record<string, unknown> | null || {}),
          createdCount,
          updatedCount,
          skippedCount,
          linkedCount,
          primaryContactChanges,
        };
        const updated = await tx.importJob.update({
          where: { id },
          data: {
            status: ImportJobStatus.COMPLETED,
            completedAt: new Date(),
            createdCount,
            updatedCount,
            skippedCount,
            summary: summary as Prisma.InputJsonValue,
          },
          select: this.importJobSelect(),
        });
        return updated;
      });
      await this.auditImport(organizationId, userId, 'IMPORT_COMPLETED', 'Import locatari finalizat', {
        importType: ImportType.RESIDENTS,
        importJobId: id,
        createdCount: result.createdCount,
        updatedCount: result.updatedCount,
        skippedCount: result.skippedCount,
      });
      return this.importJobWithRows(id, organizationId, 100);
    } catch (error) {
      await this.markImportFailed(id, organizationId, userId, ImportType.RESIDENTS, error);
      throw error;
    }
  }

  async confirmMetersCsv(user: AuthUser, id: string, body: unknown = {}, activeOrganizationId?: string) {
    const payload = this.payload(body);
    if (payload.confirm !== true && payload.confirm !== 'true') throw new BadRequestException('Confirmarea importului este obligatorie.');
    const { organizationId, userId } = this.assertAdmin(user, activeOrganizationId, payload);
    const job = await this.requireConfirmableJob(id, organizationId, ImportType.METERS);
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        await tx.importJob.update({ where: { id }, data: { status: ImportJobStatus.PROCESSING, startedAt: new Date() } });
        const rows = await tx.importRow.findMany({
          where: { importJobId: id, organizationId, status: { in: [ImportRowStatus.VALID, ImportRowStatus.WARNING] } },
          orderBy: { rowNumber: 'asc' },
        });
        const store = await this.readMeterWorkflowMetadata(tx, organizationId);
        let createdCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;
        for (const row of rows) {
          const normalized = row.normalizedData as unknown as MeterImportData;
          if (!normalized?.apartmentId || row.operation === ImportRowOperation.SKIP || row.operation === ImportRowOperation.NONE) {
            skippedCount += 1;
            await tx.importRow.update({ where: { id: row.id }, data: { status: ImportRowStatus.SKIPPED } });
            continue;
          }
          if (row.operation === ImportRowOperation.UPDATE && job.mode === ImportMode.UPSERT_SAFE && normalized.existingMeterId) {
            const updated = await tx.meter.update({
              where: { id: normalized.existingMeterId },
              data: {
                status: normalized.prismaStatus,
              },
              select: { id: true },
            });
            store.meters[updated.id] = {
              ...(isRecord(store.meters[updated.id]) ? store.meters[updated.id] : {}),
              label: normalized.label || null,
              unit: normalized.unit || this.defaultMeterUnit(normalized.meterType),
              location: normalized.location || null,
              notes: normalized.notes || null,
              installedAt: normalized.installedAt,
              statusAlias: normalized.status,
            };
            updatedCount += 1;
            await tx.importRow.update({ where: { id: row.id }, data: { status: ImportRowStatus.IMPORTED, updatedEntityId: updated.id } });
          } else if (row.operation === ImportRowOperation.CREATE) {
            const created = await tx.meter.create({
              data: {
                organizationId,
                apartmentId: normalized.apartmentId,
                type: normalized.meterType,
                serialNumber: normalized.meterNumber || null,
                status: normalized.prismaStatus,
              },
              select: { id: true },
            });
            store.meters[created.id] = {
              label: normalized.label || null,
              unit: normalized.unit || this.defaultMeterUnit(normalized.meterType),
              location: normalized.location || null,
              notes: normalized.notes || null,
              installedAt: normalized.installedAt,
              statusAlias: normalized.status,
            };
            createdCount += 1;
            await tx.importRow.update({ where: { id: row.id }, data: { status: ImportRowStatus.IMPORTED, createdEntityId: created.id } });
          } else {
            skippedCount += 1;
            await tx.importRow.update({ where: { id: row.id }, data: { status: ImportRowStatus.SKIPPED } });
          }
        }
        await this.writeMeterWorkflowMetadata(tx, organizationId, userId, store);
        const summary = { ...(job.summary as Record<string, unknown> | null || {}), createdCount, updatedCount, skippedCount };
        const updated = await tx.importJob.update({
          where: { id },
          data: {
            status: ImportJobStatus.COMPLETED,
            completedAt: new Date(),
            createdCount,
            updatedCount,
            skippedCount,
            summary: summary as Prisma.InputJsonValue,
          },
          select: this.importJobSelect(),
        });
        return updated;
      });
      await this.auditImport(organizationId, userId, 'IMPORT_COMPLETED', 'Import contoare finalizat', {
        importType: ImportType.METERS,
        importJobId: id,
        createdCount: result.createdCount,
        updatedCount: result.updatedCount,
        skippedCount: result.skippedCount,
      });
      return this.importJobWithRows(id, organizationId, 100);
    } catch (error) {
      await this.markImportFailed(id, organizationId, userId, ImportType.METERS, error);
      throw error;
    }
  }

  async confirmMeterReadingsCsv(user: AuthUser, id: string, body: unknown = {}, activeOrganizationId?: string) {
    const payload = this.payload(body);
    if (payload.confirm !== true && payload.confirm !== 'true') throw new BadRequestException('Confirmarea importului este obligatorie.');
    const { organizationId, userId } = this.assertAdmin(user, activeOrganizationId, payload);
    const job = await this.requireConfirmableJob(id, organizationId, ImportType.METER_READINGS);
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        await tx.importJob.update({ where: { id }, data: { status: ImportJobStatus.PROCESSING, startedAt: new Date() } });
        const currentJob = await tx.importJob.findUnique({ where: { id }, select: { options: true, mode: true, summary: true } });
        const jobOptions = isRecord(currentJob?.options) ? currentJob!.options as Record<string, unknown> : {};
        const duplicateApprovedPolicy = String(jobOptions.duplicateApprovedPolicy || 'ERROR').toUpperCase();
        const createMissingMeters = Boolean(jobOptions.createMissingMeters);
        const rows = await tx.importRow.findMany({
          where: { importJobId: id, organizationId, status: { in: [ImportRowStatus.VALID, ImportRowStatus.WARNING] } },
          orderBy: { rowNumber: 'asc' },
        });
        const store = await this.readMeterWorkflowMetadata(tx, organizationId);
        let createdCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;
        let createdMetersCount = 0;
        let approvedReadingsCount = 0;
        let submittedReadingsCount = 0;
        let needsReviewReadingsCount = 0;
        for (const row of rows) {
          const normalized = row.normalizedData as unknown as MeterReadingImportData;
          if (!normalized?.apartmentId || row.operation === ImportRowOperation.SKIP || row.operation === ImportRowOperation.NONE) {
            skippedCount += 1;
            await tx.importRow.update({ where: { id: row.id }, data: { status: ImportRowStatus.SKIPPED } });
            continue;
          }
          let meterId = normalized.meterId || '';
          if (!meterId && normalized.createMissingMeter && createMissingMeters) {
            const createdMeter = await tx.meter.create({
              data: {
                organizationId,
                apartmentId: normalized.apartmentId,
                type: normalized.meterType,
                serialNumber: normalized.meterNumber,
                status: MeterStatus.ACTIVE,
              },
              select: { id: true },
            });
            meterId = createdMeter.id;
            createdMetersCount += 1;
            store.meters[meterId] = {
              label: '',
              unit: normalized.unit || this.defaultMeterUnit(normalized.meterType),
              location: null,
              notes: 'Creat automat la importul indicilor.',
              installedAt: null,
              statusAlias: 'ACTIVE',
            };
          }
          if (!meterId) {
            skippedCount += 1;
            await tx.importRow.update({ where: { id: row.id }, data: { status: ImportRowStatus.SKIPPED } });
            continue;
          }
          const periodRows = await this.periodReadings(tx, meterId, organizationId, normalized.periodMonth);
          const approved = periodRows.find((reading) => reading.id !== normalized.existingReadingId && this.readingMeta(store, reading).status === 'APPROVED');
          if (normalized.status === 'APPROVED' && approved) {
            if (duplicateApprovedPolicy === 'SKIP') {
              skippedCount += 1;
              await tx.importRow.update({ where: { id: row.id }, data: { status: ImportRowStatus.SKIPPED } });
              continue;
            }
            throw new BadRequestException('Există deja un indice aprobat pentru unul dintre rândurile importate.');
          }
          const previous = await this.previousApprovedReading(tx, meterId, organizationId, normalized.periodMonth, store, normalized.existingReadingId);
          const previousReadingValue = normalized.previousReadingValue ?? previous?.readingValue ?? null;
          const consumptionValue = previousReadingValue !== null ? this.round(normalized.readingValue - previousReadingValue) : null;
          const readingData = {
            meterId,
            apartmentId: normalized.apartmentId,
            organizationId,
            value: normalized.readingValue,
            readingDate: this.dateFromPeriodMonth(normalized.periodMonth),
            source: normalized.source as MeterReadingSource,
          };
          let readingId = normalized.existingReadingId || '';
          if (row.operation === ImportRowOperation.UPDATE && job.mode === ImportMode.UPSERT_SAFE && readingId) {
            const existing = await tx.meterReading.findFirst({ where: { id: readingId, organizationId }, select: { id: true, readingDate: true, source: true } });
            if (!existing) throw new NotFoundException('Indicele de actualizat nu a fost găsit.');
            if (this.readingMeta(store, existing).status === 'APPROVED') throw new BadRequestException('Indicele APPROVED existent nu poate fi actualizat automat.');
            const updated = await tx.meterReading.update({ where: { id: readingId }, data: readingData, select: { id: true } });
            readingId = updated.id;
            updatedCount += 1;
            await tx.importRow.update({ where: { id: row.id }, data: { status: ImportRowStatus.IMPORTED, updatedEntityId: updated.id } });
          } else {
            const created = await tx.meterReading.create({ data: readingData, select: { id: true } });
            readingId = created.id;
            createdCount += 1;
            await tx.importRow.update({ where: { id: row.id }, data: { status: ImportRowStatus.IMPORTED, createdEntityId: created.id } });
          }
          store.readings[readingId] = {
            periodMonth: normalized.periodMonth,
            status: normalized.status,
            source: normalized.source,
            unit: normalized.unit || this.defaultMeterUnit(normalized.meterType),
            previousReadingValue,
            consumptionValue,
            submittedByUserId: userId,
            reviewedByUserId: normalized.status === 'APPROVED' || normalized.status === 'NEEDS_REVIEW' ? userId : null,
            submittedAt: normalized.submittedAt,
            reviewedAt: normalized.status === 'APPROVED' || normalized.status === 'NEEDS_REVIEW' ? new Date().toISOString() : null,
            adminComment: normalized.adminComment || null,
            residentComment: normalized.residentComment || null,
          };
          if (normalized.status === 'APPROVED') approvedReadingsCount += 1;
          if (normalized.status === 'SUBMITTED') submittedReadingsCount += 1;
          if (normalized.status === 'NEEDS_REVIEW') needsReviewReadingsCount += 1;
          await tx.meter.update({
            where: { id: meterId },
            data: { status: normalized.status === 'NEEDS_REVIEW' ? MeterStatus.SUSPICIOUS : MeterStatus.ACTIVE },
          });
        }
        await this.writeMeterWorkflowMetadata(tx, organizationId, userId, store);
        const summary = {
          ...(currentJob?.summary as Record<string, unknown> | null || {}),
          createdCount,
          updatedCount,
          skippedCount,
          createdMetersCount,
          approvedReadingsCount,
          submittedReadingsCount,
          needsReviewReadingsCount,
        };
        const updated = await tx.importJob.update({
          where: { id },
          data: {
            status: ImportJobStatus.COMPLETED,
            completedAt: new Date(),
            createdCount,
            updatedCount,
            skippedCount,
            summary: summary as Prisma.InputJsonValue,
          },
          select: this.importJobSelect(),
        });
        return updated;
      });
      await this.auditImport(organizationId, userId, 'IMPORT_COMPLETED', 'Import indici contoare finalizat', {
        importType: ImportType.METER_READINGS,
        importJobId: id,
        createdCount: result.createdCount,
        updatedCount: result.updatedCount,
        skippedCount: result.skippedCount,
      });
      return this.importJobWithRows(id, organizationId, 100);
    } catch (error) {
      await this.markImportFailed(id, organizationId, userId, ImportType.METER_READINGS, error);
      throw error;
    }
  }

  private async requireConfirmableJob(id: string, organizationId: string, type: ImportType) {
    const job = await this.prisma.importJob.findFirst({
      where: { id, organizationId, type },
      select: { id: true, type: true, mode: true, status: true, errorRows: true, invalidRows: true, summary: true },
    });
    if (!job) throw new NotFoundException('Importul nu a fost găsit.');
    if (job.status === ImportJobStatus.COMPLETED || job.status === ImportJobStatus.IMPORTED) throw new BadRequestException('Importul a fost deja aplicat.');
    if (job.status === ImportJobStatus.CANCELLED) throw new BadRequestException('Importul este anulat.');
    if (job.errorRows > 0 || job.invalidRows > 0) throw new BadRequestException('Importul are erori. Corectează fișierul înainte de confirmare.');
    return job;
  }

  private async findOrCreateBuilding(tx: Prisma.TransactionClient, organizationId: string, name: string) {
    const trimmed = name.trim() || 'Bloc principal';
    const existing = await tx.building.findFirst({ where: { organizationId, name: trimmed }, select: { id: true } });
    if (existing) return existing;
    return tx.building.create({ data: { organizationId, name: trimmed, address: null }, select: { id: true } });
  }

  private async findOrCreateStaircase(tx: Prisma.TransactionClient, organizationId: string, buildingId: string, name: string) {
    const trimmed = name.trim() || 'Fără scară';
    const existing = await tx.staircase.findFirst({ where: { organizationId, buildingId, name: trimmed }, select: { id: true } });
    if (existing) return existing;
    return tx.staircase.create({ data: { organizationId, buildingId, name: trimmed, floorsCount: 0 }, select: { id: true } });
  }

  private async syncBuildingCounters(tx: Prisma.TransactionClient, buildingId: string) {
    const [staircasesCount, apartmentsCount] = await Promise.all([
      tx.staircase.count({ where: { buildingId } }),
      tx.apartment.count({ where: { buildingId } }),
    ]);
    await tx.building.update({ where: { id: buildingId }, data: { staircasesCount, apartmentsCount } });
  }

  private async readMetadata(tx: Prisma.TransactionClient, organizationId: string, title: string) {
    const note = await tx.clientNote.findFirst({
      where: { organizationId, title },
      orderBy: { updatedAt: 'desc' },
      select: { content: true },
    });
    if (!note?.content) return {};
    try {
      const parsed = JSON.parse(note.content);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  private async writeMetadata(tx: Prisma.TransactionClient, organizationId: string, userId: string, title: string, next: Record<string, unknown>) {
    const existing = await tx.clientNote.findFirst({ where: { organizationId, title }, select: { id: true } });
    const content = JSON.stringify(next);
    if (existing) {
      await tx.clientNote.update({ where: { id: existing.id }, data: { content } });
      return;
    }
    await tx.clientNote.create({
      data: {
        organizationId,
        createdByUserId: userId,
        title,
        content,
      },
    });
  }

  private normalizeMeterWorkflowMetadata(value: unknown): MeterWorkflowMetadata {
    if (!isRecord(value)) return { version: 1, meters: {}, readings: {} };
    const meters = isRecord(value.meters) ? value.meters as Record<string, Record<string, unknown>> : {};
    const readings = isRecord(value.readings) ? value.readings as Record<string, Record<string, unknown>> : {};
    return { version: 1, meters, readings };
  }

  private async readMeterWorkflowMetadata(tx: Prisma.TransactionClient, organizationId: string) {
    const raw = await this.readMetadata(tx, organizationId, METER_METADATA_TITLE);
    return this.normalizeMeterWorkflowMetadata(raw);
  }

  private async writeMeterWorkflowMetadata(tx: Prisma.TransactionClient, organizationId: string, userId: string, metadata: MeterWorkflowMetadata) {
    await this.writeMetadata(tx, organizationId, userId, METER_METADATA_TITLE, {
      version: 1,
      meters: metadata.meters || {},
      readings: metadata.readings || {},
    });
  }

  private async loadMeterWorkflowMetadata(organizationId: string) {
    const note = await this.prisma.clientNote.findFirst({
      where: { organizationId, title: METER_METADATA_TITLE },
      orderBy: { updatedAt: 'desc' },
      select: { content: true },
    });
    if (!note?.content) return { version: 1, meters: {}, readings: {} } as MeterWorkflowMetadata;
    try {
      return this.normalizeMeterWorkflowMetadata(JSON.parse(note.content));
    } catch {
      return { version: 1, meters: {}, readings: {} } as MeterWorkflowMetadata;
    }
  }

  private readingMeta(store: MeterWorkflowMetadata, reading: { id: string; readingDate: Date | string; source?: MeterReadingSource | string }) {
    const raw = isRecord(store.readings?.[reading.id]) ? store.readings[reading.id] : {};
    return {
      ...raw,
      status: String(raw.status || 'APPROVED').toUpperCase(),
      periodMonth: String(raw.periodMonth || this.periodMonth(reading.readingDate)),
      source: String(raw.source || reading.source || 'ADMIN').toUpperCase(),
      previousReadingValue: raw.previousReadingValue === null || raw.previousReadingValue === undefined ? null : Number(raw.previousReadingValue),
      consumptionValue: raw.consumptionValue === null || raw.consumptionValue === undefined ? null : Number(raw.consumptionValue),
    };
  }

  private async periodReadings(tx: Prisma.TransactionClient, meterId: string, organizationId: string, periodMonth: string) {
    const start = this.dateFromPeriodMonth(periodMonth);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
    return tx.meterReading.findMany({
      where: { meterId, organizationId, readingDate: { gte: start, lt: end } },
      select: { id: true, value: true, readingDate: true, source: true },
    });
  }

  private async previousApprovedReading(
    tx: Prisma.TransactionClient,
    meterId: string,
    organizationId: string,
    periodMonth: string,
    store: MeterWorkflowMetadata,
    excludeReadingId?: string | null,
  ) {
    const start = this.dateFromPeriodMonth(periodMonth);
    const rows = await tx.meterReading.findMany({
      where: { meterId, organizationId, readingDate: { lt: start } },
      orderBy: [{ readingDate: 'desc' }, { createdAt: 'desc' }],
      select: { id: true, value: true, readingDate: true, source: true },
    });
    const row = rows.find((reading) => reading.id !== excludeReadingId && this.readingMeta(store, reading).status === 'APPROVED');
    if (!row) return null;
    const meta = this.readingMeta(store, row);
    return {
      id: row.id,
      readingValue: Number(row.value || 0),
      periodMonth: meta.periodMonth,
      consumptionValue: meta.consumptionValue,
    };
  }

  private async updateApartmentMetadata(tx: Prisma.TransactionClient, organizationId: string, userId: string, apartmentId: string, data: ApartmentImportData) {
    const current = await this.readMetadata(tx, organizationId, APARTMENT_METADATA_TITLE);
    const existing = isRecord(current[apartmentId]) ? (current[apartmentId] as Record<string, unknown>) : {};
    await this.writeMetadata(tx, organizationId, userId, APARTMENT_METADATA_TITLE, {
      ...current,
      [apartmentId]: {
        ...existing,
        cadastralNumber: data.cadastralNumber,
        internalNotes: data.internalNotes,
      },
    });
  }

  private async updateApartmentResidentContactMethod(
    tx: Prisma.TransactionClient,
    organizationId: string,
    userId: string,
    apartmentId: string,
    residentId: string,
    role: ApartmentResidentRole,
    preferredContactMethod: string,
  ) {
    const current = await this.readMetadata(tx, organizationId, APARTMENT_METADATA_TITLE);
    const existing = isRecord(current[apartmentId]) ? (current[apartmentId] as Record<string, any>) : {};
    await this.writeMetadata(tx, organizationId, userId, APARTMENT_METADATA_TITLE, {
      ...current,
      [apartmentId]: {
        ...existing,
        residentContactMethods: {
          ...(isRecord(existing.residentContactMethods) ? existing.residentContactMethods : {}),
          [`${residentId}:${role}`]: preferredContactMethod,
        },
      },
    });
  }

  private async updateResidentMetadata(tx: Prisma.TransactionClient, organizationId: string, userId: string, residentId: string, data: ResidentImportData) {
    const current = await this.readMetadata(tx, organizationId, RESIDENT_METADATA_TITLE);
    const existing = isRecord(current[residentId]) ? (current[residentId] as Record<string, any>) : {};
    const relationKey = data.apartmentId ? `${data.apartmentId}:${data.role}` : '';
    await this.writeMetadata(tx, organizationId, userId, RESIDENT_METADATA_TITLE, {
      ...current,
      [residentId]: {
        ...existing,
        preferredContactMethod: data.preferredContactMethod,
        status: data.status,
        internalNotes: data.internalNotes,
        relations: relationKey
          ? {
              ...(isRecord(existing.relations) ? existing.relations : {}),
              [relationKey]: {
                notes: '',
                relationStartDate: '',
                relationEndDate: '',
              },
            }
          : existing.relations || {},
      },
    });
  }

  private async markImportFailed(id: string, organizationId: string, userId: string, type: ImportType, error: unknown) {
    await this.prisma.importJob
      .update({
        where: { id },
        data: {
          status: ImportJobStatus.FAILED,
          summary: {
            error: error instanceof Error ? error.message : 'Importul a eșuat.',
          },
        },
      })
      .catch(() => null);
    await this.auditImport(organizationId, userId, 'IMPORT_FAILED', 'Import eșuat', {
      importType: type,
      importJobId: id,
      error: error instanceof Error ? error.message : 'Importul a eșuat.',
    });
  }

  private async auditImport(organizationId: string, userId: string, action: string, message: string, metadata: Record<string, unknown>) {
    await this.audit
      .createLog({
        associationId: organizationId,
        actorUserId: userId,
        actorRole: 'ADMIN',
        action,
        entityType: 'SYSTEM',
        title: message,
        message,
        severity: action === 'IMPORT_FAILED' ? 'ERROR' : action === 'IMPORT_CANCELLED' ? 'WARNING' : 'SUCCESS',
        metadata,
      })
      .catch(() => null);
  }

  async uploadAdmin(user: AuthUser, type: ImportType, fileName: string, fileBuffer: Buffer, activeOrganizationId?: string) {
    const { organizationId, userId } = this.assertAdmin(user, activeOrganizationId);
    if (type === ImportType.APARTMENTS || type === ImportType.RESIDENTS) {
      const file = { originalname: fileName, buffer: fileBuffer } as Express.Multer.File;
      return type === ImportType.APARTMENTS
        ? this.previewApartmentsCsv(user, { mode: ImportMode.CREATE_ONLY, delimiter: ';' }, file, activeOrganizationId)
        : this.previewResidentsCsv(user, { mode: ImportMode.CREATE_ONLY, delimiter: ';' }, file, activeOrganizationId);
    }
    if (type === ImportType.METERS || type === ImportType.METER_READINGS) {
      const file = { originalname: fileName, buffer: fileBuffer } as Express.Multer.File;
      return type === ImportType.METERS
        ? this.previewMetersCsv(user, { mode: ImportMode.CREATE_ONLY, delimiter: ';' }, file, activeOrganizationId)
        : this.previewMeterReadingsCsv(user, { mode: ImportMode.CREATE_ONLY, delimiter: ';' }, file, activeOrganizationId);
    }
    return this.createLegacyImportJob(organizationId, userId, type, fileName, fileBuffer);
  }

  private parseXlsxBuffer(fileBuffer: Buffer) {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const firstSheet = workbook.SheetNames[0];
    if (!firstSheet) throw new BadRequestException('No worksheet found');
    const sheet = workbook.Sheets[firstSheet];
    return XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
  }

  private validateLegacyRows(type: ImportType, rows: Record<string, any>[]) {
    return rows.map((raw, idx) => {
      const errors: string[] = [];
      if (type === ImportType.APARTMENTS && !String(raw.apartmentNumber || '').trim()) errors.push('apartmentNumber is required');
      if (type === ImportType.RESIDENTS && !String(raw.ownerName || raw.fullName || '').trim()) errors.push('resident name is required');
      return { ...raw, _rowIndex: idx + 1, _isValid: errors.length === 0, _errors: errors };
    });
  }

  private async createLegacyImportJob(organizationId: string, userId: string, type: ImportType, fileName: string, fileBuffer: Buffer) {
    const rows = this.parseXlsxBuffer(fileBuffer);
    const preview = this.validateLegacyRows(type, rows);
    const validRows = preview.filter((row) => row._isValid).length;
    const invalidRows = preview.length - validRows;
    return this.prisma.importJob.create({
      data: {
        organizationId,
        type,
        fileName,
        status: invalidRows > 0 ? ImportJobStatus.FAILED : ImportJobStatus.VALIDATED,
        totalRows: preview.length,
        validRows,
        invalidRows,
        errorRows: invalidRows,
        errorsJson: { rows: preview },
        createdByUserId: userId,
      },
    });
  }

  templateXlsx(type: ImportType) {
    const rowsByType: Record<ImportType, Array<Record<string, any>>> = {
      BUILDINGS: [{ buildingName: 'Bloc A', address: 'Str. Independentei 1', cadastralNumber: 'CAD-123', totalFloors: 9 }],
      STAIRCASES: [{ buildingName: 'Bloc A', staircaseName: 'Scara 1', floorsCount: 9 }],
      APARTMENTS: [{ apartmentNumber: '24', building: 'A', staircase: '1', floor: 5, areaM2: 67.4, status: 'OCCUPIED' }],
      RESIDENTS: [{ fullName: 'Ion Popescu', phone: '+37369123456', email: 'ion@example.com', apartmentNumber: '24', role: 'OWNER' }],
      METERS: [{ apartmentNumber: '24', meterType: 'COLD_WATER', meterNumber: 'CW-24-1', unit: 'm³', status: 'ACTIVE' }],
      METER_READINGS: [{ apartmentNumber: '24', meterType: 'COLD_WATER', meterNumber: 'CW-24-1', periodMonth: '2026-05', readingValue: 131.2, status: 'APPROVED' }],
      INITIAL_BALANCES: [{ apartmentNumber: '12', buildingName: 'Bloc A', initialDebt: 450.5, initialAdvancePayment: 50, note: 'Initial import' }],
    };
    const ws = XLSX.utils.json_to_sheet(rowsByType[type] || []);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    return XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }) as Buffer;
  }

  private async confirmLegacy(organizationId: string, id: string) {
    const job = await this.prisma.importJob.findFirst({ where: { id, organizationId } });
    if (!job) throw new NotFoundException('Import job not found');
    return this.prisma.importJob.update({ where: { id }, data: { status: ImportJobStatus.IMPORTED } });
  }
}
