import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ApartmentStatus, ImportJobStatus, ImportType, ResidentType, Role } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as XLSX from 'xlsx';
import { PrismaService } from '../prisma/prisma.service';

type AuthUser = { id?: string; sub?: string; role?: string; organizationId?: string | null };
type PreviewRow = Record<string, any> & { _rowIndex: number; _isValid: boolean; _errors: string[] };

@Injectable()
export class ImportsService {
  constructor(private readonly prisma: PrismaService) {}

  private userId(user: AuthUser) {
    return user.id || user.sub || '';
  }

  private assertAdmin(user: AuthUser) {
    if (String(user.role || '').toUpperCase() !== 'ADMIN') throw new ForbiddenException('Admin access required');
    if (!user.organizationId) throw new ForbiddenException('Organization context missing');
    return { organizationId: user.organizationId, userId: this.userId(user) };
  }

  private assertSuperadmin(user: AuthUser) {
    const role = String(user.role || '').toUpperCase();
    if (!['SUPERADMIN', 'SUPER_ADMIN'].includes(role)) throw new ForbiddenException('Super admin access required');
    return { userId: this.userId(user) };
  }

  private parseBuffer(fileBuffer: Buffer) {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const firstSheet = workbook.SheetNames[0];
    if (!firstSheet) throw new BadRequestException('No worksheet found');
    const sheet = workbook.Sheets[firstSheet];
    return XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
  }

  private isEmail(value?: string) {
    if (!value) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  private apartmentStatus(value: unknown): ApartmentStatus {
    const status = String(value || 'EMPTY').trim().toUpperCase();
    return Object.values(ApartmentStatus).includes(status as ApartmentStatus) ? (status as ApartmentStatus) : ApartmentStatus.EMPTY;
  }

  private toNumber(value: any) {
    const n = Number(value);
    return Number.isFinite(n) ? n : NaN;
  }

  private validateRows(type: ImportType, rows: Record<string, any>[]) {
    const preview: PreviewRow[] = rows.map((raw, idx) => {
      const row: PreviewRow = { ...raw, _rowIndex: idx + 1, _isValid: true, _errors: [] };
      const req = (field: string) => {
        if (!String(raw[field] ?? '').trim()) row._errors.push(`${field} is required`);
      };
      if (type === 'BUILDINGS') {
        req('buildingName');
        req('address');
        req('totalFloors');
        if (String(raw.totalFloors || '').trim() && Number.isNaN(this.toNumber(raw.totalFloors))) row._errors.push('totalFloors must be number');
      }
      if (type === 'STAIRCASES') {
        req('buildingName');
        req('staircaseName');
        req('floorsCount');
        if (String(raw.floorsCount || '').trim() && Number.isNaN(this.toNumber(raw.floorsCount))) row._errors.push('floorsCount must be number');
      }
      if (type === 'APARTMENTS') {
        req('buildingName');
        req('staircaseName');
        req('apartmentNumber');
        req('floor');
        req('areaM2');
        if (Number.isNaN(this.toNumber(raw.floor))) row._errors.push('floor must be number');
        if (Number.isNaN(this.toNumber(raw.areaM2))) row._errors.push('areaM2 must be number');
      }
      if (type === 'RESIDENTS') {
        req('buildingName');
        req('apartmentNumber');
        req('ownerName');
        if (!this.isEmail(String(raw.ownerEmail || '').trim())) row._errors.push('ownerEmail invalid');
        if (!this.isEmail(String(raw.tenantEmail || '').trim())) row._errors.push('tenantEmail invalid');
      }
      if (type === 'INITIAL_BALANCES') {
        req('buildingName');
        req('apartmentNumber');
        req('initialDebt');
        if (Number.isNaN(this.toNumber(raw.initialDebt))) row._errors.push('initialDebt must be number');
        if (String(raw.initialAdvancePayment || '').trim() && Number.isNaN(this.toNumber(raw.initialAdvancePayment))) {
          row._errors.push('initialAdvancePayment must be number');
        }
      }
      row._isValid = row._errors.length === 0;
      return row;
    });
    return preview;
  }

  async uploadAdmin(user: AuthUser, type: ImportType, fileName: string, fileBuffer: Buffer) {
    const { organizationId, userId } = this.assertAdmin(user);
    return this.createImportJob(organizationId, userId, type, fileName, fileBuffer);
  }

  async uploadSuperadmin(user: AuthUser, organizationId: string, type: ImportType, fileName: string, fileBuffer: Buffer) {
    const { userId } = this.assertSuperadmin(user);
    return this.createImportJob(organizationId, userId, type, fileName, fileBuffer);
  }

  private async createImportJob(organizationId: string, userId: string, type: ImportType, fileName: string, fileBuffer: Buffer) {
    const rows = this.parseBuffer(fileBuffer);
    const preview = this.validateRows(type, rows);
    const validRows = preview.filter((r) => r._isValid).length;
    const invalidRows = preview.length - validRows;
    const status: ImportJobStatus = invalidRows > 0 ? 'FAILED' : 'VALIDATED';
    return this.prisma.importJob.create({
      data: {
        organizationId,
        type,
        fileName,
        status,
        totalRows: preview.length,
        validRows,
        invalidRows,
        errorsJson: { rows: preview },
        createdByUserId: userId,
      },
    });
  }

  async listAdmin(user: AuthUser) {
    const { organizationId } = this.assertAdmin(user);
    return this.prisma.importJob.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' } });
  }

  async previewAdmin(user: AuthUser, id: string) {
    const { organizationId } = this.assertAdmin(user);
    const job = await this.prisma.importJob.findFirst({ where: { id, organizationId } });
    if (!job) throw new NotFoundException('Import job not found');
    return job;
  }

  async previewSuperadmin(user: AuthUser, id: string) {
    this.assertSuperadmin(user);
    const job = await this.prisma.importJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('Import job not found');
    return job;
  }

  private async findOrCreateBuilding(organizationId: string, buildingName: string, address?: string, cadastralNumber?: string, totalFloors?: number) {
    let building = await this.prisma.building.findFirst({
      where: { organizationId, name: buildingName.trim() },
    });
    if (!building) {
      building = await this.prisma.building.create({
        data: {
          organizationId,
          name: buildingName.trim(),
          address: address?.trim() || null,
          cadastralNumber: cadastralNumber?.trim() || null,
          totalFloors: totalFloors || 0,
        },
      });
    }
    return building;
  }

  private async findOrCreateStaircase(organizationId: string, buildingId: string, staircaseName: string, floorsCount = 0) {
    let staircase = await this.prisma.staircase.findFirst({
      where: { organizationId, buildingId, name: staircaseName.trim() },
    });
    if (!staircase) {
      staircase = await this.prisma.staircase.create({
        data: { organizationId, buildingId, name: staircaseName.trim(), floorsCount },
      });
    }
    return staircase;
  }

  private async findApartment(organizationId: string, buildingName: string, apartmentNumber: string) {
    return this.prisma.apartment.findFirst({
      where: {
        organizationId,
        number: apartmentNumber.trim(),
        building: { name: buildingName.trim() },
      },
      include: { building: true, staircase: true },
    });
  }

  async confirmAdmin(user: AuthUser, id: string) {
    const { organizationId } = this.assertAdmin(user);
    return this.confirm(organizationId, id);
  }

  async confirmSuperadmin(user: AuthUser, id: string) {
    this.assertSuperadmin(user);
    const job = await this.prisma.importJob.findUnique({ where: { id }, select: { organizationId: true } });
    if (!job) throw new NotFoundException('Import job not found');
    return this.confirm(job.organizationId, id);
  }

  templateXlsx(type: ImportType) {
    const rowsByType: Record<ImportType, Array<Record<string, any>>> = {
      BUILDINGS: [{ buildingName: 'Bloc A', address: 'Str. Independentei 1', cadastralNumber: 'CAD-123', totalFloors: 9 }],
      STAIRCASES: [{ buildingName: 'Bloc A', staircaseName: 'Scara 1', floorsCount: 9 }],
      APARTMENTS: [{ buildingName: 'Bloc A', staircaseName: 'Scara 1', apartmentNumber: '12', floor: 3, areaM2: 65.5, rooms: 2, status: 'OCCUPIED' }],
      RESIDENTS: [
        {
          apartmentNumber: '12',
          buildingName: 'Bloc A',
          ownerName: 'Ion Popescu',
          ownerEmail: 'ion@example.com',
          ownerPhone: '+37360000001',
          tenantName: 'Ana Ionescu',
          tenantEmail: 'ana@example.com',
          tenantPhone: '+37360000002',
        },
      ],
      INITIAL_BALANCES: [{ apartmentNumber: '12', buildingName: 'Bloc A', initialDebt: 450.5, initialAdvancePayment: 50, note: 'Initial import' }],
    };
    const ws = XLSX.utils.json_to_sheet(rowsByType[type] || []);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    return XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }) as Buffer;
  }

  private async confirm(organizationId: string, id: string) {
    const job = await this.prisma.importJob.findFirst({ where: { id, organizationId } });
    if (!job) throw new NotFoundException('Import job not found');
    const rows = ((job.errorsJson as any)?.rows || []) as PreviewRow[];
    const validRows = rows.filter((r) => r._isValid);
    if (!validRows.length) throw new BadRequestException('No valid rows to import');

    for (const row of validRows) {
      if (job.type === 'BUILDINGS') {
        await this.findOrCreateBuilding(
          organizationId,
          String(row.buildingName),
          String(row.address || ''),
          String(row.cadastralNumber || ''),
          Number(row.totalFloors || 0),
        );
      }
      if (job.type === 'STAIRCASES') {
        const building = await this.findOrCreateBuilding(organizationId, String(row.buildingName), undefined, undefined, Number(row.floorsCount || 0));
        await this.findOrCreateStaircase(organizationId, building.id, String(row.staircaseName), Number(row.floorsCount || 0));
      }
      if (job.type === 'APARTMENTS') {
        const building = await this.findOrCreateBuilding(organizationId, String(row.buildingName));
        const staircase = await this.findOrCreateStaircase(organizationId, building.id, String(row.staircaseName), Number(row.floor || 0));
        const existing = await this.prisma.apartment.findFirst({
          where: { organizationId, staircaseId: staircase.id, number: String(row.apartmentNumber).trim() },
          select: { id: true },
        });
        if (!existing) {
          await this.prisma.apartment.create({
            data: {
              organizationId,
              buildingId: building.id,
              staircaseId: staircase.id,
              number: String(row.apartmentNumber).trim(),
              floor: Number(row.floor),
              areaM2: Number(row.areaM2),
              rooms: row.rooms ? Number(row.rooms) : null,
              status: this.apartmentStatus(row.status),
            },
          });
        }
      }
      if (job.type === 'RESIDENTS') {
        const apartment = await this.findApartment(organizationId, String(row.buildingName), String(row.apartmentNumber));
        if (!apartment) continue;
        const upsertResident = async (name: string, email: string, phone: string, type: ResidentType) => {
          if (!name?.trim()) return;
          let user = email
            ? await this.prisma.user.findFirst({ where: { organizationId, email: email.trim().toLowerCase() } })
            : null;
          if (!user) {
            user = await this.prisma.user.create({
              data: {
                organizationId,
                role: Role.RESIDENT,
                email: email?.trim() ? email.trim().toLowerCase() : `import-${randomUUID()}@local.invalid`,
                firstName: name.trim().split(' ')[0] || name.trim(),
                lastName: name.trim().split(' ').slice(1).join(' ') || null,
              },
            });
          }
          await this.prisma.residentProfile.upsert({
            where: { userId_apartmentId: { userId: user.id, apartmentId: apartment.id } },
            create: {
              organizationId,
              userId: user.id,
              apartmentId: apartment.id,
              type,
              phone: phone?.trim() || null,
              isPrimary: type === ResidentType.OWNER,
            },
            update: {
              type,
              phone: phone?.trim() || null,
            },
          });
        };
        await upsertResident(String(row.ownerName || ''), String(row.ownerEmail || ''), String(row.ownerPhone || ''), ResidentType.OWNER);
        await upsertResident(String(row.tenantName || ''), String(row.tenantEmail || ''), String(row.tenantPhone || ''), ResidentType.TENANT);
      }
      if (job.type === 'INITIAL_BALANCES') {
        const apartment = await this.findApartment(organizationId, String(row.buildingName), String(row.apartmentNumber));
        if (!apartment) continue;
        await this.prisma.initialBalance.upsert({
          where: { organizationId_apartmentId: { organizationId, apartmentId: apartment.id } },
          create: {
            organizationId,
            apartmentId: apartment.id,
            initialDebt: Number(row.initialDebt || 0),
            initialAdvancePayment: Number(row.initialAdvancePayment || 0),
            note: String(row.note || '') || null,
          },
          update: {
            initialDebt: Number(row.initialDebt || 0),
            initialAdvancePayment: Number(row.initialAdvancePayment || 0),
            note: String(row.note || '') || null,
          },
        });
      }
    }

    return this.prisma.importJob.update({ where: { id }, data: { status: 'IMPORTED' } });
  }
}
