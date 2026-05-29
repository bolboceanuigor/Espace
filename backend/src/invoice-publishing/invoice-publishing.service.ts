import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BillingCurrency,
  BillingDraftInvoiceStatus,
  BillingPeriodStatus,
  PaymentIntentEventType,
  PaymentIntentSource,
  PaymentIntentStatus,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  Role,
} from '@prisma/client';
import { ActivityMvpService } from '../activity-mvp/activity-mvp.service';
import { buildPaginationMeta, resolvePagination } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import type { MvpUser } from '../security/mvp-auth.guard';

type IssueType =
  | 'INVOICE_WITHOUT_LINES'
  | 'INVOICE_TOTAL_ZERO'
  | 'INVOICE_WITH_NEGATIVE_TOTAL'
  | 'APARTMENT_WITHOUT_RESIDENT'
  | 'APARTMENT_WITHOUT_OWNER'
  | 'RESIDENT_WITHOUT_USER_ACCOUNT'
  | 'MISSING_DUE_DATE'
  | 'DUPLICATE_INVOICE_NUMBER'
  | 'BILLING_PERIOD_NOT_APPROVED'
  | 'INVOICE_NOT_APPROVED'
  | 'ALREADY_PUBLISHED'
  | 'PAYMENT_EXISTS_CANNOT_UNPUBLISH';

type IssueSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

type InvoiceIssue = {
  id: string;
  type: IssueType;
  severity: IssueSeverity;
  blocking: boolean;
  title: string;
  recommendation: string;
  invoice?: { id: string; invoiceNumber?: string | null; status: string; total: number } | null;
  apartment?: { id: string; number: string; building?: string | null; entrance?: string | null } | null;
  resident?: { id: string; name: string | null; hasUserAccount: boolean } | null;
};

type PublishInput = {
  confirm?: boolean;
  dueDate?: string | null;
  publicNote?: string | null;
};

const PUBLISHED_OR_SETTLED_STATUSES: BillingDraftInvoiceStatus[] = [
  BillingDraftInvoiceStatus.PUBLISHED,
  BillingDraftInvoiceStatus.PAID,
  BillingDraftInvoiceStatus.PARTIALLY_PAID,
];

const ADMIN_UPDATE_STATUSES: BillingDraftInvoiceStatus[] = [
  BillingDraftInvoiceStatus.IN_REVIEW,
  BillingDraftInvoiceStatus.APPROVED,
  BillingDraftInvoiceStatus.CANCELLED,
];

const RESIDENT_VISIBLE_INVOICE_STATUSES: BillingDraftInvoiceStatus[] = [
  BillingDraftInvoiceStatus.PUBLISHED,
  BillingDraftInvoiceStatus.PAID,
  BillingDraftInvoiceStatus.PARTIALLY_PAID,
  BillingDraftInvoiceStatus.CANCELLED,
];

const ACTIVE_PLACEHOLDER_INTENT_STATUSES: PaymentIntentStatus[] = [
  PaymentIntentStatus.CREATED,
  PaymentIntentStatus.VIEWED,
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function optionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function parseDate(value: unknown) {
  if (!value) return undefined;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new BadRequestException('Data trimisă nu este validă.');
  return date;
}

function numberFromDecimal(value: unknown) {
  if (value && typeof (value as { toNumber?: unknown }).toNumber === 'function') {
    return (value as { toNumber: () => number }).toNumber();
  }
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function fullName(resident?: { firstName?: string | null; lastName?: string | null; email?: string | null; phone?: string | null } | null) {
  const name = [resident?.firstName, resident?.lastName].filter(Boolean).join(' ').trim();
  return name || resident?.email || resident?.phone || null;
}

function monthKey(period?: { year?: number | null; month?: number | null } | null) {
  if (!period?.year || !period?.month) return '';
  return `${period.year}-${String(period.month).padStart(2, '0')}`;
}

function apartmentInfo(apartment?: any) {
  if (!apartment) return null;
  return {
    id: apartment.id,
    number: apartment.number,
    apartmentNumber: apartment.number,
    building: apartment.building ? { id: apartment.building.id, name: apartment.building.name } : null,
    staircase: apartment.staircase ? { id: apartment.staircase.id, name: apartment.staircase.name } : null,
    entrance: apartment.staircase ? { id: apartment.staircase.id, name: apartment.staircase.name } : null,
    floor: apartment.floor,
    areaM2: apartment.areaM2,
  };
}

@Injectable()
export class InvoicePublishingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityMvpService,
  ) {}

  async listAdminInvoices(user: MvpUser, query: Record<string, unknown> = {}) {
    const organizationId = this.requireAdminOrganization(user);
    const { page, limit, skip } = resolvePagination(query, 50, 100);
    const where = await this.adminInvoiceWhere(organizationId, query);
    if (this.bool(query.onlyIssues)) {
      const issues = await this.getIssuesForOrganization(organizationId, query);
      const ids = Array.from(new Set(issues.map((issue) => issue.invoice?.id).filter(Boolean))) as string[];
      where.id = ids.length ? { in: ids } : { in: ['__none__'] };
    }

    const [rows, total, issues] = await Promise.all([
      this.prisma.billingDraftInvoice.findMany({
        where,
        orderBy: [{ billingPeriod: { year: 'desc' } }, { billingPeriod: { month: 'desc' } }, { updatedAt: 'desc' }],
        skip,
        take: limit,
        include: this.invoiceListInclude(),
      }),
      this.prisma.billingDraftInvoice.count({ where }),
      this.getIssuesForOrganization(organizationId, query),
    ]);
    const issuesByInvoice = this.issuesByInvoice(issues);
    return {
      items: rows.map((invoice) => this.serializeAdminInvoice(invoice, issuesByInvoice.get(invoice.id) || [])),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async getAdminOverview(user: MvpUser) {
    const organizationId = this.requireAdminOrganization(user);
    const [invoices, issues] = await Promise.all([
      this.prisma.billingDraftInvoice.findMany({
        where: { organizationId },
        include: {
          lines: { select: { id: true } },
          resident: { select: { id: true, userId: true } },
          owner: { select: { id: true, userId: true } },
        },
      }),
      this.getIssuesForOrganization(organizationId, {}),
    ]);
    const count = (status: BillingDraftInvoiceStatus) => invoices.filter((invoice) => invoice.status === status).length;
    const amount = (statuses: BillingDraftInvoiceStatus[]) =>
      money(invoices.filter((invoice) => statuses.includes(invoice.status)).reduce((sum, invoice) => sum + numberFromDecimal(invoice.total), 0));
    return {
      totalInvoices: invoices.length,
      draftInvoices: count(BillingDraftInvoiceStatus.DRAFT),
      approvedInvoices: count(BillingDraftInvoiceStatus.APPROVED),
      publishedInvoices: count(BillingDraftInvoiceStatus.PUBLISHED),
      paidInvoices: count(BillingDraftInvoiceStatus.PAID),
      partiallyPaidInvoices: count(BillingDraftInvoiceStatus.PARTIALLY_PAID),
      cancelledInvoices: count(BillingDraftInvoiceStatus.CANCELLED),
      unpublishedApprovedInvoices: count(BillingDraftInvoiceStatus.APPROVED),
      totalPublishedAmount: amount([BillingDraftInvoiceStatus.PUBLISHED, BillingDraftInvoiceStatus.PAID, BillingDraftInvoiceStatus.PARTIALLY_PAID]),
      totalDraftAmount: amount([BillingDraftInvoiceStatus.DRAFT, BillingDraftInvoiceStatus.IN_REVIEW]),
      totalApprovedAmount: amount([BillingDraftInvoiceStatus.APPROVED]),
      invoicesWithIssues: new Set(issues.map((issue) => issue.invoice?.id).filter(Boolean)).size,
      residentsWithoutUserAccount: invoices.filter((invoice) => (invoice.resident && !invoice.resident.userId) || (invoice.owner && !invoice.owner.userId)).length,
      invoicesWithoutResident: invoices.filter((invoice) => !invoice.residentId && !invoice.ownerId).length,
      invoicesWithoutLines: invoices.filter((invoice) => !invoice.lines.length).length,
      warningsCount: issues.filter((issue) => issue.severity === 'WARNING').length,
      criticalIssuesCount: issues.filter((issue) => issue.severity === 'CRITICAL').length,
    };
  }

  async getAdminInvoice(user: MvpUser, id: string) {
    const organizationId = this.requireAdminOrganization(user);
    const invoice = await this.prisma.billingDraftInvoice.findFirst({
      where: { id, organizationId },
      include: this.invoiceDetailInclude(),
    });
    if (!invoice) throw new NotFoundException('Factura nu a fost găsită.');
    const issues = (await this.getIssuesForOrganization(organizationId, { invoiceId: id })).filter((issue) => issue.invoice?.id === id);
    const activity = await this.prisma.auditLog.findMany({
      where: { organizationId, entityId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { user: { select: { id: true, firstName: true, lastName: true, fullName: true, email: true } } },
    });
    return {
      invoice: this.serializeAdminInvoiceDetail(invoice, issues),
      activity: activity.map((item) => ({
        id: item.id,
        action: item.action,
        description: item.description,
        actor: item.user ? fullName(item.user) || item.user.email : null,
        createdAt: item.createdAt,
      })),
    };
  }

  async updateAdminInvoice(user: MvpUser, id: string, body: unknown) {
    const organizationId = this.requireAdminOrganization(user);
    const invoice = await this.prisma.billingDraftInvoice.findFirst({ where: { id, organizationId } });
    if (!invoice) throw new NotFoundException('Factura nu a fost găsită.');
    if (PUBLISHED_OR_SETTLED_STATUSES.includes(invoice.status)) {
      throw new BadRequestException('Nu poți edita facturi publicate sau achitate.');
    }
    const payload = isRecord(body) ? body : {};
    const nextStatus = optionalString(payload.status) as BillingDraftInvoiceStatus | undefined;
    if (nextStatus && !ADMIN_UPDATE_STATUSES.includes(nextStatus)) {
      throw new BadRequestException('Statusul poate fi IN_REVIEW, APPROVED sau CANCELLED.');
    }
    const invoiceNumber = optionalString(payload.invoiceNumber);
    if (invoiceNumber) await this.assertInvoiceNumberAvailable(organizationId, invoiceNumber, invoice.id);
    const updated = await this.prisma.billingDraftInvoice.update({
      where: { id: invoice.id },
      data: {
        dueDate: payload.dueDate === undefined ? undefined : parseDate(payload.dueDate) || null,
        publicNote: payload.publicNote === undefined ? undefined : optionalString(payload.publicNote) || null,
        internalNote: payload.internalNote === undefined ? undefined : optionalString(payload.internalNote) || null,
        invoiceNumber: invoiceNumber || undefined,
        status: nextStatus || undefined,
      },
      include: this.invoiceDetailInclude(),
    });
    await this.log(user, 'INVOICE_UPDATED', 'Factură actualizată', `Factura ${updated.invoiceNumber || updated.id} a fost actualizată.`, updated.id);
    return { invoice: this.serializeAdminInvoiceDetail(updated, []) };
  }

  async publishAdminInvoice(user: MvpUser, id: string, body: unknown) {
    const payload = this.parsePublishInput(body);
    if (!payload.confirm) throw new BadRequestException('Confirmarea este obligatorie pentru publicare.');
    const invoice = await this.publishOne(user, id, payload, false);
    return { invoice };
  }

  async bulkPublishAdminInvoices(user: MvpUser, body: unknown) {
    const organizationId = this.requireAdminOrganization(user);
    const payload = isRecord(body) ? body : {};
    if (payload.confirm !== true) throw new BadRequestException('Confirmarea este obligatorie pentru publicare bulk.');
    let ids = Array.isArray(payload.invoiceIds) ? payload.invoiceIds.map(String).filter(Boolean) : [];
    const billingPeriodId = optionalString(payload.billingPeriodId);
    if (!ids.length && billingPeriodId) {
      const rows = await this.prisma.billingDraftInvoice.findMany({
        where: { organizationId, billingPeriodId, status: BillingDraftInvoiceStatus.APPROVED },
        select: { id: true },
      });
      ids = rows.map((row) => row.id);
    }
    if (!ids.length) throw new BadRequestException('Alege facturi sau o perioadă de facturare.');
    const input = this.parsePublishInput({ ...payload, confirm: true });
    const errors: Array<{ invoiceId: string; message: string }> = [];
    let publishedCount = 0;
    let skippedCount = 0;
    for (const id of ids) {
      try {
        await this.publishOne(user, id, input, true);
        publishedCount += 1;
      } catch (error) {
        skippedCount += 1;
        errors.push({ invoiceId: id, message: error instanceof Error ? error.message : 'Factura nu a putut fi publicată.' });
      }
    }
    await this.log(user, 'INVOICE_BULK_PUBLISHED', 'Facturi publicate bulk', `Au fost publicate ${publishedCount} facturi. ${skippedCount} au fost sărite.`, billingPeriodId || null);
    return { publishedCount, skippedCount, errors };
  }

  async unpublishAdminInvoice(user: MvpUser, id: string, body: unknown) {
    const organizationId = this.requireAdminOrganization(user);
    const payload = isRecord(body) ? body : {};
    if (payload.confirm !== true) throw new BadRequestException('Confirmarea este obligatorie pentru anularea publicării.');
    const invoice = await this.prisma.billingDraftInvoice.findFirst({ where: { id, organizationId } });
    if (!invoice) throw new NotFoundException('Factura nu a fost găsită.');
    if (invoice.status !== BillingDraftInvoiceStatus.PUBLISHED) throw new BadRequestException('Poți anula publicarea doar pentru facturi PUBLISHED.');
    const paymentCount = await this.prisma.payment.count({ where: { organizationId, invoiceId: invoice.id } }).catch(() => 0);
    if (paymentCount > 0) throw new BadRequestException('Factura are plăți asociate și nu poate fi retrasă.');
    const reason = optionalString(payload.reason);
    const updated = await this.prisma.billingDraftInvoice.update({
      where: { id: invoice.id },
      data: {
        status: BillingDraftInvoiceStatus.APPROVED,
        publishedAt: null,
        publishedById: null,
        internalNote: [invoice.internalNote, reason ? `Unpublish: ${reason}` : 'Unpublish fără motiv.'].filter(Boolean).join('\n'),
      },
    });
    await this.log(user, 'INVOICE_UNPUBLISHED', 'Publicare anulată', reason || 'Factura a fost retrasă din portalul locatarului.', updated.id);
    return { invoice: this.serializeInvoiceBase(updated) };
  }

  async getAdminIssues(user: MvpUser, query: Record<string, unknown> = {}) {
    const organizationId = this.requireAdminOrganization(user);
    let issues = await this.getIssuesForOrganization(organizationId, query);
    const type = optionalString(query.type);
    const severity = optionalString(query.severity);
    if (type) issues = issues.filter((issue) => issue.type === type);
    if (severity) issues = issues.filter((issue) => issue.severity === severity);
    const { page, limit, skip } = resolvePagination(query, 50, 100);
    return {
      issues: issues.slice(skip, skip + limit),
      meta: buildPaginationMeta(page, limit, issues.length),
    };
  }

  async getResidentOverview(user: MvpUser) {
    const { organizationId, apartmentIds } = await this.residentInvoiceScope(user);
    if (!apartmentIds.length) {
      return {
        totalPublishedInvoices: 0,
        unpaidInvoices: 0,
        paidInvoices: 0,
        partiallyPaidInvoices: 0,
        overdueInvoices: 0,
        totalUnpaidAmount: 0,
        totalOverdueAmount: 0,
        nextDueInvoice: null,
        lastPublishedInvoice: null,
        apartmentsCount: 0,
        currency: 'MDL',
      };
    }
    const invoices = await this.prisma.billingDraftInvoice.findMany({
      where: this.residentInvoiceWhere(organizationId, apartmentIds),
      include: this.invoiceListInclude(),
      orderBy: [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
    });
    const paidByInvoice = await this.paidAmountsForInvoices(organizationId, invoices.map((invoice) => invoice.id));
    const enriched = invoices.map((invoice) => this.serializeResidentInvoiceList(invoice, paidByInvoice.get(invoice.id) || 0));
    const unpaid = enriched.filter((invoice) => invoice.paymentDisplayStatus === 'UNPAID');
    const overdue = enriched.filter((invoice) => invoice.paymentDisplayStatus === 'OVERDUE');
    const partiallyPaid = enriched.filter((invoice) => invoice.paymentDisplayStatus === 'PARTIALLY_PAID');
    const paid = enriched.filter((invoice) => invoice.paymentDisplayStatus === 'PAID');
    const nextDueInvoice = [...enriched]
      .filter((invoice) => invoice.remainingAmount > 0 && invoice.dueDate)
      .sort((a, b) => new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime())[0] || null;
    return {
      totalPublishedInvoices: enriched.length,
      unpaidInvoices: unpaid.length + overdue.length,
      paidInvoices: paid.length,
      partiallyPaidInvoices: partiallyPaid.length,
      overdueInvoices: overdue.length,
      totalUnpaidAmount: money(enriched.reduce((sum, invoice) => sum + invoice.remainingAmount, 0)),
      totalOverdueAmount: money(overdue.reduce((sum, invoice) => sum + invoice.remainingAmount, 0)),
      nextDueInvoice,
      lastPublishedInvoice: enriched[0] || null,
      apartmentsCount: apartmentIds.length,
      currency: 'MDL',
    };
  }

  async listResidentInvoices(user: MvpUser, query: Record<string, unknown> = {}) {
    const { organizationId, apartmentIds } = await this.residentInvoiceScope(user);
    if (!apartmentIds.length) {
      return this.emptyResidentList(organizationId, 'NO_APARTMENT', 'Contul tău nu este legat încă de un apartament.');
    }
    const { page, limit, skip } = resolvePagination(query, 20, 100);
    const status = optionalString(query.status);
    const where = this.residentInvoiceWhere(organizationId, apartmentIds, status);
    if (optionalString(query.apartmentId)) {
      const requestedApartmentId = optionalString(query.apartmentId)!;
      if (!apartmentIds.includes(requestedApartmentId)) throw new ForbiddenException('Nu ai acces la acest apartament.');
      where.apartmentId = requestedApartmentId;
    }
    if (query.year || query.month) {
      where.billingPeriod = {
        ...(query.year ? { year: Number(query.year) } : {}),
        ...(query.month ? { month: Number(query.month) } : {}),
      };
    }
    if (optionalString(query.billingMonth)) {
      const [year, month] = optionalString(query.billingMonth)!.split('-').map(Number);
      if (year && month) where.billingPeriod = { year, month };
    }
    const search = optionalString(query.search);
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { apartment: { number: { contains: search, mode: 'insensitive' } } },
      ];
    }
    const [allRows, association, apartments] = await Promise.all([
      this.prisma.billingDraftInvoice.findMany({
        where,
        orderBy: [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
        include: this.invoiceListInclude(),
      }),
      this.prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true, name: true, legalName: true, fiscalCode: true } }),
      this.prisma.apartment.findMany({
        where: { id: { in: apartmentIds }, organizationId },
        include: { staircase: { select: { name: true } } },
      }),
    ]);
    const paidByInvoice = await this.paidAmountsForInvoices(organizationId, allRows.map((invoice) => invoice.id));
    let items = allRows.map((invoice) => this.serializeResidentInvoiceList(invoice, paidByInvoice.get(invoice.id) || 0));
    if (status && ['UNPAID', 'OVERDUE', 'PAID', 'PARTIALLY_PAID', 'CANCELLED'].includes(status.toUpperCase())) {
      items = items.filter((invoice) => invoice.paymentDisplayStatus === status.toUpperCase());
    }
    const total = items.length;
    const pagedItems = items.slice(skip, skip + limit);
    const stats = {
      totalInvoices: total,
      totalAmount: money(items.reduce((sum, invoice) => sum + invoice.totalAmount, 0)),
      paidAmount: money(items.reduce((sum, invoice) => sum + invoice.paidAmount, 0)),
      balanceAmount: money(items.reduce((sum, invoice) => sum + invoice.remainingAmount, 0)),
      unpaidInvoices: items.filter((invoice) => invoice.remainingAmount > 0).length,
      paidInvoices: items.filter((invoice) => invoice.paymentDisplayStatus === 'PAID').length,
      overdueInvoices: items.filter((invoice) => invoice.paymentDisplayStatus === 'OVERDUE').length,
    };
    return {
      items: pagedItems,
      meta: buildPaginationMeta(page, limit, total),
      stats,
      association: association ? { id: association.id, shortName: association.name, associationCode: association.fiscalCode } : null,
      apartments: apartments.map((apartment) => ({
        id: apartment.id,
        apartmentNumber: apartment.number,
        staircase: apartment.staircase?.name || null,
        floor: apartment.floor,
      })),
      emptyStateCode: total === 0 ? 'NO_INVOICES' : null,
      emptyStateMessage: total === 0 ? 'Nu există facturi publicate încă.' : null,
    };
  }

  async getResidentInvoice(user: MvpUser, id: string) {
    const { organizationId, apartmentIds } = await this.residentInvoiceScope(user);
    const invoice = await this.prisma.billingDraftInvoice.findFirst({
      where: { ...this.residentInvoiceWhere(organizationId, apartmentIds), id },
      include: this.invoiceDetailInclude(),
    });
    if (!invoice) throw new NotFoundException('Factura nu a fost găsită.');
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        legalName: true,
        fiscalCode: true,
        address: true,
        administratorName: true,
        bankName: true,
        bankAccountIban: true,
        bankSwift: true,
        paymentInstructions: true,
      },
    });
    const [paidAmount, activePaymentIntent] = await Promise.all([
      this.paidAmountForInvoice(organizationId, invoice.id),
      this.findActivePaymentIntent(organizationId, invoice.id, invoice.apartmentId),
    ]);
    return this.serializeResidentInvoiceDetail(invoice, organization, paidAmount, activePaymentIntent);
  }

  async markResidentInvoiceViewed(user: MvpUser, id: string) {
    const { organizationId, apartmentIds } = await this.residentInvoiceScope(user);
    const invoice = await this.prisma.billingDraftInvoice.findFirst({
      where: { ...this.residentInvoiceWhere(organizationId, apartmentIds), id },
    });
    if (!invoice) throw new NotFoundException('Factura nu a fost găsită.');
    const updated = invoice.viewedAt
      ? invoice
      : await this.prisma.billingDraftInvoice.update({ where: { id: invoice.id }, data: { viewedAt: new Date() } });
    const intent = await this.findActivePaymentIntent(organizationId, invoice.id, invoice.apartmentId, [PaymentIntentStatus.CREATED]);
    if (intent) {
      const viewedIntent = await this.prisma.paymentIntent.update({
        where: { id: intent.id },
        data: { status: PaymentIntentStatus.VIEWED },
      });
      await this.addPaymentIntentEvent(viewedIntent.id, organizationId, user.id, PaymentIntentEventType.NOTE_ADDED, 'Intent vizualizat', 'Factura a fost deschisă în portalul locatarului.', {
        internalInvoiceId: invoice.id,
      });
    }
    if (!invoice.viewedAt) {
      await this.log(user, 'RESIDENT_INVOICE_VIEWED', 'Factură vizualizată', `Factura ${updated.invoiceNumber || updated.id} a fost deschisă de locatar.`, updated.id);
    }
    return { viewedAt: updated.viewedAt };
  }

  async getResidentInvoicePrintData(user: MvpUser, id: string) {
    const detail = await this.getResidentInvoice(user, id);
    return {
      organization: detail.association,
      invoiceNumber: detail.invoice.invoiceNumber,
      billingPeriod: detail.invoice.billingPeriod,
      apartment: detail.apartment,
      lines: detail.lines,
      total: detail.invoice.totalAmount,
      currency: detail.invoice.currency,
      dueDate: detail.invoice.dueDate,
      publicNote: detail.publicNote,
    };
  }

  async createResidentPaymentIntentPlaceholder(user: MvpUser, id: string, body: unknown) {
    const payload = isRecord(body) ? body : {};
    if (payload.confirm !== true) throw new BadRequestException('Confirmarea este obligatorie.');
    const { organizationId, apartmentIds, residentId } = await this.residentInvoiceScope(user);
    const invoice = await this.prisma.billingDraftInvoice.findFirst({
      where: { ...this.residentInvoiceWhere(organizationId, apartmentIds), id },
      include: this.invoiceDetailInclude(),
    });
    if (!invoice) throw new NotFoundException('Factura nu a fost găsită.');
    const paidAmount = await this.paidAmountForInvoice(organizationId, invoice.id);
    const paymentState = this.paymentState(invoice, paidAmount);
    if (!paymentState.canPayPlaceholder) throw new BadRequestException('Factura nu permite pregătirea unei plăți.');
    const duplicate = await this.findActivePaymentIntent(organizationId, invoice.id, invoice.apartmentId);
    if (duplicate) {
      return {
        intent: this.serializePaymentIntentPlaceholder(duplicate),
        duplicate: true,
        message: 'Plata online nu este activă încă. Această acțiune este doar o pregătire tehnică.',
      };
    }
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const created = await this.prisma.paymentIntent.create({
      data: {
        organizationId,
        apartmentId: invoice.apartmentId,
        residentId,
        createdByUserId: user.id,
        provider: PaymentProvider.NONE,
        providerType: null,
        source: PaymentIntentSource.RESIDENT_PORTAL,
        paymentMethodType: null,
        status: PaymentIntentStatus.CREATED,
        currency: BillingCurrency.MDL,
        amount: paymentState.remainingAmount,
        description: `Pregătire plată pentru factura ${invoice.invoiceNumber || invoice.id}`,
        expiresAt,
        metadataJson: {
          internalInvoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          billingMonth: monthKey(invoice.billingPeriod),
          placeholder: true,
          provider: 'NONE',
          realMoneyProcessed: false,
        },
      },
      include: this.paymentIntentInclude(),
    });
    await this.addPaymentIntentEvent(created.id, organizationId, user.id, PaymentIntentEventType.INTENT_CREATED, 'Intent placeholder creat', 'Plata online nu este activă încă. Nu s-au procesat bani.', {
      internalInvoiceId: invoice.id,
      amount: created.amount,
      currency: created.currency,
      realMoneyProcessed: false,
    });
    await this.log(user, 'PAYMENT_INTENT_PLACEHOLDER_CREATED', 'Pregătire plată creată', `Locatarul a pregătit plata pentru factura ${invoice.invoiceNumber || invoice.id}. Nu s-au procesat bani.`, invoice.id);
    return {
      intent: this.serializePaymentIntentPlaceholder(created),
      duplicate: false,
      message: 'Plata online nu este activă încă. Această acțiune este doar o pregătire tehnică.',
    };
  }

  async cancelResidentPaymentIntentPlaceholder(user: MvpUser, id: string, body: unknown) {
    const { organizationId, apartmentIds } = await this.residentInvoiceScope(user);
    const payload = isRecord(body) ? body : {};
    const reason = optionalString(payload.reason) || 'Anulat de locatar.';
    const intent = await this.prisma.paymentIntent.findFirst({
      where: {
        id,
        organizationId,
        apartmentId: { in: apartmentIds.length ? apartmentIds : ['__none__'] },
        source: PaymentIntentSource.RESIDENT_PORTAL,
        status: { in: ACTIVE_PLACEHOLDER_INTENT_STATUSES },
      },
      include: this.paymentIntentInclude(),
    });
    if (!intent) throw new NotFoundException('Intenția de plată nu a fost găsită.');
    const updated = await this.prisma.paymentIntent.update({
      where: { id: intent.id },
      data: {
        status: PaymentIntentStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledById: user.id,
        cancellationReason: reason,
      },
      include: this.paymentIntentInclude(),
    });
    await this.addPaymentIntentEvent(updated.id, organizationId, user.id, PaymentIntentEventType.INTENT_CANCELLED, 'Intent placeholder anulat', reason, {
      internalInvoiceId: this.internalInvoiceIdFromIntent(updated),
      realMoneyProcessed: false,
    });
    await this.log(user, 'PAYMENT_INTENT_PLACEHOLDER_CANCELLED', 'Pregătire plată anulată', reason, this.internalInvoiceIdFromIntent(updated));
    return { intent: this.serializePaymentIntentPlaceholder(updated), message: 'Pregătirea plății a fost anulată.' };
  }

  private async adminInvoiceWhere(organizationId: string, query: Record<string, unknown>) {
    const where: Prisma.BillingDraftInvoiceWhereInput = { organizationId };
    const status = optionalString(query.status) as BillingDraftInvoiceStatus | undefined;
    if (status && Object.values(BillingDraftInvoiceStatus).includes(status)) where.status = status;
    if (optionalString(query.billingPeriodId)) where.billingPeriodId = optionalString(query.billingPeriodId);
    if (optionalString(query.apartmentId)) where.apartmentId = optionalString(query.apartmentId);
    if (this.bool(query.onlyUnpublished)) where.status = { in: [BillingDraftInvoiceStatus.DRAFT, BillingDraftInvoiceStatus.IN_REVIEW, BillingDraftInvoiceStatus.APPROVED] };
    if (this.bool(query.onlyPublished)) where.status = { in: [BillingDraftInvoiceStatus.PUBLISHED, BillingDraftInvoiceStatus.PAID, BillingDraftInvoiceStatus.PARTIALLY_PAID] };
    const apartmentWhere: Prisma.ApartmentWhereInput = {};
    if (optionalString(query.buildingId)) apartmentWhere.buildingId = optionalString(query.buildingId);
    if (optionalString(query.entranceId)) apartmentWhere.staircaseId = optionalString(query.entranceId);
    if (Object.keys(apartmentWhere).length) where.apartment = apartmentWhere;
    const search = optionalString(query.search);
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { apartment: { number: { contains: search, mode: 'insensitive' } } },
        { apartment: { building: { name: { contains: search, mode: 'insensitive' } } } },
        { apartment: { staircase: { name: { contains: search, mode: 'insensitive' } } } },
        { resident: { firstName: { contains: search, mode: 'insensitive' } } },
        { resident: { lastName: { contains: search, mode: 'insensitive' } } },
        { owner: { firstName: { contains: search, mode: 'insensitive' } } },
        { owner: { lastName: { contains: search, mode: 'insensitive' } } },
      ];
    }
    return where;
  }

  private async publishOne(user: MvpUser, id: string, payload: PublishInput, fromBulk: boolean) {
    const organizationId = this.requireAdminOrganization(user);
    const invoice = await this.prisma.billingDraftInvoice.findFirst({
      where: { id, organizationId },
      include: this.invoiceDetailInclude(),
    });
    if (!invoice) throw new NotFoundException('Factura nu a fost găsită.');
    if (invoice.status === BillingDraftInvoiceStatus.PUBLISHED && fromBulk) return this.serializeAdminInvoiceDetail(invoice, []);
    if (invoice.status !== BillingDraftInvoiceStatus.APPROVED) throw new BadRequestException('Factura trebuie să fie APPROVED înainte de publicare.');
    const effectiveDueDate = parseDate(payload.dueDate) || invoice.dueDate || null;
    const blocking = this.invoiceIssues(invoice, { effectiveDueDate }).filter((issue) => issue.blocking && !['MISSING_DUE_DATE', 'RESIDENT_WITHOUT_USER_ACCOUNT'].includes(issue.type));
    if (blocking.length) throw new BadRequestException(blocking[0]?.title || 'Factura are probleme critice.');
    const invoiceNumber = invoice.invoiceNumber || (await this.generateInvoiceNumber(organizationId, invoice));
    const updated = await this.prisma.billingDraftInvoice.update({
      where: { id: invoice.id },
      data: {
        status: BillingDraftInvoiceStatus.PUBLISHED,
        publishedAt: new Date(),
        publishedById: user.id,
        dueDate: effectiveDueDate,
        publicNote: payload.publicNote === undefined ? invoice.publicNote : optionalString(payload.publicNote) || null,
        invoiceNumber,
        // TODO(ES-183): create resident in-app/email notification when resident notification routing is finalized.
      },
      include: this.invoiceDetailInclude(),
    });
    await this.log(user, 'INVOICE_PUBLISHED', 'Factură publicată', `Factura ${invoiceNumber} a fost publicată în portalul locatarului.`, updated.id);
    return this.serializeAdminInvoiceDetail(updated, []);
  }

  private parsePublishInput(body: unknown): PublishInput {
    const payload = isRecord(body) ? body : {};
    return {
      confirm: payload.confirm === true,
      dueDate: optionalString(payload.dueDate) || null,
      publicNote: optionalString(payload.publicNote) || null,
    };
  }

  private async getIssuesForOrganization(organizationId: string, query: Record<string, unknown>) {
    const where: Prisma.BillingDraftInvoiceWhereInput = { organizationId };
    if (optionalString(query.billingPeriodId)) where.billingPeriodId = optionalString(query.billingPeriodId);
    if (optionalString(query.invoiceId)) where.id = optionalString(query.invoiceId);
    const invoices = await this.prisma.billingDraftInvoice.findMany({
      where,
      include: this.invoiceDetailInclude(),
    });
    const issues = invoices.flatMap((invoice) => this.invoiceIssues(invoice));
    const duplicateNumbers = new Set(
      Object.entries(
        invoices.reduce<Record<string, number>>((acc, invoice) => {
          if (invoice.invoiceNumber) acc[invoice.invoiceNumber] = (acc[invoice.invoiceNumber] || 0) + 1;
          return acc;
        }, {}),
      )
        .filter(([, count]) => count > 1)
        .map(([invoiceNumber]) => invoiceNumber),
    );
    invoices.forEach((invoice) => {
      if (invoice.invoiceNumber && duplicateNumbers.has(invoice.invoiceNumber)) {
        issues.push(this.issue('DUPLICATE_INVOICE_NUMBER', 'CRITICAL', true, `Număr duplicat: ${invoice.invoiceNumber}.`, 'Schimbă numărul facturii înainte de publicare.', invoice));
      }
    });
    return issues;
  }

  private invoiceIssues(invoice: any, options: { effectiveDueDate?: Date | null } = {}): InvoiceIssue[] {
    const issues: InvoiceIssue[] = [];
    const total = numberFromDecimal(invoice.total);
    if (!invoice.lines?.length) issues.push(this.issue('INVOICE_WITHOUT_LINES', 'CRITICAL', true, 'Factura nu are linii.', 'Recalculează drafturile sau verifică tarifele.', invoice));
    if (total === 0) issues.push(this.issue('INVOICE_TOTAL_ZERO', 'WARNING', false, 'Factura are total zero.', 'Confirmă că nu există consum sau taxe pentru acest apartament.', invoice));
    if (total < 0) issues.push(this.issue('INVOICE_WITH_NEGATIVE_TOTAL', 'CRITICAL', true, 'Factura are total negativ.', 'Corectează liniile de calcul înainte de publicare.', invoice));
    if (!invoice.ownerId) issues.push(this.issue('APARTMENT_WITHOUT_OWNER', invoice.residentId ? 'WARNING' : 'CRITICAL', !invoice.residentId, 'Apartamentul nu are proprietar legat.', 'Leagă proprietarul sau confirmă locatarul principal.', invoice));
    if (!invoice.residentId) issues.push(this.issue('APARTMENT_WITHOUT_RESIDENT', invoice.ownerId ? 'WARNING' : 'CRITICAL', !invoice.ownerId, 'Apartamentul nu are locatar legat.', 'Leagă locatarul sau proprietarul înainte de publicare.', invoice));
    const contact = invoice.resident || invoice.owner;
    if (contact && !contact.userId) issues.push(this.issue('RESIDENT_WITHOUT_USER_ACCOUNT', 'WARNING', false, 'Contactul nu are cont de locatar.', 'Factura va fi publicată, dar locatarul o vede doar după activarea contului.', invoice));
    if (!(options.effectiveDueDate === undefined ? invoice.dueDate : options.effectiveDueDate)) {
      issues.push(this.issue('MISSING_DUE_DATE', 'WARNING', false, 'Scadența nu este setată.', 'Setează scadența înainte de publicare.', invoice));
    }
    if (invoice.billingPeriod && invoice.billingPeriod.status !== BillingPeriodStatus.APPROVED && !PUBLISHED_OR_SETTLED_STATUSES.includes(invoice.status)) {
      issues.push(this.issue('BILLING_PERIOD_NOT_APPROVED', 'CRITICAL', true, 'Perioada de facturare nu este aprobată.', 'Aprobă perioada în Drafturi facturi înainte de publicare.', invoice));
    }
    if (invoice.status !== BillingDraftInvoiceStatus.APPROVED && !PUBLISHED_OR_SETTLED_STATUSES.includes(invoice.status)) {
      issues.push(this.issue('INVOICE_NOT_APPROVED', 'CRITICAL', true, 'Factura nu este aprobată.', 'Marchează factura APPROVED înainte de publicare.', invoice));
    }
    if (invoice.status === BillingDraftInvoiceStatus.PUBLISHED) {
      issues.push(this.issue('ALREADY_PUBLISHED', 'INFO', false, 'Factura este deja publicată.', 'Nu este necesară republicarea.', invoice));
    }
    return issues;
  }

  private issue(type: IssueType, severity: IssueSeverity, blocking: boolean, title: string, recommendation: string, invoice: any): InvoiceIssue {
    const contact = invoice.resident || invoice.owner || null;
    return {
      id: `${type}:${invoice.id}`,
      type,
      severity,
      blocking,
      title,
      recommendation,
      invoice: { id: invoice.id, invoiceNumber: invoice.invoiceNumber, status: invoice.status, total: numberFromDecimal(invoice.total) },
      apartment: invoice.apartment
        ? { id: invoice.apartment.id, number: invoice.apartment.number, building: invoice.apartment.building?.name || null, entrance: invoice.apartment.staircase?.name || null }
        : null,
      resident: contact ? { id: contact.id, name: fullName(contact), hasUserAccount: Boolean(contact.userId) } : null,
    };
  }

  private issuesByInvoice(issues: InvoiceIssue[]) {
    const map = new Map<string, InvoiceIssue[]>();
    issues.forEach((issue) => {
      if (!issue.invoice?.id) return;
      map.set(issue.invoice.id, [...(map.get(issue.invoice.id) || []), issue]);
    });
    return map;
  }

  private requireAdminOrganization(user: MvpUser) {
    if (user.role !== Role.ADMIN && user.role !== Role.SUPERADMIN) throw new ForbiddenException('Admin access required.');
    if (!user.organizationId) throw new ForbiddenException('Organization context missing.');
    return user.organizationId;
  }

  private async residentInvoiceScope(user: MvpUser) {
    if (user.role !== Role.RESIDENT) throw new ForbiddenException('Resident access required.');
    if (!user.organizationId) throw new ForbiddenException('Organization context missing.');
    const profiles = await this.prisma.residentProfile.findMany({
      where: { organizationId: user.organizationId, userId: user.id, archivedAt: null },
      select: {
        id: true,
        apartmentId: true,
        apartmentResidents: { select: { apartmentId: true } },
      },
    });
    const apartmentIds = Array.from(new Set(profiles.flatMap((profile) => [profile.apartmentId, ...profile.apartmentResidents.map((link) => link.apartmentId)].filter(Boolean)))) as string[];
    return { organizationId: user.organizationId, apartmentIds, residentId: profiles[0]?.id || null };
  }

  private residentInvoiceWhere(organizationId: string, apartmentIds: string[], status?: string | null): Prisma.BillingDraftInvoiceWhereInput {
    const where: Prisma.BillingDraftInvoiceWhereInput = {
      organizationId,
      apartmentId: { in: apartmentIds.length ? apartmentIds : ['__none__'] },
      publishedAt: { not: null },
      status: { in: RESIDENT_VISIBLE_INVOICE_STATUSES },
    };
    const normalized = status?.trim().toUpperCase() as BillingDraftInvoiceStatus | undefined;
    if (normalized && Object.values(BillingDraftInvoiceStatus).includes(normalized) && RESIDENT_VISIBLE_INVOICE_STATUSES.includes(normalized)) {
      where.status = normalized;
    }
    return where;
  }

  private async paidAmountsForInvoices(organizationId: string, invoiceIds: string[]) {
    const entries = await Promise.all(invoiceIds.map(async (invoiceId) => [invoiceId, await this.paidAmountForInvoice(organizationId, invoiceId)] as const));
    return new Map(entries);
  }

  private async paidAmountForInvoice(organizationId: string, invoiceId: string) {
    const rows: Array<{ amount: unknown }> = await this.prisma.payment.findMany({
      where: {
        organizationId,
        status: PaymentStatus.CONFIRMED,
        paymentIntent: { is: { metadataJson: { path: ['internalInvoiceId'], equals: invoiceId } } },
      },
      select: { amount: true },
    }).catch(() => []);
    return money(rows.reduce((sum, payment) => sum + Number(payment.amount || 0), 0));
  }

  private paymentState(invoice: any, paidAmountInput = 0) {
    const total = money(numberFromDecimal(invoice.total));
    let paidAmount = money(paidAmountInput);
    if (invoice.status === BillingDraftInvoiceStatus.PAID && paidAmount <= 0) paidAmount = total;
    const remainingAmount = money(Math.max(total - paidAmount, 0));
    let paymentDisplayStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED' = 'UNPAID';
    if (invoice.status === BillingDraftInvoiceStatus.CANCELLED) paymentDisplayStatus = 'CANCELLED';
    else if (remainingAmount <= 0 || invoice.status === BillingDraftInvoiceStatus.PAID) paymentDisplayStatus = 'PAID';
    else if (invoice.dueDate && new Date(invoice.dueDate).getTime() < Date.now()) paymentDisplayStatus = 'OVERDUE';
    else if (paidAmount > 0 || invoice.status === BillingDraftInvoiceStatus.PARTIALLY_PAID) paymentDisplayStatus = 'PARTIALLY_PAID';
    const canPayPlaceholder = ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'].includes(paymentDisplayStatus) && remainingAmount > 0;
    return { total, paidAmount, remainingAmount, paymentDisplayStatus, canPayPlaceholder };
  }

  private async findActivePaymentIntent(
    organizationId: string,
    invoiceId: string,
    apartmentId: string,
    statuses: PaymentIntentStatus[] = ACTIVE_PLACEHOLDER_INTENT_STATUSES,
  ) {
    return this.prisma.paymentIntent.findFirst({
      where: {
        organizationId,
        apartmentId,
        source: PaymentIntentSource.RESIDENT_PORTAL,
        status: { in: statuses },
        metadataJson: { path: ['internalInvoiceId'], equals: invoiceId },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: this.paymentIntentInclude(),
      orderBy: { createdAt: 'desc' },
    });
  }

  private paymentIntentInclude() {
    return {
      apartment: { select: { id: true, number: true, staircase: { select: { name: true } }, building: { select: { name: true } } } },
      resident: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      organization: { select: { id: true, name: true, legalName: true, fiscalCode: true } },
    } satisfies Prisma.PaymentIntentInclude;
  }

  private serializePaymentIntentPlaceholder(intent: any) {
    const metadata = intent.metadataJson && typeof intent.metadataJson === 'object' ? intent.metadataJson : {};
    return {
      id: intent.id,
      invoiceId: metadata.internalInvoiceId || intent.invoiceId || null,
      invoiceNumber: metadata.invoiceNumber || null,
      amount: Number(intent.amount || 0),
      currency: intent.currency,
      status: intent.status,
      provider: intent.provider,
      providerReference: intent.providerReference || null,
      expiresAt: intent.expiresAt,
      createdAt: intent.createdAt,
      updatedAt: intent.updatedAt,
      message: 'Plata online nu este activă încă. Această acțiune nu retrage bani.',
      realMoneyProcessed: false,
    };
  }

  private internalInvoiceIdFromIntent(intent: any) {
    const metadata = intent.metadataJson && typeof intent.metadataJson === 'object' ? intent.metadataJson : {};
    return metadata.internalInvoiceId || null;
  }

  private async addPaymentIntentEvent(
    paymentIntentId: string,
    organizationId: string,
    actorUserId: string | null,
    eventType: PaymentIntentEventType,
    title: string,
    message: string,
    metadata: Record<string, unknown>,
  ) {
    await this.prisma.paymentIntentEvent.create({
      data: { paymentIntentId, associationId: organizationId, actorUserId, eventType, title, message, metadata: metadata as Prisma.InputJsonObject },
    }).catch(() => undefined);
  }

  private invoiceListInclude() {
    return {
      billingPeriod: true,
      apartment: { include: { building: { select: { id: true, name: true } }, staircase: { select: { id: true, name: true } } } },
      owner: true,
      resident: true,
      _count: { select: { lines: true } },
    } satisfies Prisma.BillingDraftInvoiceInclude;
  }

  private invoiceDetailInclude() {
    return {
      billingPeriod: true,
      apartment: { include: { building: { select: { id: true, name: true } }, staircase: { select: { id: true, name: true } } } },
      owner: true,
      resident: true,
      publishedBy: { select: { id: true, firstName: true, lastName: true, fullName: true, email: true } },
      lines: { include: { meter: true, meterReading: true }, orderBy: { createdAt: 'asc' } },
    } satisfies Prisma.BillingDraftInvoiceInclude;
  }

  private serializeAdminInvoice(invoice: any, issues: InvoiceIssue[]) {
    return {
      ...this.serializeInvoiceBase(invoice),
      billingPeriod: invoice.billingPeriod,
      billingMonth: monthKey(invoice.billingPeriod),
      apartment: apartmentInfo(invoice.apartment),
      owner: invoice.owner ? { id: invoice.owner.id, name: fullName(invoice.owner), phone: invoice.owner.phone, email: invoice.owner.email, hasUserAccount: Boolean(invoice.owner.userId) } : null,
      resident: invoice.resident ? { id: invoice.resident.id, name: fullName(invoice.resident), phone: invoice.resident.phone, email: invoice.resident.email, hasUserAccount: Boolean(invoice.resident.userId) } : null,
      linesCount: invoice._count?.lines ?? invoice.lines?.length ?? 0,
      issues,
    };
  }

  private serializeAdminInvoiceDetail(invoice: any, issues: InvoiceIssue[]) {
    return {
      ...this.serializeAdminInvoice({ ...invoice, _count: { lines: invoice.lines?.length || 0 } }, issues),
      publishedBy: invoice.publishedBy ? { id: invoice.publishedBy.id, name: fullName(invoice.publishedBy) || invoice.publishedBy.email } : null,
      lines: (invoice.lines || []).map((line: any) => this.serializeLine(line)),
    };
  }

  private serializeInvoiceBase(invoice: any) {
    const total = numberFromDecimal(invoice.total);
    const paidAmount = invoice.status === BillingDraftInvoiceStatus.PAID ? total : 0;
    return {
      id: invoice.id,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      total,
      totalAmount: total,
      paidAmount,
      balanceAmount: Math.max(total - paidAmount, 0),
      currency: invoice.currency,
      dueDate: invoice.dueDate,
      publishedAt: invoice.publishedAt,
      viewedAt: invoice.viewedAt,
      publicNote: invoice.publicNote,
      internalNote: invoice.internalNote,
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt,
    };
  }

  private serializeLine(line: any) {
    return {
      id: line.id,
      type: line.type,
      lineType: line.meterId ? 'METER_CONSUMPTION' : 'SERVICE',
      name: line.description,
      description: line.description,
      quantity: numberFromDecimal(line.quantity),
      unit: line.unit,
      unitPrice: numberFromDecimal(line.unitPrice),
      amount: numberFromDecimal(line.amount),
      currency: line.currency,
      meterId: line.meterId,
      meterReadingId: line.meterReadingId,
      meter: line.meter ? { id: line.meter.id, type: line.meter.type, serialNumber: line.meter.serialNumber } : null,
      meterReading: line.meterReading ? { id: line.meterReading.id, value: line.meterReading.value, readingDate: line.meterReading.readingDate } : null,
    };
  }

  private serializeResidentInvoiceList(invoice: any, paidAmount = 0) {
    const base = this.serializeInvoiceBase(invoice);
    const billingMonth = monthKey(invoice.billingPeriod);
    const payment = this.paymentState(invoice, paidAmount);
    return {
      ...base,
      paidAmount: payment.paidAmount,
      balanceAmount: payment.remainingAmount,
      remainingAmount: payment.remainingAmount,
      paymentDisplayStatus: payment.paymentDisplayStatus,
      billingMonth,
      billingPeriod: invoice.billingPeriod,
      apartmentId: invoice.apartmentId,
      apartment: apartmentInfo(invoice.apartment),
      association: { id: invoice.organizationId, shortName: '', associationCode: null },
      issueDate: invoice.publishedAt,
      isOverdue: payment.paymentDisplayStatus === 'OVERDUE',
      canPayPlaceholder: payment.canPayPlaceholder,
      canPrint: true,
    };
  }

  private serializeResidentInvoiceDetail(invoice: any, organization: any, paidAmount = 0, activePaymentIntent: any = null) {
    const base = this.serializeResidentInvoiceList(invoice, paidAmount);
    return {
      invoice: {
        ...base,
        subtotalAmount: numberFromDecimal(invoice.subtotal),
        billingPeriod: invoice.billingPeriod,
      },
      association: {
        id: organization?.id || null,
        legalName: organization?.legalName || organization?.name || '',
        shortName: organization?.name || '',
        associationCode: organization?.fiscalCode || null,
        address: organization?.address || null,
        administratorName: organization?.administratorName || null,
      },
      apartment: apartmentInfo(invoice.apartment),
      administratorContact: {
        name: organization?.administratorName || null,
        paymentInstructions: {
          configured: Boolean(organization?.bankAccountIban || organization?.paymentInstructions),
          bankName: organization?.bankName || null,
          bankAccountIban: organization?.bankAccountIban || null,
          bankSwift: organization?.bankSwift || null,
          paymentInstructions: organization?.paymentInstructions || null,
        },
      },
      lines: invoice.lines.map((line: any) => this.serializeLine(line)),
      publicNote: invoice.publicNote,
      paymentDisplayStatus: base.paymentDisplayStatus,
      paidAmount: base.paidAmount,
      remainingAmount: base.remainingAmount,
      canPayPlaceholder: base.canPayPlaceholder,
      activePaymentIntent: activePaymentIntent ? this.serializePaymentIntentPlaceholder(activePaymentIntent) : null,
      paymentUnavailableMessage: 'Plata online va fi disponibilă ulterior.',
      payments: [],
    };
  }

  private emptyResidentList(organizationId: string, code: string, message: string) {
    return {
      items: [],
      meta: buildPaginationMeta(1, 20, 0),
      stats: { totalInvoices: 0, totalAmount: 0, paidAmount: 0, balanceAmount: 0, unpaidInvoices: 0, paidInvoices: 0, overdueInvoices: 0 },
      association: { id: organizationId, shortName: '', associationCode: null },
      apartments: [],
      emptyStateCode: code,
      emptyStateMessage: message,
    };
  }

  private async generateInvoiceNumber(organizationId: string, invoice: any) {
    const rawApartment = String(invoice.apartment?.number || 'AP').replace(/[^a-zA-Z0-9-]/g, '');
    const base = `INV-${invoice.billingPeriod?.year || new Date().getFullYear()}${String(invoice.billingPeriod?.month || new Date().getMonth() + 1).padStart(2, '0')}-${rawApartment}-${invoice.id.slice(0, 6).toUpperCase()}`;
    await this.assertInvoiceNumberAvailable(organizationId, base, invoice.id);
    return base;
  }

  private async assertInvoiceNumberAvailable(organizationId: string, invoiceNumber: string, currentId: string) {
    const duplicate = await this.prisma.billingDraftInvoice.findFirst({
      where: { organizationId, invoiceNumber, id: { not: currentId } },
      select: { id: true },
    });
    if (duplicate) throw new BadRequestException('Numărul facturii există deja în organizație.');
  }

  private bool(value: unknown) {
    return value === true || value === 'true' || value === '1';
  }

  private async log(user: MvpUser, type: Parameters<ActivityMvpService['createActivity']>[0]['type'], title: string, message: string, invoiceId?: string | null) {
    const baseLink = user.role === Role.RESIDENT ? '/resident/invoices' : '/admin/invoices';
    await this.activity.createActivity({
      organizationId: user.organizationId,
      actorUserId: user.id,
      type,
      title,
      message,
      targetType: 'INVOICE',
      targetId: invoiceId || null,
      link: invoiceId ? `${baseLink}/${invoiceId}` : baseLink,
    });
  }
}
