import { Injectable, NotFoundException } from '@nestjs/common';
import { InvoiceStatus, PaymentStatus, Prisma } from '@prisma/client';
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
}
