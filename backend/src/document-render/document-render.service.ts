import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  GeneratedDocumentStatus,
  GeneratedDocumentType,
  InvoiceStatus,
  PaymentStatus,
  Prisma,
  Role,
  SaasInvoiceStatus,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { MvpUser } from '../security/mvp-auth.guard';

const INTERNAL_INVOICE_NOTE_TITLE = 'Internal invoices metadata';
const INTERNAL_PAYMENT_NOTE_PREFIX = 'INTERNAL_INVOICE_PAYMENT:';

type InternalInvoiceMetadata = {
  id: string;
  invoiceId: string;
  associationId: string;
  organizationId: string;
  apartmentId: string;
  invoiceNumber: string;
  billingMonth: string;
  issueDate: string;
  dueDate: string | null;
  status: string;
  currency: string;
  subtotalAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  notes?: string | null;
  apartment?: any;
  primaryContact?: any;
  lines?: any[];
  sourceDraftId?: string | null;
  createdAt?: string;
};

@Injectable()
export class DocumentRenderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getAdminInternalInvoiceDocument(user: MvpUser, id: string) {
    const association = await this.getAssociation(user.organizationId);
    const invoice = await this.findInternalInvoice(user.organizationId, id);
    if (invoice) {
      const payments = await this.internalPaymentRows(user.organizationId, [invoice.invoiceId]);
      return this.internalInvoiceDocument(association, invoice, payments, 'ADMIN');
    }
    return this.legacyInvoiceDocument(user.organizationId, id, association, 'ADMIN');
  }

  async getResidentInternalInvoiceDocument(user: MvpUser, id: string) {
    const apartmentIds = await this.residentApartmentIds(user);
    const association = await this.getAssociation(user.organizationId);
    const invoice = await this.findInternalInvoice(user.organizationId, id);
    if (invoice) {
      this.assertResidentApartment(invoice.apartmentId, apartmentIds);
      const payments = await this.internalPaymentRows(user.organizationId, [invoice.invoiceId]);
      return this.internalInvoiceDocument(association, invoice, payments, 'RESIDENT');
    }
    return this.legacyInvoiceDocument(user.organizationId, id, association, 'RESIDENT', apartmentIds);
  }

  async getAdminPaymentReceiptDocument(user: MvpUser, id: string) {
    const association = await this.getAssociation(user.organizationId);
    const payment = await this.prisma.payment.findFirst({
      where: { id, organizationId: user.organizationId },
      include: this.paymentInclude(),
    });
    if (!payment) throw new NotFoundException('Documentul nu a fost găsit.');
    return this.paymentReceiptDocument(association, payment, await this.invoiceForPayment(user.organizationId, payment), 'ADMIN');
  }

  async getResidentPaymentReceiptDocument(user: MvpUser, id: string) {
    const apartmentIds = await this.residentApartmentIds(user);
    const association = await this.getAssociation(user.organizationId);
    const payment = await this.prisma.payment.findFirst({
      where: { id, organizationId: user.organizationId },
      include: this.paymentInclude(),
    });
    if (!payment) throw new NotFoundException('Documentul nu a fost găsit.');
    this.assertResidentApartment(payment.apartmentId, apartmentIds);
    return this.paymentReceiptDocument(association, payment, await this.invoiceForPayment(user.organizationId, payment), 'RESIDENT');
  }

  async getSuperadminSaasInvoiceDocument(id: string) {
    const invoice = await this.getSaasInvoice(id);
    return this.saasInvoiceDocument(invoice, 'SUPERADMIN');
  }

  async getAdminSaasInvoiceDocument(user: MvpUser, id: string) {
    const invoice = await this.getSaasInvoice(id, user.organizationId);
    return this.saasInvoiceDocument(invoice, 'ADMIN');
  }

  async getSuperadminSaasReceiptDocument(id: string) {
    const invoice = await this.getSaasInvoice(id);
    if (Number(invoice.paidAmount || 0) <= 0) throw new NotFoundException('Documentul nu a fost găsit.');
    return this.saasReceiptDocument(invoice, 'SUPERADMIN');
  }

  async getAdminFinancialReportDocument(user: MvpUser, query: Record<string, unknown>) {
    const association = await this.getAssociation(user.organizationId);
    const invoices = this.filterInvoices(await this.readInternalInvoiceMetadata(user.organizationId), query);
    const invoiceIds = invoices.map((item) => item.invoiceId);
    const payments = await this.internalPaymentRows(user.organizationId, invoiceIds);
    const confirmed = payments.filter((payment) => payment.status === PaymentStatus.CONFIRMED);
    const totalInvoiced = this.money(invoices.filter((item) => this.collectable(item)).reduce((sum, item) => sum + Number(item.totalAmount || 0), 0));
    const totalPaid = this.money(confirmed.reduce((sum, item) => sum + Number(item.amount || 0), 0));
    const outstandingBalance = this.money(invoices.filter((item) => this.collectable(item)).reduce((sum, item) => sum + Number(item.balanceAmount || 0), 0));
    const statuses = ['ISSUED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED', 'VOID'].map((status) => ({
      status,
      count: invoices.filter((item) => item.status === status).length,
      totalAmount: this.money(invoices.filter((item) => item.status === status).reduce((sum, item) => sum + Number(item.totalAmount || 0), 0)),
    }));
    return {
      documentType: GeneratedDocumentType.FINANCIAL_REPORT,
      title: 'Raport financiar lunar',
      fileName: this.buildDocumentFileName(GeneratedDocumentType.FINANCIAL_REPORT, query.billingMonth || 'raport'),
      association,
      period: this.reportPeriod(query),
      generatedAt: new Date().toISOString(),
      summary: {
        totalInvoiced,
        totalPaid,
        outstandingBalance,
        collectionRate: totalInvoiced > 0 ? this.money((totalPaid / totalInvoiced) * 100) : 0,
        invoicesCount: invoices.length,
        confirmedPayments: confirmed.length,
      },
      statusBreakdown: statuses,
      topOutstanding: [...invoices].filter((item) => this.collectable(item)).sort((a, b) => Number(b.balanceAmount || 0) - Number(a.balanceAmount || 0)).slice(0, 10),
      recentInvoices: [...invoices].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()).slice(0, 10),
      recentPayments: payments.slice(0, 10).map((payment) => this.paymentDto(payment)),
    };
  }

  async getMeterConsumptionReportDocument(user: MvpUser, query: Record<string, unknown>) {
    const association = await this.getAssociation(user.organizationId);
    const periodMonth = this.periodMonth(query);
    const { start, end } = this.periodMonthRange(periodMonth);
    const readings = (await this.prisma.meterReading.findMany({
      where: { organizationId: user.organizationId, readingDate: { gte: start, lt: end } },
      include: {
        apartment: { include: { staircase: true, building: true } },
        meter: true,
      },
      orderBy: [{ apartment: { number: 'asc' } }, { createdAt: 'desc' }],
    })) as any[];
    const approved = readings;
    const byType = this.groupConsumption(approved, (item: any) => item.meter?.type || 'OTHER');
    const byStaircase = this.groupConsumption(approved, (item: any) => item.apartment?.staircase?.name || 'Fără scară');
    const missingApartments = await this.missingMeterApartments(user.organizationId, periodMonth);
    return {
      documentType: GeneratedDocumentType.METER_CONSUMPTION_REPORT,
      title: 'Raport consum contoare',
      fileName: this.buildDocumentFileName(GeneratedDocumentType.METER_CONSUMPTION_REPORT, periodMonth),
      association,
      periodMonth,
      generatedAt: new Date().toISOString(),
      summary: {
        readingsCount: readings.length,
        approvedReadingsCount: approved.length,
        submittedReadingsCount: readings.length,
        rejectedReadingsCount: 0,
        missingApartmentsCount: missingApartments.length,
      },
      consumptionByType: byType,
      consumptionByStaircase: byStaircase,
      missingApartments: missingApartments.slice(0, 50),
      issueReadings: readings
        .filter((item) => Number(item.value || 0) < 0)
        .slice(0, 50)
        .map((item) => ({
          id: item.id,
          apartment: this.apartmentDto(item.apartment),
          meterType: item.meter?.type,
          readingValue: item.value,
          consumptionValue: item.value,
          status: 'NEEDS_REVIEW',
          reason: 'Valoare negativă sau suspectă.',
        })),
    };
  }

  async pdfFallback(user: MvpUser, input: { documentType: GeneratedDocumentType; entityType: string; entityId: string; printUrl: string; fileName: string; associationId?: string | null }) {
    await this.prisma.generatedDocument
      .create({
        data: {
          associationId: input.associationId || null,
          generatedById: user.id,
          documentType: input.documentType,
          status: GeneratedDocumentStatus.PREVIEW_ONLY,
          entityType: input.entityType,
          entityId: input.entityId,
          fileName: input.fileName,
          mimeType: 'text/html',
          metadata: { printUrl: input.printUrl, pdfAvailable: false },
          errorMessage: 'PDF binary direct nu este activat pentru MVP.',
        },
      })
      .catch(() => undefined);
    await this.audit
      .createLog({
        associationId: input.associationId || null,
        actorUserId: user.id,
        actorRole: user.role,
        action: 'DOCUMENT_PDF_FAILED',
        entityType: input.entityType,
        entityId: input.entityId,
        title: 'PDF fallback',
        message: 'PDF-ul direct nu este disponibil. A fost returnată pagina print-friendly.',
        severity: 'INFO',
        actionUrl: input.printUrl,
        metadata: { documentType: input.documentType, fileName: input.fileName, printUrl: input.printUrl },
      })
      .catch(() => undefined);
    return {
      available: false,
      printUrl: input.printUrl,
      message: 'PDF direct va fi disponibil ulterior. Folosește pagina print pentru Save as PDF.',
    };
  }

  buildDocumentFileName(type: GeneratedDocumentType, entity: unknown) {
    const safe = String(entity || 'document').trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-|-$/g, '') || 'document';
    return `${type.toLowerCase()}-${safe}.pdf`;
  }

  formatMoney(amount: unknown, currency = 'MDL') {
    return { amount: this.money(Number(amount || 0)), currency };
  }

  formatDate(date: unknown) {
    if (!date) return null;
    const value = date instanceof Date ? date : new Date(String(date));
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  private async getAssociation(id: string) {
    const association = await this.prisma.organization.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        legalName: true,
        fiscalCode: true,
        address: true,
        city: true,
        country: true,
        phone: true,
        email: true,
        logoUrl: true,
        bankName: true,
        bankAccountIban: true,
        bankSwift: true,
        paymentInstructions: true,
      },
    });
    if (!association) throw new NotFoundException('Documentul nu a fost găsit.');
    return this.associationDto(association);
  }

  private associationDto(association: any) {
    return {
      id: association.id,
      shortName: association.name,
      legalName: association.legalName || association.name,
      associationCode: association.fiscalCode || null,
      address: association.address || null,
      city: association.city || null,
      country: association.country || 'MD',
      phone: association.phone || null,
      email: association.email || null,
      logoUrl: association.logoUrl || null,
      bankName: association.bankName || null,
      bankAccountIban: association.bankAccountIban || null,
      bankSwift: association.bankSwift || null,
      paymentInstructions: association.paymentInstructions || null,
    };
  }

  private async readInternalInvoiceMetadata(organizationId: string): Promise<InternalInvoiceMetadata[]> {
    const note = await this.prisma.clientNote.findFirst({
      where: { organizationId, title: INTERNAL_INVOICE_NOTE_TITLE },
      orderBy: { updatedAt: 'desc' },
      select: { content: true },
    });
    if (!note?.content) return [];
    try {
      const parsed = JSON.parse(note.content);
      return Array.isArray(parsed?.items) ? parsed.items : [];
    } catch {
      return [];
    }
  }

  private async findInternalInvoice(organizationId: string, id: string) {
    return (await this.readInternalInvoiceMetadata(organizationId)).find((item) => item.id === id || item.invoiceId === id) || null;
  }

  private internalInvoiceDocument(association: any, invoice: InternalInvoiceMetadata, payments: any[], audience: 'ADMIN' | 'RESIDENT') {
    const lines = (invoice.lines || []).map((line) => ({
      id: line.id,
      lineType: line.lineType,
      name: line.name,
      description: line.description || null,
      calculationType: line.calculationType || null,
      quantity: Number(line.quantity || 0),
      unitPrice: Number(line.unitPrice || 0),
      amount: Number(line.amount || 0),
      formulaLabel: line.formulaLabel || null,
      currency: line.currency || invoice.currency || 'MDL',
    }));
    return {
      documentType: GeneratedDocumentType.INTERNAL_INVOICE,
      title: 'Factură internă',
      fileName: this.buildDocumentFileName(GeneratedDocumentType.INTERNAL_INVOICE, invoice.invoiceNumber || invoice.invoiceId),
      audience,
      association,
      invoice: {
        id: invoice.invoiceId,
        metadataId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        billingMonth: invoice.billingMonth,
        status: this.invoiceDisplayStatus(invoice.status, invoice.dueDate, invoice.balanceAmount),
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        currency: invoice.currency || 'MDL',
        subtotalAmount: Number(invoice.subtotalAmount || invoice.totalAmount || 0),
        totalAmount: Number(invoice.totalAmount || 0),
        paidAmount: Number(invoice.paidAmount || 0),
        balanceAmount: Number(invoice.balanceAmount || 0),
        notes: invoice.notes || null,
        sourceDraftId: audience === 'ADMIN' ? invoice.sourceDraftId || null : null,
        apartment: invoice.apartment || null,
        resident: invoice.primaryContact || null,
      },
      lines,
      payments: payments.map((payment) => this.paymentDto(payment, audience)),
      totals: {
        subtotalAmount: Number(invoice.subtotalAmount || invoice.totalAmount || 0),
        totalAmount: Number(invoice.totalAmount || 0),
        paidAmount: Number(invoice.paidAmount || 0),
        balanceAmount: Number(invoice.balanceAmount || 0),
        currency: invoice.currency || 'MDL',
      },
      generatedAt: new Date().toISOString(),
    };
  }

  private async legacyInvoiceDocument(organizationId: string, id: string, association: any, audience: 'ADMIN' | 'RESIDENT', apartmentIds?: Set<string>) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, organizationId },
      include: {
        apartment: { include: { staircase: true, building: true, residents: true } },
      },
    });
    if (!invoice) throw new NotFoundException('Documentul nu a fost găsit.');
    if (apartmentIds) this.assertResidentApartment(invoice.apartmentId || '', apartmentIds);
    const payments = await this.prisma.payment.findMany({
      where: { organizationId, apartmentId: invoice.apartmentId || undefined, note: this.legacyInvoicePaymentNote(invoice.id) },
      include: this.paymentInclude(),
      orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
    });
    const paidAmount = this.money(payments.filter((item) => item.status === PaymentStatus.CONFIRMED).reduce((sum, item) => sum + Number(item.amount || 0), 0));
    const totalAmount = this.money(Number(invoice.finalAmount || invoice.amount || 0));
    return {
      documentType: GeneratedDocumentType.INTERNAL_INVOICE,
      title: 'Factură internă',
      fileName: this.buildDocumentFileName(GeneratedDocumentType.INTERNAL_INVOICE, invoice.id),
      audience,
      association,
      invoice: {
        id: invoice.id,
        invoiceNumber: `FAC-${invoice.year || '----'}-${String(invoice.month || '').padStart(2, '0')}-${invoice.id.slice(0, 6)}`,
        billingMonth: invoice.month && invoice.year ? `${invoice.year}-${String(invoice.month).padStart(2, '0')}` : null,
        status: this.invoiceDisplayStatus(invoice.status, invoice.dueDate, Math.max(totalAmount - paidAmount, 0)),
        issueDate: invoice.issuedAt,
        dueDate: invoice.dueDate,
        currency: 'MDL',
        subtotalAmount: totalAmount,
        totalAmount,
        paidAmount,
        balanceAmount: this.money(Math.max(totalAmount - paidAmount, 0)),
        apartment: this.apartmentDto(invoice.apartment),
        resident: this.primaryResidentDto(invoice.apartment),
      },
      lines: [
        {
          id: invoice.id,
          lineType: 'TARIFF',
          name: invoice.plan || 'Servicii lunare',
          description: null,
          calculationType: null,
          quantity: 1,
          unitPrice: totalAmount,
          amount: totalAmount,
          formulaLabel: null,
          currency: 'MDL',
        },
      ],
      payments: payments.map((payment) => this.paymentDto(payment, audience)),
      totals: { subtotalAmount: totalAmount, totalAmount, paidAmount, balanceAmount: this.money(Math.max(totalAmount - paidAmount, 0)), currency: 'MDL' },
      generatedAt: new Date().toISOString(),
    };
  }

  private async internalPaymentRows(organizationId: string, invoiceIds?: string[]) {
    const rows = await this.prisma.payment.findMany({
      where: { organizationId, note: { startsWith: INTERNAL_PAYMENT_NOTE_PREFIX } },
      include: this.paymentInclude(),
      orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
    });
    if (!invoiceIds?.length) return rows;
    const allowed = new Set(invoiceIds);
    return rows.filter((row) => {
      const note = this.parseInternalPaymentNote(row.note);
      return note?.invoiceId && allowed.has(note.invoiceId);
    });
  }

  private async invoiceForPayment(organizationId: string, payment: any) {
    const note = this.parseInternalPaymentNote(payment.note);
    if (note?.invoiceId) return this.findInternalInvoice(organizationId, note.invoiceId);
    if (payment.invoice) return null;
    return null;
  }

  private paymentReceiptDocument(association: any, payment: any, invoice: InternalInvoiceMetadata | null, audience: 'ADMIN' | 'RESIDENT') {
    const note = this.parseInternalPaymentNote(payment.note);
    return {
      documentType: GeneratedDocumentType.PAYMENT_RECEIPT,
      title: 'Confirmare plată',
      fileName: this.buildDocumentFileName(GeneratedDocumentType.PAYMENT_RECEIPT, this.paymentNumber(payment)),
      audience,
      association,
      receipt: {
        id: payment.id,
        paymentNumber: this.paymentNumber(payment),
        paymentDate: payment.paidAt || payment.confirmedAt || payment.createdAt,
        amount: Number(payment.amount || 0),
        currency: payment.currency || 'MDL',
        method: note?.method || payment.method,
        referenceNumber: note?.referenceNumber || payment.providerPaymentId || null,
        payerName: note?.payerName || null,
        note: note?.notes || payment.note || null,
        status: payment.status,
        cancellationReason: audience === 'ADMIN' ? note?.cancellationReason || null : null,
        cancelledAt: note?.cancelledAt || null,
        createdBy: audience === 'ADMIN' && payment.createdBy ? this.userDto(payment.createdBy) : null,
      },
      invoice: invoice
        ? {
            id: invoice.invoiceId,
            invoiceNumber: invoice.invoiceNumber,
            billingMonth: invoice.billingMonth,
            apartment: invoice.apartment || null,
            resident: invoice.primaryContact || null,
          }
        : payment.invoice
          ? { id: payment.invoice.id, invoiceNumber: payment.invoice.invoiceNumber || payment.invoice.id, apartment: this.apartmentDto(payment.apartment), resident: this.primaryResidentDto(payment.apartment) }
          : null,
      generatedAt: new Date().toISOString(),
    };
  }

  private async getSaasInvoice(id: string, associationId?: string) {
    const invoice = await this.prisma.saasInvoice.findFirst({
      where: { id, ...(associationId ? { associationId } : {}) },
      include: {
        association: true,
        subscription: true,
        plan: true,
        lines: { orderBy: { createdAt: 'asc' } },
        events: { orderBy: { createdAt: 'desc' }, take: 20, include: { actor: { select: { id: true, firstName: true, lastName: true, fullName: true, email: true } } } },
      },
    });
    if (!invoice) throw new NotFoundException('Documentul nu a fost găsit.');
    return invoice;
  }

  private saasInvoiceDocument(invoice: any, audience: 'SUPERADMIN' | 'ADMIN') {
    return {
      documentType: GeneratedDocumentType.SAAS_INVOICE,
      title: 'Factură abonament Espace',
      fileName: this.buildDocumentFileName(GeneratedDocumentType.SAAS_INVOICE, invoice.invoiceNumber),
      audience,
      seller: {
        name: 'Espace',
        description: 'Platformă SaaS administrare APC',
        email: 'support@example.com',
      },
      association: this.associationDto(invoice.association),
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        status: this.saasDisplayStatus(invoice.status, invoice.dueDate, invoice.balanceAmount),
        billingPeriodStart: invoice.billingPeriodStart,
        billingPeriodEnd: invoice.billingPeriodEnd,
        billingMonth: invoice.billingMonth,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        currency: invoice.currency || 'MDL',
        subtotalAmount: Number(invoice.subtotalAmount || 0),
        discountAmount: Number(invoice.discountAmount || 0),
        taxAmount: Number(invoice.taxAmount || 0),
        totalAmount: Number(invoice.totalAmount || 0),
        paidAmount: Number(invoice.paidAmount || 0),
        balanceAmount: Number(invoice.balanceAmount || 0),
        notes: invoice.notes || null,
        internalNotes: audience === 'SUPERADMIN' ? invoice.internalNotes || null : null,
      },
      subscription: invoice.subscription
        ? { id: invoice.subscription.id, status: invoice.subscription.status, billingCycle: invoice.subscription.billingCycle }
        : null,
      plan: invoice.plan ? { id: invoice.plan.id, code: invoice.plan.code, name: invoice.plan.name } : null,
      lines: invoice.lines.map((line: any) => ({
        id: line.id,
        lineType: line.lineType,
        name: line.name,
        description: line.description || null,
        quantity: Number(line.quantity || 0),
        unitPrice: Number(line.unitPrice || 0),
        amount: Number(line.amount || 0),
        currency: line.currency || invoice.currency || 'MDL',
      })),
      events: audience === 'SUPERADMIN' ? invoice.events || [] : [],
      generatedAt: new Date().toISOString(),
    };
  }

  private saasReceiptDocument(invoice: any, audience: 'SUPERADMIN') {
    return {
      documentType: GeneratedDocumentType.SAAS_PAYMENT_RECEIPT,
      title: 'Confirmare plată abonament Espace',
      fileName: this.buildDocumentFileName(GeneratedDocumentType.SAAS_PAYMENT_RECEIPT, invoice.invoiceNumber),
      audience,
      seller: { name: 'Espace', description: 'Platformă SaaS administrare APC', email: 'support@example.com' },
      association: this.associationDto(invoice.association),
      receipt: {
        id: invoice.id,
        paymentNumber: `SAAS-PAY-${String(invoice.invoiceNumber || invoice.id).replace(/^ESPACE-/, '')}`,
        paymentDate: invoice.paidAt || invoice.updatedAt,
        amount: Number(invoice.paidAmount || 0),
        currency: invoice.currency || 'MDL',
        status: invoice.status,
      },
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        totalAmount: Number(invoice.totalAmount || 0),
        paidAmount: Number(invoice.paidAmount || 0),
        balanceAmount: Number(invoice.balanceAmount || 0),
      },
      generatedAt: new Date().toISOString(),
    };
  }

  private paymentInclude() {
    return {
      apartment: { include: { staircase: true, building: true, residents: true } },
      invoice: true,
      createdBy: { select: { id: true, firstName: true, lastName: true, fullName: true, email: true } },
    } satisfies Prisma.PaymentInclude;
  }

  private parseInternalPaymentNote(note?: string | null): any | null {
    if (!note || !note.startsWith(INTERNAL_PAYMENT_NOTE_PREFIX)) return null;
    try {
      return JSON.parse(note.slice(INTERNAL_PAYMENT_NOTE_PREFIX.length));
    } catch {
      return null;
    }
  }

  private legacyInvoicePaymentNote(invoiceId: string) {
    return `INVOICE:${invoiceId}`;
  }

  private paymentDto(payment: any, audience: 'ADMIN' | 'RESIDENT' = 'ADMIN') {
    const note = this.parseInternalPaymentNote(payment.note);
    return {
      id: payment.id,
      amount: Number(payment.amount || 0),
      currency: payment.currency || 'MDL',
      method: note?.method || payment.method,
      status: payment.status,
      paymentDate: payment.paidAt || payment.confirmedAt || payment.createdAt,
      referenceNumber: note?.referenceNumber || payment.providerPaymentId || null,
      payerName: note?.payerName || null,
      cancellationReason: audience === 'ADMIN' ? note?.cancellationReason || null : null,
    };
  }

  private apartmentDto(apartment: any) {
    if (!apartment) return null;
    return {
      id: apartment.id,
      apartmentNumber: apartment.number || apartment.apartmentNumber || null,
      staircase: apartment.staircase?.name || apartment.staircase || null,
      building: apartment.building?.name || apartment.building || null,
      floor: apartment.floor ?? null,
      areaM2: apartment.areaM2 ?? null,
    };
  }

  private primaryResidentDto(apartment: any) {
    const resident = apartment?.residents?.find((item: any) => item.isPrimary) || apartment?.residents?.[0] || null;
    if (!resident) return null;
    return {
      id: resident.id,
      fullName: [resident.firstName, resident.lastName].filter(Boolean).join(' ').trim() || resident.email || 'Locatar',
      phone: resident.phone || null,
      email: resident.email || null,
    };
  }

  private userDto(user: any) {
    return { id: user.id, fullName: user.fullName || [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email, email: user.email };
  }

  private paymentNumber(payment: any) {
    const date = new Date(payment.paidAt || payment.confirmedAt || payment.createdAt || Date.now());
    const month = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
    return `PAY-${month}-${String(payment.id || '').slice(0, 6).toUpperCase()}`;
  }

  private async residentApartmentIds(user: MvpUser) {
    const profiles = await this.prisma.residentProfile.findMany({
      where: { userId: user.id, organizationId: user.organizationId },
      include: { apartmentResidents: true },
    });
    const ids = new Set<string>();
    profiles.forEach((profile) => {
      if (profile.apartmentId) ids.add(profile.apartmentId);
      profile.apartmentResidents.forEach((item) => ids.add(item.apartmentId));
    });
    if (!ids.size) throw new ForbiddenException('Nu ai acces la acest document.');
    return ids;
  }

  private assertResidentApartment(apartmentId: string, apartmentIds: Set<string>) {
    if (!apartmentIds.has(apartmentId)) throw new ForbiddenException('Nu ai acces la acest document.');
  }

  private collectable(invoice: InternalInvoiceMetadata) {
    return invoice.status !== 'CANCELLED' && invoice.status !== 'VOID';
  }

  private filterInvoices(invoices: InternalInvoiceMetadata[], query: Record<string, unknown>) {
    const billingMonth = typeof query.billingMonth === 'string' && query.billingMonth.trim() ? query.billingMonth.trim() : '';
    return invoices.filter((invoice) => !billingMonth || invoice.billingMonth === billingMonth);
  }

  private reportPeriod(query: Record<string, unknown>) {
    const billingMonth = typeof query.billingMonth === 'string' ? query.billingMonth : null;
    return { billingMonth, dateFrom: query.dateFrom || null, dateTo: query.dateTo || null };
  }

  private periodMonth(query: Record<string, unknown>) {
    if (typeof query.periodMonth === 'string' && query.periodMonth.trim()) return query.periodMonth.trim();
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  private periodMonthRange(periodMonth: string) {
    const [yearRaw, monthRaw] = periodMonth.split('-');
    const year = Number(yearRaw) || new Date().getFullYear();
    const month = Math.min(12, Math.max(1, Number(monthRaw) || new Date().getMonth() + 1));
    return { start: new Date(year, month - 1, 1), end: new Date(year, month, 1) };
  }

  private groupConsumption(readings: any[], keyFn: (item: any) => string) {
    const grouped = new Map<string, { key: string; value: number; unit: string; readingsCount: number }>();
    readings.forEach((reading) => {
      const key = keyFn(reading);
      const current = grouped.get(key) || { key, value: 0, unit: reading.unit || 'unități', readingsCount: 0 };
      current.value = this.money(current.value + Number(reading.consumptionValue ?? reading.value ?? 0));
      current.readingsCount += 1;
      grouped.set(key, current);
    });
    return [...grouped.values()].sort((a, b) => b.value - a.value);
  }

  private async missingMeterApartments(organizationId: string, periodMonth: string) {
    const { start, end } = this.periodMonthRange(periodMonth);
    const meters = (await this.prisma.meter.findMany({
      where: { organizationId, status: 'ACTIVE' },
      include: { apartment: { include: { staircase: true, building: true } }, readings: { where: { readingDate: { gte: start, lt: end } }, select: { id: true } } },
    })) as any[];
    const byApartment = new Map<string, any>();
    meters.forEach((meter) => {
      if (meter.readings.length > 0) return;
      const existing = byApartment.get(meter.apartmentId) || { apartment: this.apartmentDto(meter.apartment), missingMetersCount: 0, meterTypes: [] as string[] };
      existing.missingMetersCount += 1;
      existing.meterTypes.push(meter.type);
      byApartment.set(meter.apartmentId, existing);
    });
    return [...byApartment.values()];
  }

  private invoiceDisplayStatus(status: unknown, dueDate: unknown, balance: unknown) {
    if (String(status) === 'PAID') return 'PAID';
    if (String(status) === 'CANCELLED') return 'CANCELLED';
    if (String(status) === 'VOID') return 'VOID';
    if (Number(balance || 0) > 0 && dueDate && new Date(String(dueDate)) < new Date()) return 'OVERDUE';
    if (String(status) === InvoiceStatus.OVERDUE) return 'OVERDUE';
    return String(status || 'ISSUED');
  }

  private saasDisplayStatus(status: SaasInvoiceStatus, dueDate: unknown, balance: unknown) {
    if ((status === 'ISSUED' || status === 'PARTIALLY_PAID') && Number(balance || 0) > 0 && dueDate && new Date(String(dueDate)) < new Date()) return 'OVERDUE';
    return status;
  }

  private money(value: number) {
    return Number((Number.isFinite(value) ? value : 0).toFixed(2));
  }
}
