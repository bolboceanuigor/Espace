import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  InvoiceStatus,
  IssueCategory,
  IssueLocationType,
  IssuePriority,
  IssueStatus,
  MeterReadingSource,
  MeterStatus,
  NotificationType,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityMvpService } from '../activity-mvp/activity-mvp.service';
import type { MvpUser } from '../security/mvp-auth.guard';

type InternalInvoiceStatus = 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED' | 'VOID';
type InternalInvoiceLineMetadata = {
  id: string;
  sourceDraftLineId: string | null;
  tariffId: string | null;
  lineType: 'TARIFF' | 'MANUAL_ADJUSTMENT' | 'DISCOUNT' | 'CORRECTION';
  name: string;
  description: string;
  calculationType: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  currency: 'MDL';
  formulaLabel: string;
};
type InternalInvoiceMetadata = {
  id: string;
  invoiceId: string;
  associationId: string;
  organizationId: string;
  apartmentId: string;
  primaryContactId: string | null;
  sourceDraftId: string;
  invoiceNumber: string;
  billingMonth: string;
  issueDate: string;
  dueDate: string | null;
  status: InternalInvoiceStatus;
  currency: 'MDL';
  subtotalAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  notes: string;
  apartment: {
    id: string;
    apartmentNumber: string;
    staircase: string;
    floor: string | null;
  };
  primaryContact: { id: string; fullName: string; phone: string | null } | null;
  lines: InternalInvoiceLineMetadata[];
  createdById: string;
  createdAt: string;
  updatedAt: string;
};
type InternalPaymentNote = {
  version: 1;
  kind: 'INTERNAL_INVOICE_PAYMENT';
  invoiceId: string;
  invoiceMetadataId: string;
  invoiceNumber: string;
  billingMonth: string;
  method: string;
  referenceNumber: string;
  payerName: string;
  notes: string;
  cancellationReason?: string;
};

const INTERNAL_INVOICE_NOTE_TITLE = 'Internal invoices metadata';
const INTERNAL_PAYMENT_NOTE_PREFIX = 'INTERNAL_INVOICE_PAYMENT:';

@Injectable()
export class ResidentDemoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityMvpService,
  ) {}

  private apartmentSelect(): Prisma.ApartmentSelect {
    return {
      id: true,
      organizationId: true,
      number: true,
      floor: true,
      areaM2: true,
      rooms: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      building: { select: { id: true, name: true, address: true } },
      staircase: { select: { id: true, name: true } },
    };
  }

  private residentProfileSelect(): Prisma.ResidentProfileSelect {
    return {
      id: true,
      userId: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      accountStatus: true,
      type: true,
      isPrimary: true,
      apartment: {
        select: this.apartmentSelect(),
      },
      apartmentResidents: {
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        select: {
          role: true,
          isPrimary: true,
          apartment: {
            select: this.apartmentSelect(),
          },
        },
      },
    };
  }

  private safeUser(user: MvpUser) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      organizationId: user.organizationId,
    };
  }

  private toResident(profile: any) {
    if (!profile) return null;
    return {
      id: profile.id,
      firstName: profile.firstName,
      lastName: profile.lastName,
      name: this.fullName(profile),
      phone: profile.phone,
      email: profile.email,
      accountStatus: profile.accountStatus,
    };
  }

  private roleFromResidentType(type?: string | null) {
    if (type === 'OWNER' || type === 'TENANT' || type === 'RESIDENT') return type;
    return 'REPRESENTATIVE';
  }

  private addScopedApartment(
    map: Map<string, any>,
    apartment: any,
    profile: any,
    relationRole: string,
    isPrimary: boolean,
  ) {
    if (!apartment?.id) return;
    const existing = map.get(apartment.id);
    if (existing?.isPrimary && !isPrimary) return;
    map.set(apartment.id, {
      ...apartment,
      relationRole,
      isPrimary,
      resident: this.toResident(profile),
    });
  }

  private async getResidentScope(user: MvpUser) {
    const profiles = await this.prisma.residentProfile.findMany({
      where: {
        organizationId: user.organizationId,
        userId: user.id,
      },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      select: this.residentProfileSelect(),
    });

    const apartmentsById = new Map<string, any>();
    for (const profile of profiles as any[]) {
      for (const relation of profile.apartmentResidents || []) {
        this.addScopedApartment(apartmentsById, relation.apartment, profile, String(relation.role), Boolean(relation.isPrimary));
      }
      if (profile.apartment) {
        this.addScopedApartment(
          apartmentsById,
          profile.apartment,
          profile,
          this.roleFromResidentType(profile.type),
          Boolean(profile.isPrimary),
        );
      }
    }

    const apartments = Array.from(apartmentsById.values()).sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
      return String(a.number).localeCompare(String(b.number), 'ro', { numeric: true });
    });
    const primaryApartment = apartments.find((apartment) => apartment.isPrimary) ?? apartments[0] ?? null;
    const primaryResident =
      primaryApartment?.resident ??
      this.toResident(profiles.find((profile) => profile.isPrimary) ?? profiles[0]) ??
      null;

    return {
      user: this.safeUser(user),
      resident: primaryResident,
      residentProfiles: profiles.map((profile) => this.toResident(profile)).filter(Boolean),
      apartments,
      apartmentIds: apartments.map((apartment) => apartment.id),
      primaryApartment,
    };
  }

  private async requireResidentScope(user: MvpUser) {
    const scope = await this.getResidentScope(user);
    if (!scope.primaryApartment) {
      throw new ForbiddenException({
        code: 'RESIDENT_APARTMENT_NOT_LINKED',
        message: 'Contul tău nu este conectat încă la un apartament.',
      });
    }
    return scope;
  }

  private requireApartmentFromScope(scope: Awaited<ReturnType<ResidentDemoService['requireResidentScope']>>, apartmentId?: unknown) {
    if (typeof apartmentId === 'string' && apartmentId.trim()) {
      const requested = scope.apartments.find((apartment) => apartment.id === apartmentId.trim());
      if (!requested) {
        throw new ForbiddenException({
          code: 'FORBIDDEN_RESIDENT_SCOPE',
          message: 'Nu ai acces la aceste date.',
        });
      }
      return requested;
    }
    return scope.primaryApartment;
  }

  private async getResidentApartment(user: MvpUser) {
    const scope = await this.requireResidentScope(user);
    const apartment = this.requireApartmentFromScope(scope);
    return {
      ...apartment,
      apartmentResidents: [
        {
          role: apartment.relationRole,
          isPrimary: apartment.isPrimary,
          resident: apartment.resident,
        },
      ],
    };
  }

  private async requireResidentApartment(user: MvpUser) {
    return this.getResidentApartment(user);
  }

  private emptyResidentMessage() {
    return 'Contul tău nu este conectat încă la un apartament.';
  }

  private async organizationFromUser(user: MvpUser) {
    return this.prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: {
        id: true,
        name: true,
        legalName: true,
        fiscalCode: true,
        address: true,
        bankName: true,
        bankAccountIban: true,
        bankSwift: true,
        paymentInstructions: true,
        administratorName: true,
      },
    });
  }

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
      dueDate: true,
      paidAt: true,
      createdAt: true,
      updatedAt: true,
      apartment: {
        select: {
          id: true,
          number: true,
          staircase: { select: { id: true, name: true } },
          building: { select: { id: true, name: true } },
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

  private meterSelect(): Prisma.MeterSelect {
    return {
      id: true,
      type: true,
      serialNumber: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      readings: {
        orderBy: { readingDate: 'desc' },
        take: 3,
        select: {
          id: true,
          value: true,
          readingDate: true,
          source: true,
          createdAt: true,
        },
      },
      apartment: {
        select: {
          id: true,
          number: true,
        },
      },
    };
  }

  private issueSelect(): Prisma.IssueSelect {
    return {
      id: true,
      organizationId: true,
      apartmentId: true,
      residentId: true,
      title: true,
      description: true,
      category: true,
      priority: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      apartment: { select: { id: true, number: true } },
      resident: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
    };
  }

  private announcementSelect(): Prisma.AnnouncementSelect {
    return {
      id: true,
      organizationId: true,
      title: true,
      content: true,
      category: true,
      status: true,
      targetType: true,
      createdAt: true,
      updatedAt: true,
    };
  }

  private fullName(person?: { firstName?: string | null; lastName?: string | null; email?: string | null } | null) {
    return `${person?.firstName || ''} ${person?.lastName || ''}`.trim() || person?.email || null;
  }

  private invoicePaymentNote(invoiceId: string) {
    return `Invoice ${invoiceId}`;
  }

  private parseInternalPaymentNote(note?: string | null): InternalPaymentNote | null {
    if (!note || !note.startsWith(INTERNAL_PAYMENT_NOTE_PREFIX)) return null;
    try {
      const parsed = JSON.parse(note.slice(INTERNAL_PAYMENT_NOTE_PREFIX.length));
      if (parsed?.kind !== 'INTERNAL_INVOICE_PAYMENT' || !parsed.invoiceId) return null;
      return {
        version: 1,
        kind: 'INTERNAL_INVOICE_PAYMENT',
        invoiceId: String(parsed.invoiceId),
        invoiceMetadataId: String(parsed.invoiceMetadataId || parsed.invoiceId),
        invoiceNumber: String(parsed.invoiceNumber || ''),
        billingMonth: String(parsed.billingMonth || ''),
        method: String(parsed.method || ''),
        referenceNumber: String(parsed.referenceNumber || ''),
        payerName: String(parsed.payerName || ''),
        notes: String(parsed.notes || ''),
        cancellationReason: parsed.cancellationReason ? String(parsed.cancellationReason) : undefined,
      };
    } catch {
      return null;
    }
  }

  private money(value: number) {
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
  }

  private invoiceAmount(row: { finalAmount?: number | null; amount?: number | null }) {
    return Number(row.finalAmount || row.amount || 0);
  }

  private confirmedPaymentTotal(payments: any[]) {
    return this.money(
      (payments || [])
        .filter((payment) => payment.status === PaymentStatus.CONFIRMED || String(payment.status).toUpperCase() === 'CONFIRMED')
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    );
  }

  private remainingDebtForInvoice(row: { status?: InvoiceStatus; finalAmount?: number | null; amount?: number | null }, payments: any[] = []) {
    if (row.status === InvoiceStatus.PAID) return 0;
    return this.money(Math.max(this.invoiceAmount(row) - this.confirmedPaymentTotal(payments), 0));
  }

  private toInvoice(row: any, relatedPayments: any[] = [], services: any[] = []) {
    const paidAmount = this.confirmedPaymentTotal(relatedPayments);
    const remainingAmount = this.remainingDebtForInvoice(row, relatedPayments);
    const status =
      row.status !== InvoiceStatus.PAID && remainingAmount > 0 && row.dueDate && new Date(row.dueDate) < new Date()
        ? InvoiceStatus.OVERDUE
        : row.status;
    return {
      id: row.id,
      organizationId: row.organizationId,
      apartmentId: row.apartmentId,
      apartmentNumber: row.apartment?.number ?? null,
      apartment: row.apartment ?? null,
      month: row.month,
      year: row.year,
      amount: Number(row.finalAmount || row.amount || 0),
      originalAmount: Number(row.amount || 0),
      status,
      dueDate: row.dueDate,
      paidAt: row.paidAt,
      paidAmount,
      remainingAmount,
      remainingDebt: remainingAmount,
      payments: relatedPayments,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      services: services.map((service) => ({
        id: service.id,
        name: service.tariffName ?? service.name ?? 'Serviciu',
        tariffName: service.tariffName ?? service.name ?? 'Serviciu',
        amount: Number(service.amount || 0),
      })),
    };
  }

  private toPayment(row: any) {
    const internalNote = this.parseInternalPaymentNote(row.note);
    const noteInvoiceId =
      typeof row.note === 'string' && row.note.startsWith('Invoice ')
        ? row.note.replace('Invoice ', '').trim()
        : null;
    const linkedInvoice = row.invoice
      ? {
          id: row.invoice.id,
          invoiceNumber: row.invoice.invoiceNumber,
          month: row.invoice.month,
          year: row.invoice.year,
          totalDue: Number(row.invoice.totalDue || 0),
          status: row.invoice.status,
          dueDate: row.invoice.dueDate,
        }
      : null;
    return {
      id: row.id,
      organizationId: row.organizationId,
      apartmentId: row.apartmentId,
      invoiceId: row.invoiceId ?? internalNote?.invoiceId ?? noteInvoiceId,
      invoiceNumber: internalNote?.invoiceNumber ?? linkedInvoice?.invoiceNumber ?? null,
      billingMonth: internalNote?.billingMonth ?? null,
      invoiceMonth: linkedInvoice?.month ?? null,
      invoiceYear: linkedInvoice?.year ?? null,
      invoice: linkedInvoice,
      apartmentNumber: row.apartment?.number ?? null,
      amount: Number(row.amount || 0),
      currency: row.currency,
      method: internalNote?.method ?? row.method,
      status: row.status,
      paidAt: row.paidAt ?? row.confirmedAt,
      month: row.month,
      note: internalNote?.notes || row.note,
      referenceNumber: internalNote?.referenceNumber || '',
      payerName: internalNote?.payerName || '',
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private toPaymentInstructions(organization: any) {
    const bankName = organization?.bankName ?? null;
    const bankAccountIban = organization?.bankAccountIban ?? null;
    const bankSwift = organization?.bankSwift ?? null;
    const paymentInstructions = organization?.paymentInstructions ?? null;
    const administratorName = organization?.administratorName ?? null;
    return {
      bankName,
      bankAccountIban,
      bankSwift,
      paymentInstructions,
      administratorName,
      configured: Boolean(bankName || bankAccountIban || bankSwift || paymentInstructions),
    };
  }

  private toMeter(row: any) {
    const lastReading = row.readings?.[0] ?? null;
    return {
      id: row.id,
      apartmentId: row.apartment?.id ?? null,
      apartmentNumber: row.apartment?.number ?? null,
      type: row.type,
      serialNumber: row.serialNumber,
      status: row.status,
      lastReading,
      readings: row.readings || [],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private toIssue(row: any) {
    return {
      id: row.id,
      organizationId: row.organizationId,
      apartmentId: row.apartmentId,
      apartmentNumber: row.apartment?.number ?? null,
      residentId: row.residentId,
      residentName: this.fullName(row.resident),
      title: row.title,
      description: row.description,
      preview: row.description?.length > 140 ? `${row.description.slice(0, 140).trim()}...` : row.description,
      category: row.category,
      priority: row.priority,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private toAnnouncement(row: any) {
    return {
      id: row.id,
      organizationId: row.organizationId,
      title: row.title,
      content: row.content,
      preview: row.content?.length > 140 ? `${row.content.slice(0, 140).trim()}...` : row.content,
      category: row.category,
      status: row.status,
      audience: row.targetType,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private toOrganizationIdentity(organization: any) {
    const associationCode = typeof organization?.fiscalCode === 'string' ? organization.fiscalCode : '';
    return {
      id: organization?.id ?? null,
      shortName: organization?.name || (associationCode ? `A.P.C. ${associationCode}` : 'A.P.C.'),
      legalName:
        organization?.legalName ||
        (associationCode ? `Asociația de Proprietari din Condominiu ${associationCode}` : 'Asociația de Proprietari din Condominiu'),
      associationCode: associationCode || null,
      associationNumber: associationCode.match(/-(\d{4})$/)?.[1] || null,
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

  private isInternalInvoiceOverdue(invoice: Pick<InternalInvoiceMetadata, 'dueDate' | 'balanceAmount' | 'status'>) {
    if (!invoice.dueDate) return false;
    if (invoice.status === 'PAID' || invoice.status === 'CANCELLED' || invoice.status === 'VOID') return false;
    return Number(invoice.balanceAmount || 0) > 0 && new Date(invoice.dueDate) < new Date();
  }

  private residentInvoiceStats(items: InternalInvoiceMetadata[]) {
    return {
      totalInvoices: items.length,
      totalAmount: this.money(items.reduce((sum, invoice) => sum + Number(invoice.totalAmount || 0), 0)),
      paidAmount: this.money(items.reduce((sum, invoice) => sum + Number(invoice.paidAmount || 0), 0)),
      balanceAmount: this.money(items.reduce((sum, invoice) => sum + Number(invoice.balanceAmount || 0), 0)),
      unpaidInvoices: items.filter((invoice) => Number(invoice.balanceAmount || 0) > 0 && invoice.status !== 'CANCELLED' && invoice.status !== 'VOID').length,
      paidInvoices: items.filter((invoice) => invoice.status === 'PAID' || Number(invoice.balanceAmount || 0) <= 0).length,
      overdueInvoices: items.filter((invoice) => this.isInternalInvoiceOverdue(invoice)).length,
    };
  }

  private toResidentInternalInvoiceListItem(invoice: InternalInvoiceMetadata, association: any) {
    return {
      id: invoice.invoiceId || invoice.id,
      metadataId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      billingMonth: invoice.billingMonth,
      apartment: invoice.apartment,
      association: this.toOrganizationIdentity(association),
      status: invoice.status,
      currency: invoice.currency,
      totalAmount: Number(invoice.totalAmount || 0),
      paidAmount: Number(invoice.paidAmount || 0),
      balanceAmount: Number(invoice.balanceAmount || 0),
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      isOverdue: this.isInternalInvoiceOverdue(invoice),
    };
  }

  private parseResidentInvoiceQuery(query: Record<string, unknown>) {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
    const billingMonth = typeof query.billingMonth === 'string' && /^\d{4}-\d{2}$/.test(query.billingMonth) ? query.billingMonth : '';
    const status = typeof query.status === 'string' ? query.status.trim().toUpperCase() : '';
    const sortBy = typeof query.sortBy === 'string' ? query.sortBy : 'newest';
    const sortDirection: 'asc' | 'desc' = String(query.sortDirection || '').toLowerCase() === 'asc' ? 'asc' : 'desc';
    const apartmentId = typeof query.apartmentId === 'string' ? query.apartmentId.trim() : '';
    const unpaidOnly = query.unpaidOnly === true || String(query.unpaidOnly || '').toLowerCase() === 'true';
    const overdueOnly = query.overdueOnly === true || String(query.overdueOnly || '').toLowerCase() === 'true';
    return { page, limit, billingMonth, status, sortBy, sortDirection, apartmentId, unpaidOnly, overdueOnly };
  }

  private apartmentOptionsFromScope(scope: Awaited<ReturnType<ResidentDemoService['getResidentScope']>>) {
    return scope.apartments.map((apartment) => ({
      id: apartment.id,
      apartmentNumber: apartment.number,
      staircase: apartment.staircase?.name ?? null,
      floor: apartment.floor === null || apartment.floor === undefined ? null : String(apartment.floor),
      areaM2: apartment.areaM2 ?? null,
      isPrimary: Boolean(apartment.isPrimary),
    }));
  }

  private toPrimaryApartment(apartment: any) {
    if (!apartment) return null;
    return {
      id: apartment.id,
      number: apartment.number,
      staircase: apartment.staircase?.name ?? null,
      building: apartment.building?.name ?? null,
      floor: apartment.floor,
      areaM2: apartment.areaM2,
      rooms: apartment.rooms,
      relationRole: apartment.relationRole,
    };
  }

  private toDashboardApartment(apartment: any) {
    if (!apartment) return null;
    return {
      id: apartment.id,
      apartmentNumber: String(apartment.number || ''),
      staircase: apartment.staircase?.name ?? null,
      building: apartment.building?.name ?? null,
      floor: apartment.floor === null || apartment.floor === undefined ? null : String(apartment.floor),
      areaM2: apartment.areaM2 ?? null,
      rooms: apartment.rooms ?? null,
      status: this.residentApartmentStatus(apartment.status),
      updatedAt: apartment.updatedAt ?? null,
      role: apartment.relationRole ?? 'RESIDENT',
      isPrimaryContact: Boolean(apartment.isPrimary),
    };
  }

  private residentApartmentStatus(status?: string | null) {
    if (status === 'EMPTY') return 'VACANT';
    if (status === 'OCCUPIED' || status === 'ACTIVE') return 'OCCUPIED';
    return 'UNKNOWN';
  }

  private residentAccountStatus(status?: string | null) {
    if (status === 'INVITED') return 'INVITED';
    if (status === 'CREATED') return 'ACTIVE';
    if (status === 'NO_ACCOUNT') return 'NOT_INVITED';
    return 'NOT_INVITED';
  }

  private dashboardInvoiceItem(invoice: InternalInvoiceMetadata) {
    return {
      id: invoice.invoiceId || invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      billingMonth: invoice.billingMonth,
      apartmentId: invoice.apartmentId,
      apartmentNumber: invoice.apartment.apartmentNumber,
      totalAmount: Number(invoice.totalAmount || 0),
      paidAmount: Number(invoice.paidAmount || 0),
      balanceAmount: Number(invoice.balanceAmount || 0),
      status: invoice.status,
      dueDate: invoice.dueDate,
      issueDate: invoice.issueDate,
      isOverdue: this.isInternalInvoiceOverdue(invoice),
    };
  }

  private async residentFinancialData(user: MvpUser, scope: Awaited<ReturnType<ResidentDemoService['getResidentScope']>>, organization: any) {
    const metadata = await this.readInternalInvoiceMetadata(user.organizationId);
    const scopedInvoices = metadata.filter((invoice) => scope.apartmentIds.includes(invoice.apartmentId));
    const allInvoiceById = new Map(scopedInvoices.map((invoice) => [invoice.invoiceId, invoice]));
    const paymentsRows = await this.prisma.payment.findMany({
      where: {
        organizationId: user.organizationId,
        apartmentId: { in: scope.apartmentIds },
        note: { startsWith: INTERNAL_PAYMENT_NOTE_PREFIX },
      },
      orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
      select: this.paymentSelect(),
    });
    const scopedPayments = paymentsRows
      .map((row) => {
        const note = this.parseInternalPaymentNote(row.note);
        const invoice = note ? allInvoiceById.get(note.invoiceId) : null;
        return invoice ? this.toResidentPaymentItem(row, invoice, organization) : null;
      })
      .filter(Boolean) as Array<ReturnType<ResidentDemoService['toResidentPaymentItem']>>;
    return { scopedInvoices, scopedPayments };
  }

  private apartmentFinancialSummary(
    apartmentId: string,
    invoices: InternalInvoiceMetadata[],
    payments: Array<ReturnType<ResidentDemoService['toResidentPaymentItem']>>,
  ) {
    const apartmentInvoices = invoices.filter((invoice) => invoice.apartmentId === apartmentId);
    const activeInvoices = apartmentInvoices.filter((invoice) => invoice.status !== 'CANCELLED' && invoice.status !== 'VOID');
    const unpaidInvoices = activeInvoices.filter((invoice) => Number(invoice.balanceAmount || 0) > 0);
    const confirmedPayments = payments.filter((payment) => payment.apartment.id === apartmentId && String(payment.status).toUpperCase() === 'CONFIRMED');
    const lastInvoice = [...apartmentInvoices].sort((a, b) => {
      const left = new Date(a.issueDate || a.createdAt || 0).getTime();
      const right = new Date(b.issueDate || b.createdAt || 0).getTime();
      return right - left;
    })[0];
    const lastPayment = [...confirmedPayments].sort((a, b) => {
      const left = new Date(a.paymentDate || a.createdAt || 0).getTime();
      const right = new Date(b.paymentDate || b.createdAt || 0).getTime();
      return right - left;
    })[0];
    return {
      currency: 'MDL',
      currentBalance: this.money(activeInvoices.reduce((sum, invoice) => sum + Number(invoice.balanceAmount || 0), 0)),
      totalInvoices: apartmentInvoices.length,
      unpaidInvoices: unpaidInvoices.length,
      paidInvoices: activeInvoices.filter((invoice) => invoice.status === 'PAID' || Number(invoice.balanceAmount || 0) <= 0).length,
      overdueInvoices: unpaidInvoices.filter((invoice) => this.isInternalInvoiceOverdue(invoice)).length,
      totalPaidAmount: this.money(confirmedPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)),
      lastInvoice: lastInvoice ? this.dashboardInvoiceItem(lastInvoice) : null,
      lastPayment: lastPayment
        ? {
            id: lastPayment.id,
            amount: Number(lastPayment.amount || 0),
            currency: lastPayment.currency || 'MDL',
            paymentDate: lastPayment.paymentDate,
            method: lastPayment.method,
            status: lastPayment.status,
          }
        : null,
      lastInvoiceBillingMonth: lastInvoice?.billingMonth ?? null,
      lastPaymentDate: lastPayment?.paymentDate ?? lastPayment?.createdAt ?? null,
    };
  }

  private async requireApartmentFromResidentScope(user: MvpUser, apartmentId: string) {
    const scope = await this.getResidentScope(user);
    const apartment = scope.apartments.find((item) => item.id === apartmentId);
    if (!apartment) {
      throw new NotFoundException('Apartamentul nu a fost găsit sau nu aparține contului tău.');
    }
    return { scope, apartment };
  }

  private relatedResidentItem(row: any, user: MvpUser, currentResidentIds: Set<string>) {
    const resident = row.resident || row;
    const isCurrentUser = resident.userId === user.id || currentResidentIds.has(resident.id);
    return {
      id: resident.id,
      fullName: this.fullName(resident) || 'Locatar',
      role: row.role || this.roleFromResidentType(resident.type),
      isPrimaryContact: Boolean(row.isPrimary || resident.isPrimary),
      isCurrentUser,
      phone: isCurrentUser ? resident.phone || null : null,
      email: isCurrentUser ? resident.email || null : null,
    };
  }

  private unpackDocumentMetadata(fileType?: string | null) {
    const parts = String(fileType || '').split(':');
    return {
      category: parts[1] || 'ALTUL',
      visibility: parts[2] || 'RESIDENT_VISIBLE',
    };
  }

  private toDocument(row: any) {
    const metadata = this.unpackDocumentMetadata(row.fileType);
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      category: metadata.category,
      visibility: metadata.visibility,
      fileUrl: row.fileUrl,
      fileName: row.fileName,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async listInvoices(user: MvpUser) {
    const scope = await this.getResidentScope(user);
    if (!scope.apartmentIds.length) return [];

    const invoices = await this.prisma.invoice.findMany({
      where: { organizationId: user.organizationId, apartmentId: { in: scope.apartmentIds } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { createdAt: 'desc' }],
      select: this.invoiceSelect(),
    });

    const notes = invoices.map((invoice) => this.invoicePaymentNote(invoice.id));
    const payments = notes.length
      ? await this.prisma.payment.findMany({
          where: {
            organizationId: user.organizationId,
            apartmentId: { in: scope.apartmentIds },
            note: { in: notes },
            status: PaymentStatus.CONFIRMED,
          },
          orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
          select: this.paymentSelect(),
        })
      : [];

    const chargeFilters = invoices
      .filter((invoice) => invoice.apartmentId && invoice.month && invoice.year)
      .map((invoice) => ({
        apartmentId: invoice.apartmentId as string,
        month: invoice.month as number,
        year: invoice.year as number,
      }));
    const charges = chargeFilters.length
      ? await this.prisma.monthlyCharge.findMany({
          where: {
            organizationId: user.organizationId,
            OR: chargeFilters,
          },
          orderBy: { tariffName: 'asc' },
        })
      : [];

    return invoices.map((invoice) => {
      const linkedPayments = payments.filter((payment) => payment.note === this.invoicePaymentNote(invoice.id)).map((payment) => this.toPayment(payment));
      const services = charges.filter((charge) => charge.apartmentId === invoice.apartmentId && charge.month === invoice.month && charge.year === invoice.year);
      return this.toInvoice(invoice, linkedPayments, services);
    });
  }

  async listInternalInvoices(user: MvpUser, query: Record<string, unknown> = {}) {
    const scope = await this.getResidentScope(user);
    const organization = await this.organizationFromUser(user);
    const parsed = this.parseResidentInvoiceQuery(query);

    if (!scope.apartmentIds.length) {
      return {
        items: [],
        meta: { page: parsed.page, limit: parsed.limit, total: 0 },
        stats: this.residentInvoiceStats([]),
        association: this.toOrganizationIdentity(organization),
        apartments: [],
        emptyStateCode: 'NO_APARTMENT',
        emptyStateMessage: this.emptyResidentMessage(),
      };
    }

    if (parsed.apartmentId && !scope.apartmentIds.includes(parsed.apartmentId)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_RESIDENT_SCOPE',
        message: 'Nu ai acces la aceste date.',
      });
    }

    const invoices = (await this.readInternalInvoiceMetadata(user.organizationId)).filter((invoice) => {
      if (!scope.apartmentIds.includes(invoice.apartmentId)) return false;
      if (parsed.apartmentId && invoice.apartmentId !== parsed.apartmentId) return false;
      if (parsed.billingMonth && invoice.billingMonth !== parsed.billingMonth) return false;
      if (parsed.status && invoice.status !== parsed.status) return false;
      if (parsed.unpaidOnly && (Number(invoice.balanceAmount || 0) <= 0 || invoice.status === 'CANCELLED' || invoice.status === 'VOID')) return false;
      if (parsed.overdueOnly && !this.isInternalInvoiceOverdue(invoice)) return false;
      return true;
    });

    invoices.sort((a, b) => {
      if (parsed.sortBy === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (parsed.sortBy === 'amount_desc') return Number(b.totalAmount || 0) - Number(a.totalAmount || 0);
      if (parsed.sortBy === 'amount_asc') return Number(a.totalAmount || 0) - Number(b.totalAmount || 0);
      if (parsed.sortBy === 'due_soon') {
        return new Date(a.dueDate || '9999-12-31').getTime() - new Date(b.dueDate || '9999-12-31').getTime();
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const start = (parsed.page - 1) * parsed.limit;
    const items = invoices.slice(start, start + parsed.limit);
    return {
      items: items.map((invoice) => this.toResidentInternalInvoiceListItem(invoice, organization)),
      meta: { page: parsed.page, limit: parsed.limit, total: invoices.length },
      stats: this.residentInvoiceStats(invoices),
      association: this.toOrganizationIdentity(organization),
      apartments: this.apartmentOptionsFromScope(scope),
      emptyStateCode: invoices.length ? null : 'NO_INVOICES',
    };
  }

  async getInternalInvoiceStats(user: MvpUser, query: Record<string, unknown> = {}) {
    const result = await this.listInternalInvoices(user, { ...query, page: 1, limit: 100 });
    return {
      stats: result.stats,
      association: result.association,
      apartments: result.apartments,
      emptyStateCode: result.emptyStateCode,
      emptyStateMessage: result.emptyStateMessage,
    };
  }

  private parseResidentPaymentQuery(query: Record<string, unknown> = {}) {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
    const apartmentId = typeof query.apartmentId === 'string' ? query.apartmentId.trim() : '';
    const billingMonth = typeof query.billingMonth === 'string' && /^\d{4}-\d{2}$/.test(query.billingMonth) ? query.billingMonth : '';
    const invoiceId = typeof query.invoiceId === 'string' ? query.invoiceId.trim() : '';
    const method = typeof query.method === 'string' ? query.method.trim().toUpperCase() : '';
    const status = typeof query.status === 'string' ? query.status.trim().toUpperCase() : '';
    const dateFrom = typeof query.dateFrom === 'string' && query.dateFrom.trim() ? new Date(query.dateFrom) : null;
    const dateTo = typeof query.dateTo === 'string' && query.dateTo.trim() ? new Date(query.dateTo) : null;
    if (dateTo) dateTo.setHours(23, 59, 59, 999);
    const confirmedOnly = query.confirmedOnly === true || String(query.confirmedOnly || '').toLowerCase() === 'true';
    const search = typeof query.search === 'string' ? query.search.trim().toLowerCase() : '';
    const sortBy = typeof query.sortBy === 'string' ? query.sortBy : 'newest';
    const sortDirection = String(query.sortDirection || '').toLowerCase() === 'asc' ? 'asc' : 'desc';
    return { page, limit, apartmentId, billingMonth, invoiceId, method, status, dateFrom, dateTo, confirmedOnly, search, sortBy, sortDirection };
  }

  private toResidentPaymentItem(row: any, invoice: InternalInvoiceMetadata, organization: any) {
    const payment = this.toPayment(row);
    const note = String(payment.note || '');
    const residentVisibleNote = note.startsWith(INTERNAL_PAYMENT_NOTE_PREFIX) ? '' : note;
    return {
      id: payment.id,
      amount: payment.amount,
      currency: payment.currency || 'MDL',
      paymentDate: payment.paidAt || payment.createdAt,
      method: payment.method,
      referenceNumber: payment.referenceNumber || '',
      payerName: payment.payerName || '',
      notes: residentVisibleNote,
      status: payment.status,
      invoice: {
        id: invoice.invoiceId || invoice.id,
        metadataId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        billingMonth: invoice.billingMonth,
        status: invoice.status,
        currency: invoice.currency,
        totalAmount: Number(invoice.totalAmount || 0),
        paidAmount: Number(invoice.paidAmount || 0),
        balanceAmount: Number(invoice.balanceAmount || 0),
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
      },
      apartment: invoice.apartment,
      association: this.toOrganizationIdentity(organization),
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }

  private residentPaymentStats(invoices: InternalInvoiceMetadata[], payments: Array<ReturnType<ResidentDemoService['toResidentPaymentItem']>>) {
    const confirmed = payments.filter((payment) => payment.status === PaymentStatus.CONFIRMED || String(payment.status).toUpperCase() === 'CONFIRMED');
    const cancelled = payments.filter((payment) => payment.status === PaymentStatus.CANCELLED || String(payment.status).toUpperCase() === 'CANCELLED');
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const paymentMonth = (payment: ReturnType<ResidentDemoService['toResidentPaymentItem']>) => {
      const date = payment.paymentDate ? new Date(payment.paymentDate) : null;
      if (!date || Number.isNaN(date.getTime())) return '';
      return date.toISOString().slice(0, 7);
    };
    const lastPayment = [...confirmed].sort((a, b) => {
      const left = new Date(a.paymentDate || a.createdAt || 0).getTime();
      const right = new Date(b.paymentDate || b.createdAt || 0).getTime();
      return right - left;
    })[0];
    return {
      totalPayments: payments.length,
      confirmedPayments: confirmed.length,
      cancelledPayments: cancelled.length,
      totalPaidAmount: this.money(confirmed.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)),
      currentMonthPaidAmount: this.money(
        confirmed.filter((payment) => paymentMonth(payment) === currentMonth).reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
      ),
      remainingBalance: this.money(
        invoices
          .filter((invoice) => invoice.status !== 'CANCELLED' && invoice.status !== 'VOID')
          .reduce((sum, invoice) => sum + Number(invoice.balanceAmount || 0), 0),
      ),
      paidInvoices: invoices.filter((invoice) => invoice.status === 'PAID' || Number(invoice.balanceAmount || 0) <= 0).length,
      partiallyPaidInvoices: invoices.filter((invoice) => invoice.status === 'PARTIALLY_PAID').length,
      lastPaymentDate: lastPayment?.paymentDate || lastPayment?.createdAt || null,
    };
  }

  private filterResidentInternalInvoicesForPayments(metadata: InternalInvoiceMetadata[], apartmentIds: string[], parsed: ReturnType<ResidentDemoService['parseResidentPaymentQuery']>) {
    return metadata.filter((invoice) => {
      if (!apartmentIds.includes(invoice.apartmentId)) return false;
      if (parsed.apartmentId && invoice.apartmentId !== parsed.apartmentId) return false;
      if (parsed.billingMonth && invoice.billingMonth !== parsed.billingMonth) return false;
      if (parsed.invoiceId && invoice.invoiceId !== parsed.invoiceId && invoice.id !== parsed.invoiceId) return false;
      return true;
    });
  }

  private sortResidentPayments(items: Array<ReturnType<ResidentDemoService['toResidentPaymentItem']>>, sortBy: string, sortDirection: 'asc' | 'desc') {
    const direction = sortDirection === 'asc' ? 1 : -1;
    return items.sort((a, b) => {
      if (sortBy === 'amount_desc') return Number(b.amount || 0) - Number(a.amount || 0);
      if (sortBy === 'amount_asc') return Number(a.amount || 0) - Number(b.amount || 0);
      if (sortBy === 'method') return String(a.method || '').localeCompare(String(b.method || ''), 'ro') * direction;
      if (sortBy === 'oldest') return new Date(a.paymentDate || 0).getTime() - new Date(b.paymentDate || 0).getTime();
      return new Date(b.paymentDate || 0).getTime() - new Date(a.paymentDate || 0).getTime();
    });
  }

  async listPayments(user: MvpUser, query: Record<string, unknown> = {}) {
    const scope = await this.getResidentScope(user);
    const organization = await this.organizationFromUser(user);
    const parsed = this.parseResidentPaymentQuery(query);
    if (!scope.apartmentIds.length) {
      return {
        items: [],
        meta: { page: parsed.page, limit: parsed.limit, total: 0 },
        stats: this.residentPaymentStats([], []),
        association: this.toOrganizationIdentity(organization),
        apartments: [],
        emptyStateCode: 'NO_APARTMENT',
        emptyStateMessage: this.emptyResidentMessage(),
      };
    }
    if (parsed.apartmentId && !scope.apartmentIds.includes(parsed.apartmentId)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_RESIDENT_SCOPE',
        message: 'Nu ai acces la aceste date.',
      });
    }

    const metadata = await this.readInternalInvoiceMetadata(user.organizationId);
    const visibleInvoices = this.filterResidentInternalInvoicesForPayments(metadata, scope.apartmentIds, parsed);
    if (parsed.invoiceId && !visibleInvoices.length) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    const invoiceById = new Map(visibleInvoices.map((invoice) => [invoice.invoiceId, invoice]));
    const payments = await this.prisma.payment.findMany({
      where: {
        organizationId: user.organizationId,
        apartmentId: { in: scope.apartmentIds },
        note: { startsWith: INTERNAL_PAYMENT_NOTE_PREFIX },
      },
      orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
      select: this.paymentSelect(),
    });

    const filtered = payments
      .map((row) => {
        const note = this.parseInternalPaymentNote(row.note);
        const invoice = note ? invoiceById.get(note.invoiceId) : null;
        return invoice ? this.toResidentPaymentItem(row, invoice, organization) : null;
      })
      .filter(Boolean) as Array<ReturnType<ResidentDemoService['toResidentPaymentItem']>>;

    const searched = filtered.filter((payment) => {
      const paymentDate = payment.paymentDate ? new Date(payment.paymentDate) : null;
      const matchesDateFrom = !parsed.dateFrom || (paymentDate && paymentDate >= parsed.dateFrom);
      const matchesDateTo = !parsed.dateTo || (paymentDate && paymentDate <= parsed.dateTo);
      const matchesMethod = !parsed.method || payment.method === parsed.method;
      const matchesStatus = !parsed.status || payment.status === parsed.status;
      const matchesConfirmedOnly = !parsed.confirmedOnly || payment.status === PaymentStatus.CONFIRMED;
      const haystack = `${payment.invoice.invoiceNumber} ${payment.referenceNumber || ''} ${payment.payerName || ''} ${payment.apartment.apartmentNumber} ${payment.method || ''}`.toLowerCase();
      return matchesDateFrom && matchesDateTo && matchesMethod && matchesStatus && matchesConfirmedOnly && (!parsed.search || haystack.includes(parsed.search));
    });
    const sorted = this.sortResidentPayments(searched, parsed.sortBy, parsed.sortDirection === 'asc' ? 'asc' : 'desc');
    const start = (parsed.page - 1) * parsed.limit;
    return {
      items: sorted.slice(start, start + parsed.limit),
      meta: { page: parsed.page, limit: parsed.limit, total: sorted.length },
      stats: this.residentPaymentStats(visibleInvoices, searched),
      association: this.toOrganizationIdentity(organization),
      apartments: this.apartmentOptionsFromScope(scope),
      emptyStateCode: sorted.length ? null : 'NO_PAYMENTS',
    };
  }

  async getInternalPaymentStats(user: MvpUser, query: Record<string, unknown> = {}) {
    const result = await this.listPayments(user, { ...query, page: 1, limit: 100 });
    return {
      stats: result.stats,
      association: result.association,
      apartments: result.apartments,
      emptyStateCode: result.emptyStateCode,
      emptyStateMessage: result.emptyStateMessage,
    };
  }

  async getDashboard(user: MvpUser, query: Record<string, unknown> = {}) {
    const scope = await this.getResidentScope(user);
    const organization = await this.organizationFromUser(user);
    const association = {
      ...this.toOrganizationIdentity(organization),
      address: organization?.address ?? null,
    };
    const requestedApartmentId = typeof query.apartmentId === 'string' ? query.apartmentId.trim() : '';
    const includeRecent = query.includeRecent === undefined || query.includeRecent === true || String(query.includeRecent).toLowerCase() === 'true';

    if (!scope.apartmentIds.length) {
      return {
        user: {
          ...scope.user,
          fullName: `${scope.user.firstName || ''} ${scope.user.lastName || ''}`.trim() || scope.user.email || 'Locatar',
        },
        association,
        apartments: [],
        selectedApartmentId: null,
        financialSummary: {
          currency: 'MDL',
          currentBalance: 0,
          totalInvoices: 0,
          unpaidInvoices: 0,
          partiallyPaidInvoices: 0,
          paidInvoices: 0,
          overdueInvoices: 0,
          totalPaidAmount: 0,
          status: 'NO_APARTMENT',
          nextDueDate: null,
          lastInvoice: null,
          lastPayment: null,
        },
        apartmentSummaries: [],
        recentInvoices: [],
        recentPayments: [],
        alerts: [
          {
            type: 'NO_APARTMENT',
            severity: 'INFO',
            title: 'Nu ai un apartament asociat contului',
            message: this.emptyResidentMessage(),
          },
        ],
        emptyStateCode: 'NO_APARTMENT',
        emptyStateMessage: this.emptyResidentMessage(),
      };
    }

    if (requestedApartmentId && !scope.apartmentIds.includes(requestedApartmentId)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_RESIDENT_SCOPE',
        message: 'Nu ai acces la aceste date.',
      });
    }

    const selectedApartmentIds = requestedApartmentId ? [requestedApartmentId] : scope.apartmentIds;
    const metadata = await this.readInternalInvoiceMetadata(user.organizationId);
    const scopedInvoices = metadata.filter((invoice) => scope.apartmentIds.includes(invoice.apartmentId));
    const visibleInvoices = scopedInvoices.filter((invoice) => selectedApartmentIds.includes(invoice.apartmentId));
    const visibleInvoiceById = new Map(visibleInvoices.map((invoice) => [invoice.invoiceId, invoice]));
    const allInvoiceById = new Map(scopedInvoices.map((invoice) => [invoice.invoiceId, invoice]));
    const paymentsRows = await this.prisma.payment.findMany({
      where: {
        organizationId: user.organizationId,
        apartmentId: { in: scope.apartmentIds },
        note: { startsWith: INTERNAL_PAYMENT_NOTE_PREFIX },
      },
      orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
      select: this.paymentSelect(),
    });
    const scopedPayments = paymentsRows
      .map((row) => {
        const note = this.parseInternalPaymentNote(row.note);
        const invoice = note ? allInvoiceById.get(note.invoiceId) : null;
        return invoice ? this.toResidentPaymentItem(row, invoice, organization) : null;
      })
      .filter(Boolean) as Array<ReturnType<ResidentDemoService['toResidentPaymentItem']>>;
    const visiblePayments = scopedPayments.filter((payment) => visibleInvoiceById.has(payment.invoice.id));
    const activeInvoices = visibleInvoices.filter((invoice) => invoice.status !== 'CANCELLED' && invoice.status !== 'VOID');
    const unpaidInvoices = activeInvoices.filter((invoice) => Number(invoice.balanceAmount || 0) > 0);
    const overdueInvoices = unpaidInvoices.filter((invoice) => this.isInternalInvoiceOverdue(invoice));
    const partiallyPaidInvoices = activeInvoices.filter((invoice) => invoice.status === 'PARTIALLY_PAID');
    const paidInvoices = activeInvoices.filter((invoice) => invoice.status === 'PAID' || Number(invoice.balanceAmount || 0) <= 0);
    const confirmedPayments = visiblePayments.filter((payment) => String(payment.status).toUpperCase() === 'CONFIRMED');
    const lastInvoice = [...visibleInvoices].sort((a, b) => {
      const left = new Date(a.issueDate || a.createdAt || 0).getTime();
      const right = new Date(b.issueDate || b.createdAt || 0).getTime();
      return right - left;
    })[0];
    const lastPayment = [...confirmedPayments].sort((a, b) => {
      const left = new Date(a.paymentDate || a.createdAt || 0).getTime();
      const right = new Date(b.paymentDate || b.createdAt || 0).getTime();
      return right - left;
    })[0];
    const nextDueInvoice = [...unpaidInvoices].sort((a, b) => {
      const left = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      const right = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      return left - right;
    })[0];
    const currentBalance = this.money(activeInvoices.reduce((sum, invoice) => sum + Number(invoice.balanceAmount || 0), 0));
    const totalPaidAmount = this.money(confirmedPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0));
    const financialStatus =
      visibleInvoices.length === 0
        ? 'NO_INVOICES'
        : currentBalance <= 0
          ? 'UP_TO_DATE'
          : partiallyPaidInvoices.length
            ? 'PARTIALLY_PAID'
            : 'BALANCE_DUE';

    const invoiceListItem = (invoice: InternalInvoiceMetadata) => ({
      id: invoice.invoiceId || invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      billingMonth: invoice.billingMonth,
      apartmentId: invoice.apartmentId,
      apartmentNumber: invoice.apartment.apartmentNumber,
      totalAmount: Number(invoice.totalAmount || 0),
      paidAmount: Number(invoice.paidAmount || 0),
      balanceAmount: Number(invoice.balanceAmount || 0),
      status: invoice.status,
      dueDate: invoice.dueDate,
      issueDate: invoice.issueDate,
      isOverdue: this.isInternalInvoiceOverdue(invoice),
    });

    const apartmentSummaries = scope.apartments.map((apartment) => {
      const apartmentInvoices = scopedInvoices.filter((invoice) => invoice.apartmentId === apartment.id);
      const apartmentActiveInvoices = apartmentInvoices.filter((invoice) => invoice.status !== 'CANCELLED' && invoice.status !== 'VOID');
      const apartmentUnpaidInvoices = apartmentActiveInvoices.filter((invoice) => Number(invoice.balanceAmount || 0) > 0);
      const apartmentPayments = scopedPayments.filter((payment) => payment.apartment.id === apartment.id && String(payment.status).toUpperCase() === 'CONFIRMED');
      const apartmentLastInvoice = [...apartmentInvoices].sort((a, b) => {
        const left = new Date(a.issueDate || a.createdAt || 0).getTime();
        const right = new Date(b.issueDate || b.createdAt || 0).getTime();
        return right - left;
      })[0];
      const apartmentLastPayment = [...apartmentPayments].sort((a, b) => {
        const left = new Date(a.paymentDate || a.createdAt || 0).getTime();
        const right = new Date(b.paymentDate || b.createdAt || 0).getTime();
        return right - left;
      })[0];
      return {
        apartmentId: apartment.id,
        apartmentNumber: String(apartment.number || ''),
        staircase: apartment.staircase?.name ?? null,
        floor: apartment.floor === null || apartment.floor === undefined ? null : String(apartment.floor),
        areaM2: apartment.areaM2 ?? null,
        role: apartment.relationRole ?? 'RESIDENT',
        isPrimaryContact: Boolean(apartment.isPrimary),
        currentBalance: this.money(apartmentActiveInvoices.reduce((sum, invoice) => sum + Number(invoice.balanceAmount || 0), 0)),
        unpaidInvoices: apartmentUnpaidInvoices.length,
        overdueInvoices: apartmentUnpaidInvoices.filter((invoice) => this.isInternalInvoiceOverdue(invoice)).length,
        lastInvoiceBillingMonth: apartmentLastInvoice?.billingMonth ?? null,
        lastPaymentDate: apartmentLastPayment?.paymentDate ?? apartmentLastPayment?.createdAt ?? null,
      };
    });

    const alerts: Array<{ type: string; severity: 'INFO' | 'WARNING' | 'ERROR'; title: string; message: string }> = [];
    if (!visibleInvoices.length) {
      alerts.push({
        type: 'NO_INVOICES',
        severity: 'INFO',
        title: 'Nu există facturi emise pentru contul tău',
        message: 'Facturile interne vor apărea aici după ce administratorul le generează.',
      });
    }
    if (overdueInvoices.length) {
      alerts.push({
        type: 'OVERDUE_INVOICES',
        severity: 'WARNING',
        title: 'Ai facturi cu scadența depășită',
        message: `Ai ${overdueInvoices.length} facturi cu scadența depășită.`,
      });
    } else if (unpaidInvoices.length) {
      alerts.push({
        type: 'UNPAID_INVOICES',
        severity: 'INFO',
        title: 'Ai facturi neachitate',
        message: `Ai ${unpaidInvoices.length} facturi neachitate în valoare de ${currentBalance.toFixed(2)} MDL.`,
      });
    }
    if (scope.apartments.some((apartment) => !apartment.isPrimary)) {
      alerts.push({
        type: 'CONTACT_DATA',
        severity: 'INFO',
        title: 'Verifică datele de contact',
        message: 'Contactează administratorul pentru actualizarea datelor de contact, dacă este necesar.',
      });
    }

    return {
      user: {
        ...scope.user,
        fullName: scope.resident?.name || `${scope.user.firstName || ''} ${scope.user.lastName || ''}`.trim() || scope.user.email || 'Locatar',
      },
      association,
      apartments: scope.apartments.map((apartment) => this.toDashboardApartment(apartment)).filter(Boolean),
      selectedApartmentId: requestedApartmentId || null,
      financialSummary: {
        currency: 'MDL',
        currentBalance,
        totalInvoices: visibleInvoices.length,
        unpaidInvoices: unpaidInvoices.length,
        partiallyPaidInvoices: partiallyPaidInvoices.length,
        paidInvoices: paidInvoices.length,
        overdueInvoices: overdueInvoices.length,
        totalPaidAmount,
        status: financialStatus,
        nextDueDate: nextDueInvoice?.dueDate ?? null,
        lastInvoice: lastInvoice ? invoiceListItem(lastInvoice) : null,
        lastPayment: lastPayment
          ? {
              id: lastPayment.id,
              amount: Number(lastPayment.amount || 0),
              currency: lastPayment.currency || 'MDL',
              paymentDate: lastPayment.paymentDate,
              method: lastPayment.method,
              status: lastPayment.status,
            }
          : null,
      },
      apartmentSummaries,
      recentInvoices: includeRecent ? visibleInvoices.slice().sort((a, b) => new Date(b.issueDate || b.createdAt || 0).getTime() - new Date(a.issueDate || a.createdAt || 0).getTime()).slice(0, 5).map(invoiceListItem) : [],
      recentPayments: includeRecent
        ? visiblePayments
            .slice()
            .sort((a, b) => new Date(b.paymentDate || b.createdAt || 0).getTime() - new Date(a.paymentDate || a.createdAt || 0).getTime())
            .slice(0, 5)
            .map((payment) => ({
              id: payment.id,
              amount: Number(payment.amount || 0),
              currency: payment.currency || 'MDL',
              paymentDate: payment.paymentDate,
              method: payment.method,
              status: payment.status,
              invoiceNumber: payment.invoice.invoiceNumber,
              invoiceId: payment.invoice.id,
              apartmentNumber: payment.apartment.apartmentNumber,
              apartmentId: payment.apartment.id,
            }))
        : [],
      alerts,
      emptyStateCode: visibleInvoices.length ? null : 'NO_INVOICES',
    };
  }

  async listApartments(user: MvpUser) {
    const scope = await this.getResidentScope(user);
    const organization = await this.organizationFromUser(user);
    const association = {
      ...this.toOrganizationIdentity(organization),
      address: organization?.address ?? null,
    };
    if (!scope.apartmentIds.length) {
      return {
        items: [],
        meta: { total: 0 },
        association,
        emptyStateCode: 'NO_APARTMENT',
        emptyStateMessage: this.emptyResidentMessage(),
      };
    }
    const { scopedInvoices, scopedPayments } = await this.residentFinancialData(user, scope, organization);
    return {
      items: scope.apartments.map((apartment) => {
        const base = this.toDashboardApartment(apartment);
        const summary = this.apartmentFinancialSummary(apartment.id, scopedInvoices, scopedPayments);
        return {
          id: apartment.id,
          apartmentNumber: base?.apartmentNumber || String(apartment.number || ''),
          building: base?.building || null,
          staircase: base?.staircase || null,
          floor: base?.floor || null,
          areaM2: base?.areaM2 ?? null,
          status: base?.status || 'UNKNOWN',
          myRole: base?.role || 'RESIDENT',
          isPrimaryContact: Boolean(base?.isPrimaryContact),
          association,
          financialSummary: {
            currency: 'MDL',
            currentBalance: summary.currentBalance,
            unpaidInvoices: summary.unpaidInvoices,
            overdueInvoices: summary.overdueInvoices,
            lastInvoiceBillingMonth: summary.lastInvoiceBillingMonth,
            lastPaymentDate: summary.lastPaymentDate,
          },
        };
      }),
      meta: { total: scope.apartments.length },
      association,
    };
  }

  async getApartmentProfile(user: MvpUser, id: string) {
    const { scope, apartment } = await this.requireApartmentFromResidentScope(user, id);
    const organization = await this.organizationFromUser(user);
    const association = {
      ...this.toOrganizationIdentity(organization),
      address: organization?.address ?? null,
    };
    const detailedApartment = await this.prisma.apartment.findFirst({
      where: { id, organizationId: user.organizationId },
      select: {
        id: true,
        number: true,
        floor: true,
        areaM2: true,
        rooms: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        building: { select: { id: true, name: true, address: true } },
        staircase: { select: { id: true, name: true } },
        ownerResident: { select: { id: true, userId: true, firstName: true, lastName: true, phone: true, email: true, accountStatus: true, type: true, isPrimary: true, createdAt: true } },
        residents: { select: { id: true, userId: true, firstName: true, lastName: true, phone: true, email: true, accountStatus: true, type: true, isPrimary: true, createdAt: true } },
        apartmentResidents: {
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
          select: {
            role: true,
            isPrimary: true,
            createdAt: true,
            resident: { select: { id: true, userId: true, firstName: true, lastName: true, phone: true, email: true, accountStatus: true, type: true, isPrimary: true, createdAt: true } },
          },
        },
      },
    });
    if (!detailedApartment) throw new NotFoundException('Apartamentul nu a fost găsit sau nu aparține contului tău.');

    const { scopedInvoices, scopedPayments } = await this.residentFinancialData(user, scope, organization);
    const financialSummary = this.apartmentFinancialSummary(id, scopedInvoices, scopedPayments);
    const apartmentInvoices = scopedInvoices
      .filter((invoice) => invoice.apartmentId === id)
      .sort((a, b) => new Date(b.issueDate || b.createdAt || 0).getTime() - new Date(a.issueDate || a.createdAt || 0).getTime());
    const apartmentPayments = scopedPayments
      .filter((payment) => payment.apartment.id === id)
      .sort((a, b) => new Date(b.paymentDate || b.createdAt || 0).getTime() - new Date(a.paymentDate || a.createdAt || 0).getTime());

    const currentResidentIds = new Set(scope.residentProfiles.map((resident) => resident.id));
    const relatedByKey = new Map<string, any>();
    for (const relation of detailedApartment.apartmentResidents || []) {
      relatedByKey.set(`${relation.resident.id}:${relation.role}`, this.relatedResidentItem(relation, user, currentResidentIds));
    }
    for (const resident of detailedApartment.residents || []) {
      const key = `${resident.id}:${this.roleFromResidentType(resident.type)}`;
      if (!relatedByKey.has(key)) relatedByKey.set(key, this.relatedResidentItem(resident, user, currentResidentIds));
    }
    if (detailedApartment.ownerResident) {
      const key = `${detailedApartment.ownerResident.id}:OWNER`;
      if (!relatedByKey.has(key)) {
        relatedByKey.set(
          key,
          this.relatedResidentItem({ resident: detailedApartment.ownerResident, role: 'OWNER', isPrimary: detailedApartment.ownerResident.isPrimary }, user, currentResidentIds),
        );
      }
    }
    const relatedResidents = Array.from(relatedByKey.values());
    const currentRelationRow = (detailedApartment.apartmentResidents || []).find(
      (relation) => relation.resident.userId === user.id || currentResidentIds.has(relation.resident.id),
    );
    const currentRelation =
      relatedResidents.find((resident) => resident.isCurrentUser && resident.isPrimaryContact) ??
      relatedResidents.find((resident) => resident.isCurrentUser) ??
      {
        role: apartment.relationRole || 'RESIDENT',
        isPrimaryContact: Boolean(apartment.isPrimary),
      };
    const currentProfile = scope.residentProfiles.find((resident) => currentResidentIds.has(resident.id));
    const alerts: Array<{ type: string; severity: 'INFO' | 'WARNING'; title: string; message: string }> = [];
    if (financialSummary.overdueInvoices) {
      alerts.push({ type: 'OVERDUE_INVOICES', severity: 'WARNING', title: 'Există facturi cu scadența depășită', message: 'Unele facturi pentru acest apartament au scadența depășită.' });
    } else if (financialSummary.unpaidInvoices) {
      alerts.push({ type: 'UNPAID_INVOICES', severity: 'INFO', title: 'Există facturi neachitate pentru acest apartament', message: 'Verifică facturile recente pentru detalii despre sold.' });
    }
    if (!detailedApartment.areaM2) {
      alerts.push({ type: 'MISSING_AREA', severity: 'INFO', title: 'Unele date ale apartamentului nu sunt completate', message: 'Suprafața apartamentului nu este completată.' });
    }
    if (!currentRelation.isPrimaryContact) {
      alerts.push({ type: 'NOT_PRIMARY_CONTACT', severity: 'INFO', title: 'Nu ești contactul principal pentru acest apartament', message: 'Pentru schimbarea contactului principal, contactează administratorul asociației.' });
    }

    return {
      apartment: {
        id: detailedApartment.id,
        apartmentNumber: detailedApartment.number,
        building: detailedApartment.building?.name ?? null,
        staircase: detailedApartment.staircase?.name ?? null,
        floor: detailedApartment.floor === null || detailedApartment.floor === undefined ? null : String(detailedApartment.floor),
        areaM2: detailedApartment.areaM2 ?? null,
        cadastralNumber: null,
        status: this.residentApartmentStatus(detailedApartment.status),
        updatedAt: detailedApartment.updatedAt,
      },
      association,
      myRelation: {
        role: currentRelation.role || apartment.relationRole || 'RESIDENT',
        isPrimaryContact: Boolean(currentRelation.isPrimaryContact),
        preferredContactMethod: 'PHONE',
        status: this.residentAccountStatus(currentProfile?.accountStatus),
        relationStartDate: currentRelationRow?.createdAt ?? null,
      },
      relatedResidents,
      financialSummary,
      recentInvoices: apartmentInvoices.slice(0, 5).map((invoice) => this.dashboardInvoiceItem(invoice)),
      recentPayments: apartmentPayments.slice(0, 5).map((payment) => ({
        id: payment.id,
        amount: Number(payment.amount || 0),
        currency: payment.currency || 'MDL',
        paymentDate: payment.paymentDate,
        method: payment.method,
        status: payment.status,
        referenceNumber: payment.referenceNumber || '',
        invoiceNumber: payment.invoice.invoiceNumber,
        invoiceId: payment.invoice.id,
      })),
      alerts,
    };
  }

  async getApartmentFinancialSummary(user: MvpUser, id: string) {
    const { scope } = await this.requireApartmentFromResidentScope(user, id);
    const organization = await this.organizationFromUser(user);
    const { scopedInvoices, scopedPayments } = await this.residentFinancialData(user, scope, organization);
    return this.apartmentFinancialSummary(id, scopedInvoices, scopedPayments);
  }

  async listApartmentInvoices(user: MvpUser, id: string, query: Record<string, unknown> = {}) {
    await this.requireApartmentFromResidentScope(user, id);
    return this.listInternalInvoices(user, { ...query, apartmentId: id });
  }

  async listApartmentPayments(user: MvpUser, id: string, query: Record<string, unknown> = {}) {
    await this.requireApartmentFromResidentScope(user, id);
    return this.listPayments(user, { ...query, apartmentId: id });
  }

  async getInternalPayment(user: MvpUser, id: string) {
    const scope = await this.requireResidentScope(user);
    const [organization, metadata, row] = await Promise.all([
      this.organizationFromUser(user),
      this.readInternalInvoiceMetadata(user.organizationId),
      this.prisma.payment.findFirst({
        where: {
          id,
          organizationId: user.organizationId,
          apartmentId: { in: scope.apartmentIds },
          note: { startsWith: INTERNAL_PAYMENT_NOTE_PREFIX },
        },
        select: this.paymentSelect(),
      }),
    ]);
    if (!row) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    const note = this.parseInternalPaymentNote(row.note);
    const invoice = note
      ? metadata.find((item) => item.invoiceId === note.invoiceId && scope.apartmentIds.includes(item.apartmentId))
      : null;
    if (!invoice) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    const payment = this.toResidentPaymentItem(row, invoice, organization);
    return {
      payment: {
        id: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        paymentDate: payment.paymentDate,
        method: payment.method,
        referenceNumber: payment.referenceNumber,
        payerName: payment.payerName,
        notes: payment.notes,
        status: payment.status,
        createdAt: payment.createdAt,
      },
      invoice: payment.invoice,
      apartment: payment.apartment,
      association: {
        ...payment.association,
        address: organization?.address ?? null,
      },
      invoiceBalanceAfterPayment: payment.invoice.balanceAmount,
    };
  }

  async listInternalInvoicePayments(user: MvpUser, id: string) {
    const scope = await this.requireResidentScope(user);
    const [organization, metadata] = await Promise.all([this.organizationFromUser(user), this.readInternalInvoiceMetadata(user.organizationId)]);
    const invoice = metadata.find((item) => (item.invoiceId === id || item.id === id) && scope.apartmentIds.includes(item.apartmentId));
    if (!invoice) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    const payments = await this.prisma.payment.findMany({
      where: {
        organizationId: user.organizationId,
        apartmentId: invoice.apartmentId,
        note: { startsWith: INTERNAL_PAYMENT_NOTE_PREFIX },
      },
      orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
      select: this.paymentSelect(),
    });
    const items = payments
      .filter((payment) => this.parseInternalPaymentNote(payment.note)?.invoiceId === invoice.invoiceId)
      .map((payment) => this.toResidentPaymentItem(payment, invoice, organization));
    return {
      items,
      stats: this.residentPaymentStats([invoice], items),
    };
  }

  async getInvoice(user: MvpUser, id: string) {
    const scope = await this.requireResidentScope(user);
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
        apartmentId: { in: scope.apartmentIds },
      },
      select: this.invoiceSelect(),
    });

    if (!invoice) throw new NotFoundException('Înregistrarea nu a fost găsită.');

    const [payments, services, organization] = await Promise.all([
      this.prisma.payment.findMany({
        where: {
          organizationId: user.organizationId,
          apartmentId: { in: scope.apartmentIds },
          status: PaymentStatus.CONFIRMED,
          OR: [{ note: this.invoicePaymentNote(invoice.id) }, { invoiceId: invoice.id }],
        },
        orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
        select: this.paymentSelect(),
      }),
      invoice.apartmentId && invoice.month && invoice.year
        ? this.prisma.monthlyCharge.findMany({
            where: {
              organizationId: user.organizationId,
              apartmentId: invoice.apartmentId,
              month: invoice.month,
              year: invoice.year,
            },
            orderBy: { tariffName: 'asc' },
          })
        : Promise.resolve([]),
      this.organizationFromUser(user),
    ]);

    const mappedPayments = payments.map((payment) => this.toPayment(payment));
    const mappedInvoice = this.toInvoice(invoice, mappedPayments, services);
    return {
      ...mappedInvoice,
      lineItemsAvailable: mappedInvoice.services.length > 0,
      paymentInstructions: this.toPaymentInstructions(organization),
      organization,
    };
  }

  async getInternalInvoice(user: MvpUser, id: string) {
    const scope = await this.requireResidentScope(user);
    const [organization, metadata, apartmentDetails] = await Promise.all([
      this.organizationFromUser(user),
      this.readInternalInvoiceMetadata(user.organizationId),
      this.prisma.apartment.findMany({
        where: { organizationId: user.organizationId, id: { in: scope.apartmentIds } },
        select: this.apartmentSelect(),
      }),
    ]);
    const invoice = metadata.find((item) => (item.invoiceId === id || item.id === id) && scope.apartmentIds.includes(item.apartmentId));
    if (!invoice) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    const apartment = apartmentDetails.find((item) => item.id === invoice.apartmentId);
    const payments = await this.prisma.payment.findMany({
      where: {
        organizationId: user.organizationId,
        apartmentId: invoice.apartmentId,
        note: { startsWith: INTERNAL_PAYMENT_NOTE_PREFIX },
      },
      orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
      select: this.paymentSelect(),
    });
    const invoicePayments = payments
      .filter((payment) => this.parseInternalPaymentNote(payment.note)?.invoiceId === invoice.invoiceId)
      .map((payment) => this.toPayment(payment));

    return {
      invoice: {
        id: invoice.invoiceId || invoice.id,
        metadataId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        billingMonth: invoice.billingMonth,
        status: invoice.status,
        currency: invoice.currency,
        subtotalAmount: Number(invoice.subtotalAmount || invoice.totalAmount || 0),
        totalAmount: Number(invoice.totalAmount || 0),
        paidAmount: Number(invoice.paidAmount || 0),
        balanceAmount: Number(invoice.balanceAmount || 0),
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        isOverdue: this.isInternalInvoiceOverdue(invoice),
      },
      association: {
        ...this.toOrganizationIdentity(organization),
        address: organization?.address ?? null,
        administratorName: organization?.administratorName ?? null,
      },
      apartment: {
        id: invoice.apartmentId,
        apartmentNumber: invoice.apartment.apartmentNumber,
        staircase: invoice.apartment.staircase,
        floor: invoice.apartment.floor,
        areaM2: apartment?.areaM2 ?? null,
      },
      administratorContact: {
        name: organization?.administratorName ?? null,
        paymentInstructions: this.toPaymentInstructions(organization),
      },
      lines: (invoice.lines || []).map((line) => ({
        id: line.id,
        name: line.name,
        description: line.description,
        calculationType: line.calculationType,
        quantity: Number(line.quantity || 0),
        unitPrice: Number(line.unitPrice || 0),
        amount: Number(line.amount || 0),
        currency: line.currency,
        formulaLabel: line.formulaLabel,
      })),
      payments: invoicePayments,
      actions: {
        pdfAvailable: false,
        onlinePaymentsAvailable: false,
      },
    };
  }

  async listMeters(user: MvpUser) {
    const scope = await this.getResidentScope(user);
    if (!scope.apartmentIds.length) return [];

    const meters = await this.prisma.meter.findMany({
      where: { organizationId: user.organizationId, apartmentId: { in: scope.apartmentIds } },
      orderBy: [{ apartment: { number: 'asc' } }, { type: 'asc' }],
      select: this.meterSelect(),
    });

    return meters.map((meter) => this.toMeter(meter));
  }

  async addMeterReading(user: MvpUser, meterId: string, body: unknown) {
    const scope = await this.requireResidentScope(user);

    const input = this.parseMeterReadingBody(body);
    const meter = await this.prisma.meter.findFirst({
      where: {
        id: meterId,
        organizationId: user.organizationId,
        apartmentId: { in: scope.apartmentIds },
      },
      select: {
        id: true,
        apartmentId: true,
        organizationId: true,
      },
    });

    if (!meter) throw new NotFoundException('Înregistrarea nu a fost găsită.');

    const dayStart = new Date(input.readingDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const [duplicateReading, previousReading] = await Promise.all([
      this.prisma.meterReading.findFirst({
        where: {
          meterId: meter.id,
          readingDate: {
            gte: dayStart,
            lt: dayEnd,
          },
        },
        select: { id: true },
      }),
      this.prisma.meterReading.findFirst({
        where: {
          meterId: meter.id,
          readingDate: { lt: input.readingDate },
        },
        orderBy: [{ readingDate: 'desc' }, { createdAt: 'desc' }],
        select: { value: true },
      }),
    ]);
    if (duplicateReading) throw new ConflictException('Există deja o citire pentru această dată.');
    if (previousReading && input.value < Number(previousReading.value)) {
      throw new BadRequestException('Citirea nouă este mai mică decât citirea anterioară.');
    }

    const reading = await this.prisma.meterReading.create({
      data: {
        meterId: meter.id,
        apartmentId: meter.apartmentId,
        organizationId: meter.organizationId,
        value: input.value,
        readingDate: input.readingDate,
        source: MeterReadingSource.RESIDENT,
      },
      select: {
        id: true,
        meterId: true,
        apartmentId: true,
        organizationId: true,
        value: true,
        readingDate: true,
        source: true,
        createdAt: true,
      },
    });

    await this.prisma.meter.update({
      where: { id: meter.id },
      data: { status: MeterStatus.ACTIVE },
    });

    await this.activity.createActivity({
      organizationId: meter.organizationId,
      actorUserId: user.id,
      type: 'METER_READING_ADDED',
      title: 'Citire transmisă de locatar',
      message: `Locatarul a transmis o citire de ${input.value}.`,
      targetType: 'METER_READING',
      targetId: reading.id,
      link: '/admin/meters',
    });

    return reading;
  }

  async listIssues(user: MvpUser) {
    const scope = await this.getResidentScope(user);
    if (!scope.apartmentIds.length) return [];

    const issues = await this.prisma.issue.findMany({
      where: { organizationId: user.organizationId, apartmentId: { in: scope.apartmentIds } },
      orderBy: { createdAt: 'desc' },
      select: this.issueSelect(),
    });

    return issues.map((issue) => this.toIssue(issue));
  }

  async createIssue(user: MvpUser, body: unknown) {
    const scope = await this.requireResidentScope(user);
    const input = this.parseCreateIssueBody(body);
    const apartment = this.requireApartmentFromScope(scope, input.apartmentId);

    const issue = await this.prisma.issue.create({
      data: {
        organizationId: apartment.organizationId,
        apartmentId: apartment.id,
        residentId: apartment.resident?.id ?? null,
        buildingId: apartment.building?.id,
        staircaseId: apartment.staircase?.id,
        createdByUserId: user.id,
        title: input.title,
        description: input.description,
        category: input.category,
        priority: input.priority,
        status: IssueStatus.NEW,
        locationType: IssueLocationType.APARTMENT,
      },
      select: this.issueSelect(),
    });

    await this.activity.createActivity({
      organizationId: issue.organizationId,
      actorUserId: user.id,
      type: 'ISSUE_CREATED',
      title: 'Cerere nouă',
      message: `Locatarul a trimis cererea „${issue.title}”.`,
      targetType: 'ISSUE',
      targetId: issue.id,
      link: `/admin/issues/${issue.id}`,
    });

    await this.activity.createNotification({
      organizationId: issue.organizationId,
      userId: user.id,
      type: NotificationType.ISSUE,
      title: 'Cererea a fost trimisă',
      message: `Cererea „${issue.title}” a fost înregistrată.`,
      link: `/resident/issues/${issue.id}`,
    });

    return this.toIssue(issue);
  }

  async listAnnouncements(user: MvpUser) {
    const announcements = await this.prisma.announcement.findMany({
      where: {
        organizationId: user.organizationId,
        status: 'ACTIVE',
      },
      orderBy: [{ createdAt: 'desc' }],
      select: this.announcementSelect(),
    });

    return announcements.map((announcement) => this.toAnnouncement(announcement));
  }

  async listResidentDocuments(user: MvpUser, take = 5) {
    const documents = await this.prisma.document.findMany({
      where: {
        organizationId: user.organizationId,
        fileType: { contains: ':RESIDENT_VISIBLE:' },
      },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        title: true,
        description: true,
        fileUrl: true,
        fileName: true,
        fileType: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return documents.map((document) => this.toDocument(document));
  }

  async getResidentHome(user: MvpUser) {
    const scope = await this.getResidentScope(user);
    const organization = await this.organizationFromUser(user);

    if (!scope.apartmentIds.length) {
      return {
        resident: scope.resident,
        organization: this.toOrganizationIdentity(organization),
        apartments: [],
        primaryApartment: null,
        finance: {
          totalDebt: 0,
          unpaidInvoicesCount: 0,
          overdueInvoicesCount: 0,
          nextDueDate: null,
          lastPaymentDate: null,
          status: 'NO_APARTMENT',
        },
        meters: { total: 0, missingReadings: 0, latest: [] },
        issues: { activeCount: 0, latest: [] },
        announcements: { latest: [] },
        documents: { latest: [] },
        emptyStateMessage: this.emptyResidentMessage(),
      };
    }

    const [invoices, paymentResponse, meters, issues, announcements, documents] = await Promise.all([
      this.listInvoices(user),
      this.listPayments(user),
      this.listMeters(user),
      this.listIssues(user),
      this.listAnnouncements(user),
      this.listResidentDocuments(user, 5),
    ]);
    const payments = paymentResponse.items || [];
    const openInvoices = invoices.filter((invoice) => Number(invoice.remainingAmount ?? invoice.amount ?? 0) > 0);
    const overdueInvoices = openInvoices.filter(
      (invoice) => invoice.status === InvoiceStatus.OVERDUE || (invoice.dueDate && new Date(invoice.dueDate) < new Date()),
    );
    const activeIssues = issues.filter((issue) => ![IssueStatus.RESOLVED, IssueStatus.CLOSED].includes(issue.status));
    const missingMeters = meters.filter((meter) => meter.status === MeterStatus.MISSING_READING || !meter.lastReading);
    const nextDueInvoice = [...openInvoices].sort((a, b) => {
      const left = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      const right = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      return left - right;
    })[0];
    const confirmedPayments = payments.filter(
      (payment) => payment.status === PaymentStatus.CONFIRMED || String(payment.status).toUpperCase() === 'CONFIRMED',
    );
    const lastPayment = [...confirmedPayments].sort((a, b) => {
      const left = a.paidAt || a.paymentDate ? new Date(a.paidAt || a.paymentDate).getTime() : 0;
      const right = b.paidAt || b.paymentDate ? new Date(b.paidAt || b.paymentDate).getTime() : 0;
      return right - left;
    })[0];
    const totalInvoiced = this.money(invoices.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0));
    const totalPaid = this.confirmedPaymentTotal(payments);
    const totalDebt = this.money(Math.max(totalInvoiced - totalPaid, 0));

    return {
      resident: scope.resident
        ? {
            ...scope.resident,
            role: scope.primaryApartment?.relationRole ?? null,
          }
        : null,
      organization: this.toOrganizationIdentity(organization),
      apartments: scope.apartments.map((apartment) => this.toPrimaryApartment(apartment)),
      primaryApartment: this.toPrimaryApartment(scope.primaryApartment),
      finance: {
        totalDebt,
        unpaidInvoicesCount: openInvoices.length,
        overdueInvoicesCount: overdueInvoices.length,
        nextDueDate: nextDueInvoice?.dueDate ?? null,
        lastPaymentDate: lastPayment?.paidAt ?? lastPayment?.paymentDate ?? lastPayment?.createdAt ?? null,
        status: overdueInvoices.length ? 'OVERDUE' : openInvoices.length ? 'UNPAID' : 'PAID',
      },
      meters: {
        total: meters.length,
        missingReadings: missingMeters.length,
        latest: meters.slice(0, 5),
      },
      issues: {
        activeCount: activeIssues.length,
        latest: activeIssues.slice(0, 5),
      },
      announcements: {
        latest: announcements.slice(0, 5),
      },
      documents: {
        latest: documents.slice(0, 5),
      },
      emptyStateMessage: null,
    };
  }

  async getResidentContext(user: MvpUser) {
    const scope = await this.getResidentScope(user);
    const organization = await this.organizationFromUser(user);

    const [invoices, meters, issues, announcements] = await Promise.all([
      this.listInvoices(user),
      this.listMeters(user),
      this.listIssues(user),
      this.listAnnouncements(user),
    ]);
    const paymentResponse = await this.listPayments(user);
    const payments = paymentResponse.items || [];
    const openInvoices = invoices.filter((invoice) => Number(invoice.remainingAmount ?? invoice.amount ?? 0) > 0);
    const overdueInvoices = openInvoices.filter((invoice) => invoice.status === InvoiceStatus.OVERDUE || (invoice.dueDate && new Date(invoice.dueDate) < new Date()));
    const activeIssues = issues.filter((issue) => issue.status !== IssueStatus.RESOLVED);
    const missingMeters = meters.filter((meter) => meter.status === MeterStatus.MISSING_READING || !meter.lastReading);
    const nextDueInvoice = [...openInvoices].sort((a, b) => {
      const left = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      const right = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      return left - right;
    })[0];
    const totalInvoiced = this.money(invoices.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0));
    const totalPaid = this.confirmedPaymentTotal(payments);
    const totalDebt = this.money(Math.max(totalInvoiced - totalPaid, 0));

    return {
      user: scope.user,
      organization,
      resident: scope.resident,
      apartments: scope.apartments,
      primaryApartment: scope.primaryApartment,
      apartment: scope.primaryApartment,
      emptyStateMessage: scope.primaryApartment ? null : this.emptyResidentMessage(),
      balance: {
        current: totalDebt,
        totalInvoiced,
        totalPaid,
        unpaidInvoicesCount: openInvoices.length,
        overdueInvoicesCount: overdueInvoices.length,
        status: overdueInvoices.length ? 'OVERDUE' : openInvoices.length ? 'UNPAID' : 'PAID',
        nextDueDate: nextDueInvoice?.dueDate ?? invoices[0]?.dueDate ?? null,
      },
      latestAnnouncement: announcements[0] ?? null,
      meterReminder: {
        missingCount: missingMeters.length,
        totalCount: meters.length,
        updatedCount: meters.length - missingMeters.length,
        latestMissing: missingMeters[0] ?? null,
      },
      activeIssueSummary: {
        count: activeIssues.length,
        latest: activeIssues[0] ?? null,
      },
    };
  }

  async getFinanceSummary(user: MvpUser) {
    const scope = await this.getResidentScope(user);
    const organization = await this.organizationFromUser(user);

    if (!scope.apartmentIds.length) {
      return {
        totalDebt: 0,
        totalUnpaid: 0,
        totalPaidThisYear: 0,
        unpaidInvoicesCount: 0,
        overdueInvoicesCount: 0,
        nextDueDate: null,
        lastPaymentDate: null,
        status: 'NO_APARTMENT',
        primaryApartment: null,
        organization,
        paymentInstructions: this.toPaymentInstructions(organization),
        emptyStateMessage: this.emptyResidentMessage(),
      };
    }

    const [invoiceResponse, paymentResponse] = await Promise.all([
      this.listInternalInvoices(user, { page: 1, limit: 100 }),
      this.listPayments(user),
    ]);
    const payments = paymentResponse.items || [];
    const invoices = invoiceResponse.items || [];
    const openInvoices = invoices.filter((invoice: any) => Number(invoice.balanceAmount || 0) > 0);
    const overdueInvoices = openInvoices.filter((invoice: any) => invoice.isOverdue);
    const nextDueInvoice = [...openInvoices].sort((a: any, b: any) => {
      const left = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      const right = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      return left - right;
    })[0];
    const currentYear = new Date().getFullYear();
    const confirmedPayments = payments.filter(
      (payment) => payment.status === PaymentStatus.CONFIRMED || String(payment.status).toUpperCase() === 'CONFIRMED',
    );
    const totalPaidThisYear = this.money(
      confirmedPayments.reduce((sum, payment) => {
        const paidAt = payment.paidAt ?? payment.paymentDate ?? payment.createdAt;
        if (!paidAt || new Date(paidAt).getFullYear() !== currentYear) return sum;
        return sum + Number(payment.amount || 0);
      }, 0),
    );
    const totalInvoiced = this.money(invoices.reduce((sum: number, invoice: any) => sum + Number(invoice.totalAmount || 0), 0));
    const totalPaid = Number(invoiceResponse.stats?.paidAmount || 0);
    const lastPayment = [...confirmedPayments].sort((a, b) => {
      const left = a.paidAt || a.paymentDate ? new Date(a.paidAt || a.paymentDate).getTime() : 0;
      const right = b.paidAt || b.paymentDate ? new Date(b.paidAt || b.paymentDate).getTime() : 0;
      return right - left;
    })[0];
    const totalDebt = this.money(Math.max(totalInvoiced - totalPaid, 0));
    const primaryApartment = scope.primaryApartment
      ? {
          id: scope.primaryApartment.id,
          number: scope.primaryApartment.number,
          staircase: scope.primaryApartment.staircase?.name ?? null,
          building: scope.primaryApartment.building?.name ?? null,
        }
      : null;

    return {
      totalDebt,
      totalUnpaid: totalDebt,
      totalPaidThisYear,
      unpaidInvoicesCount: openInvoices.length,
      overdueInvoicesCount: overdueInvoices.length,
      nextDueDate: nextDueInvoice?.dueDate ?? null,
      lastPaymentDate: lastPayment?.paidAt ?? lastPayment?.paymentDate ?? lastPayment?.createdAt ?? null,
      status: overdueInvoices.length ? 'OVERDUE' : openInvoices.length ? 'UNPAID' : 'PAID',
      primaryApartment,
      organization,
      paymentInstructions: this.toPaymentInstructions(organization),
    };
  }

  async getDemoContext(user: MvpUser) {
    return this.getResidentContext(user);
  }

  private parseMeterReadingBody(body: unknown) {
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    if (payload.value === undefined || payload.value === null || payload.value === '') {
      throw new BadRequestException('Valoarea citirii este obligatorie.');
    }
    const value = this.requiredNumber(payload.value, 'Valoarea citirii trebuie să fie un număr.');
    const readingDate =
      typeof payload.readingDate === 'string' && payload.readingDate.trim()
        ? this.requiredDate(payload.readingDate, 'Data citirii nu este validă.')
        : new Date();
    if (value < 0) {
      throw new BadRequestException('Valoarea citirii trebuie să fie un număr.');
    }
    if (payload.source && String(payload.source).toUpperCase() !== MeterReadingSource.RESIDENT) {
      throw new BadRequestException('Sursa citirii trebuie să fie RESIDENT.');
    }
    return { value, readingDate };
  }

  private parseCreateIssueBody(body: unknown) {
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    return {
      title: this.requiredString(payload.title, 'Titlul este obligatoriu.'),
      description: this.requiredString(payload.description, 'Descrierea este obligatorie.'),
      category: this.optionalEnum(payload.category, IssueCategory, IssueCategory.OTHER, 'Categoria nu este validă.'),
      priority: this.optionalEnum(payload.priority, IssuePriority, IssuePriority.NORMAL, 'Prioritatea cererii nu este validă.'),
      apartmentId: typeof payload.apartmentId === 'string' ? payload.apartmentId : undefined,
    };
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
