import { Injectable, BadRequestException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { parseDateOnly } from '../common/date-only';

type CsvRecord = Record<string, string | number | boolean | null | undefined>;

@Injectable()
export class ExportsService {
  constructor(private readonly prisma: PrismaService) {}

  private maskSensitiveObject(value: any): any {
    if (Array.isArray(value)) return value.map((item) => this.maskSensitiveObject(item));
    if (!value || typeof value !== 'object') return value;
    const out: Record<string, any> = {};
    for (const [key, raw] of Object.entries(value)) {
      const k = key.toLowerCase();
      if (k.includes('password') || k.includes('secret') || k.includes('token') || k.includes('apikey') || k.includes('api_key')) {
        out[key] = '***MASKED***';
      } else {
        out[key] = this.maskSensitiveObject(raw);
      }
    }
    return out;
  }

  private formatDateOnly(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private escapeCsvValue(value: unknown): string {
    if (value == null) return '';
    const stringValue = String(value);
    if (/[",\n]/.test(stringValue)) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  }

  private toCsv(headers: string[], rows: CsvRecord[]): string {
    const lines = [headers.join(',')];
    for (const row of rows) {
      lines.push(headers.map((header) => this.escapeCsvValue(row[header])).join(','));
    }
    return `${lines.join('\n')}\n`;
  }

  private async getScopedPropertyIds(organizationId: string, userId: string, role: Role) {
    if (role === Role.ADMIN || role === Role.SUPERADMIN) return null;
    const rows = await this.prisma.propertyAccess.findMany({
      where: {
        organizationId,
        userId,
        property: { organizationId, deletedAt: null },
      },
      select: { propertyId: true },
    });
    return rows.map((row) => row.propertyId);
  }

  private parseRange(start: string, end: string) {
    if (!start || !end) {
      throw new BadRequestException('start and end query params are required');
    }
    const rangeStart = parseDateOnly(start);
    const rangeEnd = parseDateOnly(end);
    if (rangeStart >= rangeEnd) {
      throw new BadRequestException('start must be before end');
    }
    return { rangeStart, rangeEnd };
  }

  async exportProperties(organizationId: string, userId: string, role: Role): Promise<string> {
    const scopedIds = await this.getScopedPropertyIds(organizationId, userId, role);
    const rows = await this.prisma.property.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(scopedIds ? { id: { in: scopedIds } } : {}),
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        code: true,
        address: true,
        isActive: true,
        status: true,
        createdAt: true,
      },
    });

    return this.toCsv(
      ['id', 'name', 'code', 'address', 'isActive', 'status', 'createdAt'],
      rows.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
      })),
    );
  }

  async exportReservations(
    organizationId: string,
    userId: string,
    role: Role,
    start: string,
    end: string,
  ): Promise<string> {
    const { rangeStart, rangeEnd } = this.parseRange(start, end);
    const scopedIds = await this.getScopedPropertyIds(organizationId, userId, role);
    if (scopedIds && scopedIds.length === 0) {
      return this.toCsv(
        ['propertyCode', 'propertyName', 'guestName', 'checkIn', 'checkOut', 'status', 'source'],
        [],
      );
    }

    const rows = await this.prisma.reservation.findMany({
      where: {
        organizationId,
        deletedAt: null,
        checkIn: { lt: rangeEnd },
        checkOut: { gt: rangeStart },
        ...(scopedIds ? { propertyId: { in: scopedIds } } : {}),
      },
      orderBy: { checkIn: 'asc' },
      select: {
        id: true,
        propertyId: true,
        guestName: true,
        status: true,
        source: true,
        checkIn: true,
        checkOut: true,
        property: { select: { name: true, code: true } },
      },
    });

    return this.toCsv(
      ['propertyCode', 'propertyName', 'guestName', 'checkIn', 'checkOut', 'status', 'source'],
      rows.map((row) => ({
        propertyCode: row.property.code || '',
        propertyName: row.property.name,
        guestName: row.guestName,
        checkIn: this.formatDateOnly(row.checkIn),
        checkOut: this.formatDateOnly(row.checkOut),
        status: row.status.toUpperCase(),
        source: (row.source || 'DIRECT').toUpperCase(),
      })),
    );
  }

  async exportCleanings(
    organizationId: string,
    userId: string,
    role: Role,
    start: string,
    end: string,
  ): Promise<string> {
    const { rangeStart, rangeEnd } = this.parseRange(start, end);
    const scopedIds = await this.getScopedPropertyIds(organizationId, userId, role);
    if (scopedIds && scopedIds.length === 0) {
      return this.toCsv(['reservationId', 'propertyId', 'propertyName', 'guestName', 'date', 'status'], []);
    }

    const rows = await this.prisma.cleaning.findMany({
      where: {
        organizationId,
        date: { gte: rangeStart, lt: rangeEnd },
        ...(scopedIds ? { propertyId: { in: scopedIds } } : {}),
      },
      orderBy: { date: 'asc' },
      select: {
        id: true,
        reservationId: true,
        propertyId: true,
        date: true,
        status: true,
        property: { select: { name: true } },
        reservation: { select: { guestName: true } },
      },
    });

    return this.toCsv(
      ['reservationId', 'propertyId', 'propertyName', 'guestName', 'date', 'status'],
      rows.map((row) => ({
        reservationId: row.reservationId,
        propertyId: row.propertyId,
        propertyName: row.property.name,
        guestName: row.reservation?.guestName || '',
        date: row.date.toISOString().slice(0, 10),
        status: row.status.toUpperCase(),
      })),
    );
  }

  async exportClients(organizationId: string, userId: string, role: Role): Promise<string> {
    const scopedIds = await this.getScopedPropertyIds(organizationId, userId, role);
    let clientIds: string[] | null = null;
    if (scopedIds) {
      const links = await this.prisma.reservation.findMany({
        where: {
          organizationId,
          deletedAt: null,
          propertyId: { in: scopedIds },
          clientId: { not: null },
        },
        select: { clientId: true },
      });
      clientIds = links
        .map((row) => row.clientId)
        .filter((id): id is string => Boolean(id));
    }

    const rows = await this.prisma.client.findMany({
      where: {
        organizationId,
        deletedAt: null,
        isArchived: false,
        ...(clientIds ? { id: { in: clientIds } } : {}),
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        notes: true,
        createdAt: true,
      },
    });

    return this.toCsv(
      ['id', 'firstName', 'lastName', 'phone', 'email', 'notes', 'createdAt'],
      rows.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
      })),
    );
  }

  async exportOrganizationBackup(
    organizationId: string,
    actorUserId: string,
    actorRole: Role | string,
    includeAuditLogs = true,
  ) {
    const role = String(actorRole || '').toUpperCase();
    if (!['ADMIN', 'SUPERADMIN', 'SUPER_ADMIN'].includes(role)) {
      throw new BadRequestException('Not allowed to export backups');
    }

    const [
      organization,
      organizationSettings,
      buildings,
      staircases,
      apartments,
      residentProfiles,
      monthlyCharges,
      payments,
      invoices,
      issues,
      announcements,
      documents,
      paymentProviderConfigs,
      auditLogs,
    ] = await Promise.all([
      this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
          id: true,
          name: true,
          legalName: true,
          fiscalCode: true,
          address: true,
          phone: true,
          email: true,
          website: true,
          bankName: true,
          bankAccountIban: true,
          bankSwift: true,
          paymentInstructions: true,
          treasurerName: true,
          administratorName: true,
          logoUrl: true,
          primaryColor: true,
          invoicePrefix: true,
          receiptPrefix: true,
          defaultCurrency: true,
          onboardingStatus: true,
          onboardingStep: true,
          onboardingCompletedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.organizationSetting.findUnique({ where: { organizationId } }),
      this.prisma.building.findMany({ where: { organizationId }, orderBy: { createdAt: 'asc' } }),
      this.prisma.staircase.findMany({ where: { organizationId }, orderBy: { createdAt: 'asc' } }),
      this.prisma.apartment.findMany({ where: { organizationId }, orderBy: [{ buildingId: 'asc' }, { number: 'asc' }] }),
      this.prisma.residentProfile.findMany({
        where: { organizationId },
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
        },
      }),
      this.prisma.monthlyCharge.findMany({ where: { organizationId }, orderBy: [{ year: 'desc' }, { month: 'desc' }] }),
      this.prisma.payment.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.residentInvoice.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.issue.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.announcement.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.document.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.paymentProviderConfig.findMany({ where: { organizationId }, orderBy: { provider: 'asc' } }),
      includeAuditLogs
        ? this.prisma.auditLog.findMany({
            where: { organizationId },
            orderBy: { createdAt: 'desc' },
            take: 2000,
          })
        : Promise.resolve([]),
    ]);

    if (!organization) {
      throw new BadRequestException('Organization not found');
    }

    const tariffs = Array.from(new Set(monthlyCharges.map((row) => row.tariffName)))
      .sort()
      .map((tariffName) => ({ tariffName }));

    const maskedProviderConfigs = paymentProviderConfigs.map((cfg) => ({
      ...cfg,
      configJson: this.maskSensitiveObject(cfg.configJson),
    }));

    const payload = {
      meta: {
        exportedAt: new Date().toISOString(),
        exportedByUserId: actorUserId,
        actorRole: role,
        organizationId,
        includeAuditLogs,
        format: 'JSON',
      },
      organization,
      organizationSettings,
      buildings,
      staircases,
      apartments,
      residents: residentProfiles,
      tariffs,
      charges: monthlyCharges,
      payments,
      invoices,
      issues,
      announcements,
      documentsMetadata: documents,
      paymentProviderConfigs: maskedProviderConfigs,
      auditLogs: includeAuditLogs ? auditLogs : undefined,
    };

    await this.prisma.auditLog.create({
      data: {
        organizationId,
        userId: actorUserId,
        action: 'BACKUP_EXPORT',
        entityType: 'OrganizationBackup',
        description: `Exported organization backup (${includeAuditLogs ? 'with' : 'without'} audit logs)`,
        newValuesJson: {
          includeAuditLogs,
          totals: {
            buildings: buildings.length,
            apartments: apartments.length,
            residents: residentProfiles.length,
            charges: monthlyCharges.length,
            payments: payments.length,
            invoices: invoices.length,
            issues: issues.length,
            announcements: announcements.length,
            documents: documents.length,
            auditLogs: includeAuditLogs ? auditLogs.length : 0,
          },
        },
      },
    });

    return payload;
  }
}
