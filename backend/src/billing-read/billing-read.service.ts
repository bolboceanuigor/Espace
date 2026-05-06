import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InvoiceStatus, PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

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

  async listInvoices() {
    const invoices = await this.prisma.invoice.findMany({
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { createdAt: 'desc' }],
      select: this.invoiceSelect(),
    });

    return invoices.map((invoice) => this.toInvoice(invoice));
  }

  async createInvoice(body: unknown) {
    const input = this.parseCreateInvoiceBody(body);
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

    if (!organization) throw new NotFoundException('Organization not found');
    if (!apartment) throw new NotFoundException('Apartment not found');

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

  async getInvoice(id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id },
      select: this.invoiceSelect(),
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
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

  async listPayments() {
    const payments = await this.prisma.payment.findMany({
      orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
      select: this.paymentSelect(),
    });

    return payments.map((payment) => this.toPayment(payment));
  }

  async createPayment(body: unknown) {
    const input = this.parseCreatePaymentBody(body);
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

    if (!organization) throw new NotFoundException('Organization not found');
    if (!apartment) throw new NotFoundException('Apartment not found');
    if (input.invoiceId && !invoice) throw new NotFoundException('Invoice not found');

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

  async getPayment(id: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id },
      select: this.paymentSelect(),
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return this.toPayment(payment);
  }

  async getSummary() {
    const [invoices, payments] = await Promise.all([
      this.prisma.invoice.findMany({
        select: {
          amount: true,
          finalAmount: true,
          status: true,
        },
      }),
      this.prisma.payment.findMany({
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
