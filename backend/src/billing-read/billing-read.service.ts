import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ApartmentStatus, InvoiceStatus, PaymentMethod, PaymentStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { MvpUser } from '../security/mvp-auth.guard';

type SupportedTariffId = 'DESERVIRE_BLOC_PER_M2' | 'FOND_REPARATIE_PER_M2' | 'FOND_DEZVOLTARE_FIXED';

const SUPPORTED_TARIFFS: Record<
  SupportedTariffId,
  {
    name: string;
    calculationType: 'PER_M2' | 'FIXED';
    field: 'maintenanceFeePerM2' | 'repairFundPerM2' | 'developmentFundFixed';
    unit: string;
  }
> = {
  DESERVIRE_BLOC_PER_M2: {
    name: 'Deservire bloc',
    calculationType: 'PER_M2',
    field: 'maintenanceFeePerM2',
    unit: 'MDL/m²',
  },
  FOND_REPARATIE_PER_M2: {
    name: 'Fond reparație',
    calculationType: 'PER_M2',
    field: 'repairFundPerM2',
    unit: 'MDL/m²',
  },
  FOND_DEZVOLTARE_FIXED: {
    name: 'Fond dezvoltare',
    calculationType: 'FIXED',
    field: 'developmentFundFixed',
    unit: 'MDL/apartament',
  },
};

@Injectable()
export class BillingReadService {
  constructor(private readonly prisma: PrismaService) {}

  private invoiceSelect(): Prisma.InvoiceSelect {
    return {
      id: true,
      organizationId: true,
      apartmentId: true,
      month: true,
      year: true,
      amount: true,
      finalAmount: true,
      status: true,
      issuedAt: true,
      paidAt: true,
      dueDate: true,
      createdAt: true,
      updatedAt: true,
      apartment: {
        select: {
          id: true,
          number: true,
          floor: true,
          building: { select: { id: true, name: true } },
          staircase: { select: { id: true, name: true } },
        },
      },
    };
  }

  private paymentSelect(): Prisma.PaymentSelect {
    return {
      id: true,
      organizationId: true,
      apartmentId: true,
      invoiceId: true,
      amount: true,
      currency: true,
      method: true,
      status: true,
      paidAt: true,
      confirmedAt: true,
      month: true,
      note: true,
      createdAt: true,
      updatedAt: true,
      apartment: {
        select: {
          id: true,
          number: true,
          floor: true,
          building: { select: { id: true, name: true } },
          staircase: { select: { id: true, name: true } },
        },
      },
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          month: true,
          year: true,
          totalDue: true,
          status: true,
          dueDate: true,
        },
      },
    };
  }

  private toInvoice(row: any, relatedPayments: any[] = []) {
    return {
      id: row.id,
      organizationId: row.organizationId,
      apartmentId: row.apartmentId,
      apartment: row.apartment
        ? {
            id: row.apartment.id,
            number: row.apartment.number,
            floor: row.apartment.floor,
            building: row.apartment.building,
            staircase: row.apartment.staircase,
          }
        : null,
      apartmentNumber: row.apartment?.number ?? null,
      month: row.month,
      year: row.year,
      amount: Number(row.finalAmount || row.amount || 0),
      originalAmount: Number(row.amount || 0),
      status: row.status,
      issuedAt: row.issuedAt,
      paidAt: row.paidAt,
      dueDate: row.dueDate,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      payments: relatedPayments,
      services: [],
    };
  }

  private toPayment(row: any) {
    return {
      id: row.id,
      organizationId: row.organizationId,
      apartmentId: row.apartmentId,
      invoiceId: row.invoiceId,
      apartment: row.apartment
        ? {
            id: row.apartment.id,
            number: row.apartment.number,
            floor: row.apartment.floor,
            building: row.apartment.building,
            staircase: row.apartment.staircase,
          }
        : null,
      apartmentNumber: row.apartment?.number ?? null,
      invoice: row.invoice ?? null,
      amount: Number(row.amount || 0),
      currency: row.currency,
      method: row.method,
      status: row.status,
      paidAt: row.paidAt ?? row.confirmedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      month: row.month,
      note: row.note,
    };
  }

  private isSuperadmin(user: MvpUser) {
    return String(user.role).toUpperCase() === Role.SUPERADMIN;
  }

  private organizationWhere(user: MvpUser) {
    return this.isSuperadmin(user) ? {} : { organizationId: user.organizationId };
  }

  private assertOrganizationAccess(user: MvpUser, organizationId: string) {
    if (!this.isSuperadmin(user) && organizationId !== user.organizationId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_ORGANIZATION',
        message: 'Nu ai acces la aceste date.',
      });
    }
  }

  private resolveOrganizationId(user: MvpUser, payload?: Record<string, unknown>) {
    if (!this.isSuperadmin(user)) return user.organizationId;
    const requested = typeof payload?.organizationId === 'string' && payload.organizationId.trim() ? payload.organizationId.trim() : user.organizationId;
    if (!requested) {
      throw new BadRequestException('Organizația este obligatorie.');
    }
    return requested;
  }

  private async getOrCreateOrganizationSettings(organizationId: string) {
    return this.prisma.organizationSetting.upsert({
      where: { organizationId },
      update: {},
      create: {
        organizationId,
        appName: 'Espace',
        defaultLocale: 'ro',
        weekStart: 'MONDAY',
      },
    });
  }

  private toTariffRows(settings: {
    organizationId: string;
    maintenanceFeePerM2: number;
    repairFundPerM2: number;
    developmentFundFixed: number;
    updatedAt: Date;
  }) {
    return (Object.entries(SUPPORTED_TARIFFS) as Array<[SupportedTariffId, (typeof SUPPORTED_TARIFFS)[SupportedTariffId]]>).map(
      ([id, config]) => {
        const amount = Number(settings[config.field] || 0);
        return {
          id,
          code: id,
          organizationId: settings.organizationId,
          name: config.name,
          type: config.calculationType,
          calculationType: config.calculationType,
          amount,
          currency: 'MDL',
          unit: config.unit,
          isActive: amount > 0,
          updatedAt: settings.updatedAt,
        };
      },
    );
  }

  async listTariffs(user: MvpUser) {
    const organizationId = this.resolveOrganizationId(user);
    this.assertOrganizationAccess(user, organizationId);
    const settings = await this.getOrCreateOrganizationSettings(organizationId);
    return this.toTariffRows(settings);
  }

  async saveTariff(user: MvpUser, body: unknown, tariffId?: string) {
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const organizationId = this.resolveOrganizationId(user, payload);
    this.assertOrganizationAccess(user, organizationId);
    await this.assertOrganizationExists(organizationId);

    const id = this.resolveTariffId(payload, tariffId);
    const config = SUPPORTED_TARIFFS[id];
    const amount = this.requiredNumber(payload.amount, 'Suma este obligatorie.');
    const isActive = payload.isActive === undefined || payload.isActive === null ? true : Boolean(payload.isActive);

    if (amount < 0) {
      throw new BadRequestException('Suma nu poate fi negativă.');
    }

    const settings = await this.prisma.organizationSetting.upsert({
      where: { organizationId },
      update: {
        [config.field]: isActive ? this.money(amount) : 0,
      },
      create: {
        organizationId,
        [config.field]: isActive ? this.money(amount) : 0,
        appName: 'Espace',
        defaultLocale: 'ro',
        weekStart: 'MONDAY',
      },
    });

    return this.toTariffRows(settings).find((tariff) => tariff.id === id);
  }

  async generateMonthlyInvoices(user: MvpUser, body: unknown) {
    const input = this.parseGenerateMonthlyBody(body);
    const organizationId = this.resolveOrganizationId(user, body && typeof body === 'object' ? (body as Record<string, unknown>) : {});
    this.assertOrganizationAccess(user, organizationId);
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!organization) throw new NotFoundException('Înregistrarea nu a fost găsită.');

    const settings = await this.getOrCreateOrganizationSettings(organizationId);
    const activeTariffs = this.toTariffRows(settings).filter((tariff) => tariff.isActive);
    if (!activeTariffs.length) {
      throw new BadRequestException('Nu există tarife active pentru generarea facturilor.');
    }

    const apartments = await this.prisma.apartment.findMany({
      where: {
        organizationId,
        status: { not: ApartmentStatus.EMPTY },
      },
      select: {
        id: true,
        number: true,
        areaM2: true,
      },
      orderBy: [{ number: 'asc' }],
    });

    let createdInvoicesCount = 0;
    let skippedDuplicatesCount = 0;
    let totalAmount = 0;

    for (const apartment of apartments) {
      const existing = await this.prisma.invoice.findFirst({
        where: {
          organizationId,
          apartmentId: apartment.id,
          month: input.month,
          year: input.year,
        },
        select: { id: true },
      });

      if (existing) {
        skippedDuplicatesCount += 1;
        continue;
      }

      const areaM2 = Number(apartment.areaM2 || 0);
      const lineItems = activeTariffs
        .map((tariff) => {
          const amount = tariff.calculationType === 'PER_M2' ? this.money(areaM2 * tariff.amount) : this.money(tariff.amount);
          return {
            organizationId,
            apartmentId: apartment.id,
            month: input.month,
            year: input.year,
            tariffName: tariff.name,
            amount,
            status: 'PENDING',
            createdByUserId: user.id || null,
          };
        })
        .filter((line) => line.amount > 0);

      const invoiceAmount = this.money(lineItems.reduce((sum, line) => sum + line.amount, 0));
      if (invoiceAmount <= 0) {
        skippedDuplicatesCount += 1;
        continue;
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.monthlyCharge.createMany({
          data: lineItems,
          skipDuplicates: true,
        });
        await tx.invoice.create({
          data: {
            organizationId,
            apartmentId: apartment.id,
            month: input.month,
            year: input.year,
            amount: invoiceAmount,
            finalAmount: invoiceAmount,
            discount: 0,
            plan: 'APC_MONTHLY_TARIFFS',
            status: InvoiceStatus.UNPAID,
            dueDate: input.dueDate,
          },
        });
      });

      createdInvoicesCount += 1;
      totalAmount = this.money(totalAmount + invoiceAmount);
    }

    return {
      createdInvoicesCount,
      skippedDuplicatesCount,
      totalAmount,
      currency: 'MDL',
      month: input.month,
      year: input.year,
      apartmentsProcessed: apartments.length,
      message:
        skippedDuplicatesCount > 0
          ? 'Facturile au fost generate. Unele facturi existau deja și au fost omise.'
          : 'Facturile au fost generate.',
    };
  }

  async getMonthlySummary(user: MvpUser, query: Record<string, unknown>) {
    const month = this.requiredInt(query.month, 'Luna este obligatorie.');
    const year = this.requiredInt(query.year, 'Anul este obligatoriu.');
    const organizationId = this.resolveOrganizationId(user, query);
    this.assertOrganizationAccess(user, organizationId);
    if (month < 1 || month > 12) throw new BadRequestException('Luna nu este validă.');

    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    const [invoices, payments] = await Promise.all([
      this.prisma.invoice.findMany({
        where: { organizationId, month, year },
        select: { amount: true, finalAmount: true, status: true, dueDate: true },
      }),
      this.prisma.payment.findMany({
        where: { organizationId, month: monthKey, status: PaymentStatus.CONFIRMED },
        select: { amount: true },
      }),
    ]);

    const totalIssued = this.money(invoices.reduce((sum, invoice) => sum + Number(invoice.finalAmount || invoice.amount || 0), 0));
    const totalPaid = this.money(payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0));
    const unpaidInvoices = invoices.filter((invoice) => invoice.status === InvoiceStatus.UNPAID || invoice.status === InvoiceStatus.OVERDUE);
    const now = new Date();

    return {
      month,
      year,
      totalIssued,
      totalPaid,
      totalUnpaid: this.money(unpaidInvoices.reduce((sum, invoice) => sum + Number(invoice.finalAmount || invoice.amount || 0), 0)),
      overdueCount: invoices.filter((invoice) => invoice.status === InvoiceStatus.OVERDUE || (invoice.status !== InvoiceStatus.PAID && invoice.dueDate < now)).length,
      invoicesCount: invoices.length,
      currency: 'MDL',
    };
  }

  async listInvoices(user: MvpUser) {
    const invoices = await this.prisma.invoice.findMany({
      where: this.organizationWhere(user),
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { createdAt: 'desc' }],
      select: this.invoiceSelect(),
    });

    return invoices.map((invoice) => this.toInvoice(invoice));
  }

  async createInvoice(user: MvpUser, body: unknown) {
    const input = this.parseCreateInvoiceBody(body);
    if (!this.isSuperadmin(user)) {
      input.organizationId = user.organizationId;
    }
    this.assertOrganizationAccess(user, input.organizationId);
    const [organization, apartment] = await Promise.all([
      this.prisma.organization.findUnique({ where: { id: input.organizationId }, select: { id: true } }),
      this.prisma.apartment.findFirst({
        where: {
          id: input.apartmentId,
          organizationId: input.organizationId,
        },
        select: { id: true },
      }),
    ]);

    if (!organization) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    if (!apartment) throw new NotFoundException('Înregistrarea nu a fost găsită.');

    const duplicate = await this.prisma.invoice.findFirst({
      where: {
        organizationId: input.organizationId,
        apartmentId: input.apartmentId,
        month: input.month,
        year: input.year,
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException('Factura pentru acest apartament și această lună există deja.');
    }

    const invoice = await this.prisma.invoice.create({
      data: {
        organizationId: input.organizationId,
        apartmentId: input.apartmentId,
        month: input.month,
        year: input.year,
        amount: input.amount,
        finalAmount: input.amount,
        plan: 'APARTMENT_MONTHLY',
        status: input.status,
        dueDate: input.dueDate,
      },
      select: this.invoiceSelect(),
    });

    return this.toInvoice(invoice);
  }

  async getInvoice(user: MvpUser, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, ...this.organizationWhere(user) },
      select: this.invoiceSelect(),
    });

    if (!invoice) {
      throw new NotFoundException('Înregistrarea nu a fost găsită.');
    }

    const payments = invoice.apartmentId
      ? await this.prisma.payment.findMany({
          where: { apartmentId: invoice.apartmentId },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: this.paymentSelect(),
        })
      : [];

    return this.toInvoice(invoice, payments.map((payment) => this.toPayment(payment)));
  }

  async listPayments(user: MvpUser) {
    const payments = await this.prisma.payment.findMany({
      where: this.organizationWhere(user),
      orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
      select: this.paymentSelect(),
    });

    return payments.map((payment) => this.toPayment(payment));
  }

  async createPayment(user: MvpUser, body: unknown) {
    const input = this.parseCreatePaymentBody(body);
    if (!this.isSuperadmin(user)) {
      input.organizationId = user.organizationId;
    }
    this.assertOrganizationAccess(user, input.organizationId);
    const [organization, apartment, invoice] = await Promise.all([
      this.prisma.organization.findUnique({ where: { id: input.organizationId }, select: { id: true } }),
      this.prisma.apartment.findFirst({
        where: {
          id: input.apartmentId,
          organizationId: input.organizationId,
        },
        select: { id: true },
      }),
      input.invoiceId
        ? this.prisma.invoice.findFirst({
            where: {
              id: input.invoiceId,
              organizationId: input.organizationId,
              apartmentId: input.apartmentId,
            },
            select: {
              id: true,
              amount: true,
              finalAmount: true,
            },
          })
        : Promise.resolve(null),
    ]);

    if (!organization) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    if (!apartment) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    if (input.invoiceId && !invoice) throw new NotFoundException('Înregistrarea nu a fost găsită.');

    const payment = await this.prisma.payment.create({
      data: {
        organizationId: input.organizationId,
        apartmentId: input.apartmentId,
        amount: input.amount,
        method: input.method,
        status: PaymentStatus.CONFIRMED,
        paidAt: input.paidAt,
        confirmedAt: input.paidAt,
        month: input.month,
        note: input.invoiceId ? `Invoice ${input.invoiceId}` : undefined,
      },
      select: this.paymentSelect(),
    });

    if (invoice && input.amount >= Number(invoice.finalAmount || invoice.amount || 0)) {
      await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          status: InvoiceStatus.PAID,
          paidAt: input.paidAt,
        },
      });
    }

    return this.toPayment(payment);
  }

  async getPayment(user: MvpUser, id: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id, ...this.organizationWhere(user) },
      select: this.paymentSelect(),
    });

    if (!payment) {
      throw new NotFoundException('Înregistrarea nu a fost găsită.');
    }

    return this.toPayment(payment);
  }

  async getSummary(user: MvpUser) {
    const [invoices, payments] = await Promise.all([
      this.prisma.invoice.findMany({
        where: this.organizationWhere(user),
        select: {
          amount: true,
          finalAmount: true,
          status: true,
        },
      }),
      this.prisma.payment.findMany({
        where: this.organizationWhere(user),
        select: {
          amount: true,
          status: true,
        },
      }),
    ]);

    const totalIssued = invoices.reduce((sum, invoice) => sum + Number(invoice.finalAmount || invoice.amount || 0), 0);
    const totalPaid = payments
      .filter((payment) => payment.status === PaymentStatus.CONFIRMED)
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const openInvoices = invoices.filter((invoice) => invoice.status === InvoiceStatus.UNPAID || invoice.status === InvoiceStatus.OVERDUE);

    return {
      totalIssued,
      totalPaid,
      totalDebt: openInvoices.reduce((sum, invoice) => sum + Number(invoice.finalAmount || invoice.amount || 0), 0),
      overdueInvoices: invoices.filter((invoice) => invoice.status === InvoiceStatus.OVERDUE).length,
    };
  }

  private parseCreateInvoiceBody(body: unknown) {
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const organizationId = this.requiredString(payload.organizationId, 'Organizația este obligatorie.');
    const apartmentId = this.requiredString(payload.apartmentId, 'Apartamentul este obligatoriu.');
    const month = this.requiredInt(payload.month, 'Luna este obligatorie.');
    const year = this.requiredInt(payload.year, 'Anul este obligatoriu.');
    const amount = this.requiredNumber(payload.amount, 'Suma este obligatorie.');
    const status = this.optionalEnum(payload.status, InvoiceStatus, InvoiceStatus.UNPAID, 'Statusul facturii nu este valid.');
    const dueDate = this.requiredDate(payload.dueDate, 'Data scadentă este obligatorie.');

    if (month < 1 || month > 12) throw new BadRequestException('Luna nu este validă.');

    return { organizationId, apartmentId, month, year, amount, status, dueDate };
  }

  private parseCreatePaymentBody(body: unknown) {
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const organizationId = this.requiredString(payload.organizationId, 'Organizația este obligatorie.');
    const apartmentId = this.requiredString(payload.apartmentId, 'Apartamentul este obligatoriu.');
    const invoiceId = typeof payload.invoiceId === 'string' && payload.invoiceId.trim() ? payload.invoiceId.trim() : null;
    const amount = this.requiredNumber(payload.amount, 'Suma este obligatorie.');
    const method = this.optionalEnum(payload.method, PaymentMethod, PaymentMethod.CASH, 'Metoda de plată nu este validă.');
    const paidAt =
      typeof payload.paidAt === 'string' && payload.paidAt.trim()
        ? this.requiredDate(payload.paidAt, 'Data plății nu este validă.')
        : new Date();
    const month = `${paidAt.getFullYear()}-${String(paidAt.getMonth() + 1).padStart(2, '0')}`;

    return { organizationId, apartmentId, invoiceId, amount, method, paidAt, month };
  }

  private async assertOrganizationExists(organizationId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!organization) {
      throw new NotFoundException('Înregistrarea nu a fost găsită.');
    }
  }

  private resolveTariffId(payload: Record<string, unknown>, explicitId?: string): SupportedTariffId {
    const raw = String(explicitId || payload.id || payload.code || payload.tariffType || payload.name || '').trim();
    const normalized = raw
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase();

    if (normalized.includes('DESERVIRE') || normalized.includes('INTRETINERE') || normalized.includes('MAINTENANCE')) {
      return 'DESERVIRE_BLOC_PER_M2';
    }
    if (normalized.includes('REPAR')) {
      return 'FOND_REPARATIE_PER_M2';
    }
    if (normalized.includes('DEZVOLT') || normalized.includes('INVEST')) {
      return 'FOND_DEZVOLTARE_FIXED';
    }
    if (normalized in SUPPORTED_TARIFFS) {
      return normalized as SupportedTariffId;
    }

    throw new BadRequestException(
      'Schema curentă permite tarifele Deservire bloc, Fond reparație și Fond dezvoltare. Tarifele extra vor fi adăugate într-o etapă următoare.',
    );
  }

  private parseGenerateMonthlyBody(body: unknown) {
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const month = this.requiredInt(payload.month, 'Luna este obligatorie.');
    const year = this.requiredInt(payload.year, 'Anul este obligatoriu.');
    const dueDate =
      typeof payload.dueDate === 'string' && payload.dueDate.trim()
        ? this.requiredDate(payload.dueDate, 'Data scadentă nu este validă.')
        : new Date(year, month - 1, 25);

    if (month < 1 || month > 12) throw new BadRequestException('Luna nu este validă.');
    if (year < 2000 || year > 2100) throw new BadRequestException('Anul nu este valid.');

    return { month, year, dueDate };
  }

  private money(value: number) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  }

  private requiredString(value: unknown, message: string) {
    if (typeof value !== 'string' || !value.trim()) throw new BadRequestException(message);
    return value.trim();
  }

  private requiredNumber(value: unknown, message: string) {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed)) throw new BadRequestException(message);
    return parsed;
  }

  private requiredInt(value: unknown, message: string) {
    const parsed = this.requiredNumber(value, message);
    if (!Number.isInteger(parsed)) throw new BadRequestException(message);
    return parsed;
  }

  private requiredDate(value: unknown, message: string) {
    if (typeof value !== 'string' || !value.trim()) throw new BadRequestException(message);
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) throw new BadRequestException(message);
    return parsed;
  }

  private optionalEnum<T extends Record<string, string>>(value: unknown, enumValues: T, fallback: T[keyof T], message: string) {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value !== 'string') throw new BadRequestException(message);
    const normalized = value.trim().toUpperCase();
    const allowed = Object.values(enumValues) as string[];
    if (!allowed.includes(normalized)) throw new BadRequestException(message);
    return normalized as T[keyof T];
  }
}
