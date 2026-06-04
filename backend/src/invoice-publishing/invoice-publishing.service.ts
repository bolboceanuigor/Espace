import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BillingCurrency,
  BillingDraftInvoiceStatus,
  BillingPeriodStatus,
  FileAssetEntityType,
  PaymentMethod,
  PaymentIntentEventType,
  PaymentIntentSource,
  PaymentIntentStatus,
  PaymentProofStatus,
  PaymentProvider,
  PaymentSource,
  PaymentStatus,
  Prisma,
  Role,
  NotificationType,
} from '@prisma/client';
import { ActivityMvpService } from '../activity-mvp/activity-mvp.service';
import { bindOwnedFileAssetToEntity, requireOwnedFileAsset } from '../common/file-asset-reference';
import { assertInternalFileUrl } from '../common/file-url-policy';
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

type PaymentProofIssueType =
  | 'AMOUNT_EXCEEDS_REMAINING'
  | 'INVOICE_ALREADY_PAID'
  | 'INVOICE_CANCELLED'
  | 'MISSING_PROOF_FILE'
  | 'MISSING_PAID_DATE'
  | 'DUPLICATE_PROOF'
  | 'CURRENCY_MISMATCH'
  | 'PAYMENT_ALREADY_ACCEPTED'
  | 'RESIDENT_NOT_LINKED_TO_INVOICE';

type PaymentProofIssue = {
  id: string;
  type: PaymentProofIssueType;
  severity: IssueSeverity;
  blocking: boolean;
  title: string;
  recommendation: string;
  proof?: Record<string, unknown> | null;
  invoice?: Record<string, unknown> | null;
  apartment?: Record<string, unknown> | null;
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

const ACCEPTED_PAYMENT_STATUSES: PaymentStatus[] = [
  PaymentStatus.ACCEPTED,
  PaymentStatus.PARTIALLY_ACCEPTED,
  PaymentStatus.CONFIRMED,
];

const REVERSIBLE_PAYMENT_STATUSES: PaymentStatus[] = [
  PaymentStatus.ACCEPTED,
  PaymentStatus.PARTIALLY_ACCEPTED,
  PaymentStatus.CONFIRMED,
];

const REVIEWABLE_PAYMENT_PROOF_STATUSES: PaymentProofStatus[] = [
  PaymentProofStatus.SUBMITTED,
  PaymentProofStatus.IN_REVIEW,
];

const ACCEPTED_PAYMENT_PROOF_STATUSES: PaymentProofStatus[] = [
  PaymentProofStatus.ACCEPTED,
  PaymentProofStatus.PARTIALLY_ACCEPTED,
];

const LEDGER_INVOICE_STATUSES: BillingDraftInvoiceStatus[] = [
  BillingDraftInvoiceStatus.PUBLISHED,
  BillingDraftInvoiceStatus.PARTIALLY_PAID,
  BillingDraftInvoiceStatus.PAID,
];

// Pilot finance source of truth: BillingDraftInvoice plus Payment.billingDraftInvoiceId.
// Legacy ResidentInvoice/client-note invoice writes stay blocked so balances cannot diverge.

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
    const paidByInvoice = await this.paidAmountsForInvoices(organizationId, rows.map((invoice) => invoice.id));
    return {
      items: rows.map((invoice) => this.serializeAdminInvoice(invoice, issuesByInvoice.get(invoice.id) || [], paidByInvoice.get(invoice.id) || 0)),
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
    const [issues, activity, paymentProofs, paidAmount] = await Promise.all([
      this.getIssuesForOrganization(organizationId, { invoiceId: id }).then((items) => items.filter((issue) => issue.invoice?.id === id)),
      this.prisma.auditLog.findMany({
        where: { organizationId, entityId: id },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { user: { select: { id: true, firstName: true, lastName: true, fullName: true, email: true } } },
      }),
      this.prisma.paymentProof.findMany({
        where: { organizationId, invoiceId: id },
        include: this.paymentProofInclude(),
        orderBy: [{ createdAt: 'desc' }],
      }),
      this.paidAmountForInvoice(organizationId, id),
    ]);
    const proofRows = await this.withPaymentProofFileAssetIds(organizationId, paymentProofs);
    return {
      invoice: {
        ...this.serializeAdminInvoiceDetail(invoice, issues, paidAmount),
        paymentProofs: proofRows.map((proof) => this.serializeAdminPaymentProof(proof)),
        paymentProofsSummary: {
          submitted: proofRows.filter((proof) => proof.status === PaymentProofStatus.SUBMITTED).length,
          inReview: proofRows.filter((proof) => proof.status === PaymentProofStatus.IN_REVIEW).length,
          accepted: proofRows.filter((proof) => proof.status === PaymentProofStatus.ACCEPTED || proof.status === PaymentProofStatus.PARTIALLY_ACCEPTED).length,
          rejected: proofRows.filter((proof) => proof.status === PaymentProofStatus.REJECTED).length,
        },
      },
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
    const paymentCount = await this.prisma.payment
      .count({
        where: {
          organizationId,
          OR: [{ invoiceId: invoice.id }, { billingDraftInvoiceId: invoice.id }],
        },
      })
      .catch(() => 0);
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
    const [paidAmount, activePaymentIntent, paymentProofs] = await Promise.all([
      this.paidAmountForInvoice(organizationId, invoice.id),
      this.findActivePaymentIntent(organizationId, invoice.id, invoice.apartmentId),
      this.prisma.paymentProof.findMany({
        where: { organizationId, invoiceId: invoice.id, residentUserId: user.id },
        include: this.paymentProofInclude(),
        orderBy: [{ createdAt: 'desc' }],
      }),
    ]);
    const proofRows = await this.withPaymentProofFileAssetIds(organizationId, paymentProofs);
    return this.serializeResidentInvoiceDetail(invoice, organization, paidAmount, activePaymentIntent, proofRows);
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

  async submitResidentPaymentProof(user: MvpUser, invoiceId: string, body: unknown) {
    const payload = isRecord(body) ? body : {};
    const amount = Number(payload.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('Suma achitată trebuie să fie mai mare decât 0.');
    const method = this.parseLedgerPaymentMethod(payload.method || PaymentMethod.MANUAL_BANK_TRANSFER);
    const currency = optionalString(payload.currency)?.toUpperCase() || 'MDL';
    if (currency !== 'MDL') throw new BadRequestException('Momentan sunt acceptate doar dovezi în MDL.');
    const { organizationId, apartmentIds } = await this.residentInvoiceScope(user);
    const invoice = await this.prisma.billingDraftInvoice.findFirst({
      where: { ...this.residentInvoiceWhere(organizationId, apartmentIds), id: invoiceId },
      include: this.invoiceDetailInclude(),
    });
    if (!invoice) throw new NotFoundException('Factura nu a fost găsită.');
    const paidAmount = await this.paidAmountForInvoice(organizationId, invoice.id);
    const state = this.paymentState(invoice, paidAmount);
    if (state.paymentDisplayStatus === 'CANCELLED') throw new BadRequestException('Nu poți trimite dovadă pentru o factură anulată.');
    if (state.paymentDisplayStatus === 'PAID' || state.remainingAmount <= 0) throw new BadRequestException('Factura este deja achitată.');
    if (money(amount) > state.remainingAmount) throw new BadRequestException('Suma dovezii depășește soldul rămas al facturii.');
    const paidAt = parseDate(payload.paidAt) || null;
    const externalReference = optionalString(payload.externalReference) || null;
    const proofFileUrl = optionalString(payload.proofFileUrl) || null;
    const proofAsset = proofFileUrl
      ? await requireOwnedFileAsset(this.prisma, {
          organizationId,
          fileUrl: proofFileUrl,
          entityTypes: [FileAssetEntityType.RECEIPT_PDF, FileAssetEntityType.OTHER],
          message: 'Dovada trebuie încărcată prin uploaderul Espace.',
        })
      : null;
    if (proofFileUrl) {
      assertInternalFileUrl(proofFileUrl, 'Dovada trebuie încărcată prin Espace.');
    }
    const duplicate = await this.findPossibleDuplicatePaymentProof(organizationId, invoice.id, money(amount), paidAt, externalReference);
    const created = await this.prisma.paymentProof.create({
      data: {
        organizationId,
        invoiceId: invoice.id,
        apartmentId: invoice.apartmentId,
        residentUserId: user.id,
        amount: money(amount),
        currency: BillingCurrency.MDL,
        method,
        status: PaymentProofStatus.SUBMITTED,
        paidAt,
        externalReference,
        residentNote: optionalString(payload.residentNote) || null,
        proofFileUrl,
        proofFileName: proofAsset?.fileName || optionalString(payload.proofFileName) || null,
        proofFileMimeType: proofAsset?.mimeType || optionalString(payload.proofFileMimeType) || null,
        proofFileSize: proofAsset?.sizeBytes ?? (Number.isFinite(Number(payload.proofFileSize)) ? Number(payload.proofFileSize) : null),
        possibleDuplicate: Boolean(duplicate),
        duplicatePaymentProofId: duplicate?.id || null,
        metadataJson: {
          invoiceNumber: invoice.invoiceNumber,
          remainingAmount: state.remainingAmount,
          possibleDuplicate: Boolean(duplicate),
          uploadStorage: proofFileUrl ? 'espace_internal' : null,
          realMoneyProcessed: false,
        },
      },
      include: this.paymentProofInclude(),
    });
    if (proofAsset) {
      await bindOwnedFileAssetToEntity(this.prisma, {
        organizationId,
        fileUrl: proofAsset.fileUrl,
        entityType: [FileAssetEntityType.RECEIPT_PDF, FileAssetEntityType.OTHER],
        entityId: created.id,
        message: 'Dovada trebuie încărcată prin uploaderul Espace.',
      });
    }
    await this.log(user, 'PAYMENT_PROOF_SUBMITTED', 'Dovadă de plată trimisă', `Locatarul a trimis o dovadă pentru factura ${invoice.invoiceNumber || invoice.id}.`, invoice.id);
    await this.activity.notifyOrganizationAdmins({
      organizationId,
      type: NotificationType.PAYMENT,
      title: 'Dovadă de plată trimisă',
      message: `A fost trimisă o dovadă de ${money(amount).toLocaleString('ro-RO')} MDL pentru factura ${invoice.invoiceNumber || invoice.id}.`,
      link: '/admin/payment-proofs',
    }).catch(() => undefined);
    const [serialized] = await this.withPaymentProofFileAssetIds(organizationId, [created]);
    return {
      proof: this.serializeResidentPaymentProof(serialized, true),
      possibleDuplicate: Boolean(duplicate),
      warning: duplicate ? 'Există deja o dovadă similară pentru această factură. Adminul o va verifica.' : null,
      message: 'Dovada a fost trimisă spre verificare.',
    };
  }

  async listResidentPaymentProofs(user: MvpUser, query: Record<string, unknown> = {}) {
    const { organizationId, apartmentIds } = await this.residentInvoiceScope(user);
    const { page, limit, skip } = resolvePagination(query, 20, 100);
    const where: Prisma.PaymentProofWhereInput = {
      organizationId,
      residentUserId: user.id,
      apartmentId: { in: apartmentIds.length ? apartmentIds : ['__none__'] },
    };
    const status = optionalString(query.status)?.toUpperCase() as PaymentProofStatus | undefined;
    if (status && Object.values(PaymentProofStatus).includes(status)) where.status = status;
    const invoiceId = optionalString(query.invoiceId);
    if (invoiceId) where.invoiceId = invoiceId;
    const [rows, total] = await Promise.all([
      this.prisma.paymentProof.findMany({
        where,
        include: this.paymentProofInclude(),
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.paymentProof.count({ where }),
    ]);
    const enriched = await this.withPaymentProofFileAssetIds(organizationId, rows);
    return {
      items: enriched.map((proof) => this.serializeResidentPaymentProof(proof)),
      meta: buildPaginationMeta(page, limit, total),
      emptyStateCode: total === 0 ? 'NO_PAYMENT_PROOFS' : null,
      emptyStateMessage: total === 0 ? 'Nu ai trimis încă dovezi de plată.' : null,
    };
  }

  async getResidentPaymentProof(user: MvpUser, id: string) {
    const { organizationId, apartmentIds } = await this.residentInvoiceScope(user);
    const proof = await this.prisma.paymentProof.findFirst({
      where: {
        id,
        organizationId,
        residentUserId: user.id,
        apartmentId: { in: apartmentIds.length ? apartmentIds : ['__none__'] },
      },
      include: this.paymentProofInclude(),
    });
    if (!proof) throw new NotFoundException('Dovada de plată nu a fost găsită.');
    const [enriched] = await this.withPaymentProofFileAssetIds(organizationId, [proof]);
    return { proof: this.serializeResidentPaymentProof(enriched, true) };
  }

  async cancelResidentPaymentProof(user: MvpUser, id: string) {
    const { organizationId, apartmentIds } = await this.residentInvoiceScope(user);
    const proof = await this.prisma.paymentProof.findFirst({
      where: {
        id,
        organizationId,
        residentUserId: user.id,
        apartmentId: { in: apartmentIds.length ? apartmentIds : ['__none__'] },
      },
      include: this.paymentProofInclude(),
    });
    if (!proof) throw new NotFoundException('Dovada de plată nu a fost găsită.');
    if (proof.status !== PaymentProofStatus.SUBMITTED) throw new BadRequestException('Poți anula doar dovezi trimise, neverificate încă.');
    const updated = await this.prisma.paymentProof.update({
      where: { id: proof.id },
      data: { status: PaymentProofStatus.CANCELLED },
      include: this.paymentProofInclude(),
    });
    await this.log(user, 'PAYMENT_PROOF_CANCELLED', 'Dovadă de plată anulată', `Locatarul a anulat dovada pentru factura ${proof.invoice?.invoiceNumber || proof.invoiceId}.`, proof.invoiceId);
    return { proof: this.serializeResidentPaymentProof(updated, true), message: 'Dovada a fost anulată.' };
  }

  async getAdminPaymentProofsOverview(user: MvpUser) {
    const organizationId = this.requireAdminOrganization(user);
    const proofs = await this.prisma.paymentProof.findMany({
      where: { organizationId },
      include: this.paymentProofInclude(),
    });
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const issues = proofs.flatMap((proof) => this.paymentProofIssuesForProof(proof));
    return {
      totalProofs: proofs.length,
      submittedProofs: proofs.filter((proof) => proof.status === PaymentProofStatus.SUBMITTED).length,
      inReviewProofs: proofs.filter((proof) => proof.status === PaymentProofStatus.IN_REVIEW).length,
      acceptedProofs: proofs.filter((proof) => proof.status === PaymentProofStatus.ACCEPTED).length,
      rejectedProofs: proofs.filter((proof) => proof.status === PaymentProofStatus.REJECTED).length,
      partiallyAcceptedProofs: proofs.filter((proof) => proof.status === PaymentProofStatus.PARTIALLY_ACCEPTED).length,
      totalSubmittedAmount: money(proofs.filter((proof) => REVIEWABLE_PAYMENT_PROOF_STATUSES.includes(proof.status)).reduce((sum, proof) => sum + Number(proof.amount || 0), 0)),
      totalAcceptedAmount: money(proofs.filter((proof) => ACCEPTED_PAYMENT_PROOF_STATUSES.includes(proof.status)).reduce((sum, proof) => sum + Number(proof.acceptedAmount || proof.amount || 0), 0)),
      proofsToday: proofs.filter((proof) => new Date(proof.createdAt).getTime() >= todayStart.getTime()).length,
      proofsThisMonth: proofs.filter((proof) => new Date(proof.createdAt).getTime() >= monthStart.getTime()).length,
      proofsWithIssues: new Set(issues.map((issue) => issue.proof?.id).filter(Boolean)).size,
      criticalIssuesCount: issues.filter((issue) => issue.severity === 'CRITICAL').length,
      warningsCount: issues.filter((issue) => issue.severity === 'WARNING').length,
    };
  }

  async listAdminPaymentProofs(user: MvpUser, query: Record<string, unknown> = {}) {
    const organizationId = this.requireAdminOrganization(user);
    const { page, limit, skip } = resolvePagination(query, 50, 100);
    const where = this.adminPaymentProofWhere(organizationId, query);
    const [rows, total] = await Promise.all([
      this.prisma.paymentProof.findMany({
        where,
        include: this.paymentProofInclude(),
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.paymentProof.count({ where }),
    ]);
    const enriched = await this.withPaymentProofFileAssetIds(organizationId, rows);
    return {
      items: enriched.map((proof) => this.serializeAdminPaymentProof(proof)),
      meta: buildPaginationMeta(page, limit, total),
      emptyStateCode: total === 0 ? 'NO_PAYMENT_PROOFS' : null,
      emptyStateMessage: total === 0 ? 'Nu există dovezi de plată trimise.' : null,
    };
  }

  async getAdminPaymentProof(user: MvpUser, id: string) {
    const organizationId = this.requireAdminOrganization(user);
    const proof = await this.prisma.paymentProof.findFirst({ where: { id, organizationId }, include: this.paymentProofInclude() });
    if (!proof) throw new NotFoundException('Dovada de plată nu a fost găsită.');
    const paidAmount = await this.paidAmountForInvoice(organizationId, proof.invoiceId);
    const [enriched] = await this.withPaymentProofFileAssetIds(organizationId, [proof]);
    return {
      proof: this.serializeAdminPaymentProof(enriched, true),
      invoice: enriched.invoice ? this.serializeInvoiceForLedger(enriched.invoice) : null,
      existingPayments: (enriched.invoice?.payments || []).map((payment: any) => this.serializeAdminPayment(payment)),
      remainingAmount: enriched.invoice ? this.paymentState(enriched.invoice, paidAmount).remainingAmount : 0,
      warnings: this.paymentProofIssuesForProof(enriched),
      activity: [],
    };
  }

  async startAdminPaymentProofReview(user: MvpUser, id: string) {
    const organizationId = this.requireAdminOrganization(user);
    const proof = await this.prisma.paymentProof.findFirst({ where: { id, organizationId }, include: this.paymentProofInclude() });
    if (!proof) throw new NotFoundException('Dovada de plată nu a fost găsită.');
    if (proof.status !== PaymentProofStatus.SUBMITTED) throw new BadRequestException('Doar dovezile trimise pot intra în verificare.');
    const updated = await this.prisma.paymentProof.update({
      where: { id: proof.id },
      data: { status: PaymentProofStatus.IN_REVIEW },
      include: this.paymentProofInclude(),
    });
    await this.log(user, 'PAYMENT_PROOF_REVIEW_STARTED', 'Verificare dovadă începută', `Adminul a început verificarea dovezii pentru factura ${proof.invoice?.invoiceNumber || proof.invoiceId}.`, proof.invoiceId);
    return { proof: this.serializeAdminPaymentProof(updated, true) };
  }

  async acceptAdminPaymentProof(user: MvpUser, id: string, body: unknown) {
    const organizationId = this.requireAdminOrganization(user);
    const payload = isRecord(body) ? body : {};
    const acceptedAmount = money(Number(payload.acceptedAmount ?? payload.amount));
    if (!Number.isFinite(acceptedAmount) || acceptedAmount <= 0) throw new BadRequestException('Suma acceptată trebuie să fie mai mare decât 0.');
    const proof = await this.prisma.paymentProof.findFirst({ where: { id, organizationId }, include: this.paymentProofInclude() });
    if (!proof) throw new NotFoundException('Dovada de plată nu a fost găsită.');
    if (!REVIEWABLE_PAYMENT_PROOF_STATUSES.includes(proof.status)) throw new BadRequestException('Dovada nu mai poate fi acceptată.');
    if (!proof.invoice) throw new BadRequestException('Factura asociată lipsește.');
    const paidAmount = await this.paidAmountForInvoice(organizationId, proof.invoiceId);
    const state = this.paymentState(proof.invoice, paidAmount);
    const proofAmount = money(Number(proof.amount || 0));
    if (state.paymentDisplayStatus === 'CANCELLED') throw new BadRequestException('Factura este anulată.');
    if (state.remainingAmount <= 0) throw new BadRequestException('Factura este deja achitată.');
    if (acceptedAmount > proofAmount) throw new BadRequestException('Suma acceptată depășește suma dovezii trimise.');
    if (acceptedAmount > state.remainingAmount) throw new BadRequestException('Suma acceptată depășește soldul rămas.');
    const paidAt = parseDate(payload.paidAt) || proof.paidAt || new Date();
    const externalReference = optionalString(payload.externalReference) || proof.externalReference || null;
    const nextProofStatus = acceptedAmount < Number(proof.amount || 0) ? PaymentProofStatus.PARTIALLY_ACCEPTED : PaymentProofStatus.ACCEPTED;
    const updated = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          organizationId,
          apartmentId: proof.apartmentId,
          billingDraftInvoiceId: proof.invoiceId,
          residentUserId: proof.residentUserId,
          amount: acceptedAmount,
          currency: BillingCurrency.MDL,
          method: proof.method,
          status: PaymentStatus.ACCEPTED,
          provider: proof.method === PaymentMethod.CASH ? PaymentProvider.CASH : PaymentProvider.MANUAL_BANK_TRANSFER,
          externalReference,
          source: PaymentSource.PAYMENT_PROOF,
          paymentProofId: proof.id,
          note: proof.residentNote || null,
          internalNote: optionalString(payload.adminNote) || null,
          paidAt,
          acceptedAt: new Date(),
          acceptedById: user.id,
          confirmedAt: new Date(),
          createdByUserId: user.id,
          month: proof.invoice?.billingPeriod ? monthKey(proof.invoice.billingPeriod) : monthKey({ year: paidAt.getFullYear(), month: paidAt.getMonth() + 1 }),
        },
      });
      await this.ensureReceiptForPayment(tx, payment);
      const row = await tx.paymentProof.update({
        where: { id: proof.id },
        data: {
          paymentId: payment.id,
          status: nextProofStatus,
          acceptedAmount,
          paidAt,
          reviewedAt: new Date(),
          reviewedById: user.id,
          adminNote: optionalString(payload.adminNote) || null,
          externalReference,
        },
        include: this.paymentProofInclude(),
      });
      await this.recalculateInvoicePaymentStatus(proof.invoiceId, user.id, tx);
      return row;
    });
    await this.log(user, nextProofStatus === PaymentProofStatus.PARTIALLY_ACCEPTED ? 'PAYMENT_PROOF_PARTIALLY_ACCEPTED' : 'PAYMENT_PROOF_ACCEPTED', nextProofStatus === PaymentProofStatus.PARTIALLY_ACCEPTED ? 'Dovadă acceptată parțial' : 'Dovadă acceptată', `Dovada pentru factura ${proof.invoice?.invoiceNumber || proof.invoiceId} a fost verificată.`, proof.invoiceId);
    await this.log(user, 'PAYMENT_CREATED_MANUAL', 'Plată creată din dovadă', `Plata de ${acceptedAmount.toLocaleString('ro-RO')} MDL a fost creată manual din dovadă.`, proof.invoiceId);
    await this.activity.notifyUsers({
      organizationId,
      userIds: [proof.residentUserId],
      type: NotificationType.PAYMENT,
      title: nextProofStatus === PaymentProofStatus.PARTIALLY_ACCEPTED ? 'Dovada de plată a fost acceptată parțial' : 'Dovada de plată a fost acceptată',
      message: `Dovada pentru factura ${proof.invoice?.invoiceNumber || proof.invoiceId} a fost verificată.`,
      link: `/resident/payment-proofs/${proof.id}`,
    }).catch(() => undefined);
    const [enriched] = await this.withPaymentProofFileAssetIds(organizationId, [updated]);
    return {
      proof: this.serializeAdminPaymentProof(enriched, true),
      message: nextProofStatus === PaymentProofStatus.PARTIALLY_ACCEPTED ? 'Dovada a fost acceptată parțial.' : 'Dovada a fost acceptată.',
    };
  }

  async rejectAdminPaymentProof(user: MvpUser, id: string, body: unknown) {
    const organizationId = this.requireAdminOrganization(user);
    const payload = isRecord(body) ? body : {};
    const rejectionReason = optionalString(payload.rejectionReason);
    if (!rejectionReason) throw new BadRequestException('Motivul respingerii este obligatoriu.');
    const proof = await this.prisma.paymentProof.findFirst({ where: { id, organizationId }, include: this.paymentProofInclude() });
    if (!proof) throw new NotFoundException('Dovada de plată nu a fost găsită.');
    if (!REVIEWABLE_PAYMENT_PROOF_STATUSES.includes(proof.status)) throw new BadRequestException('Dovada nu mai poate fi respinsă.');
    const updated = await this.prisma.paymentProof.update({
      where: { id: proof.id },
      data: {
        status: PaymentProofStatus.REJECTED,
        reviewedAt: new Date(),
        reviewedById: user.id,
        rejectionReason,
        adminNote: optionalString(payload.adminNote) || null,
      },
      include: this.paymentProofInclude(),
    });
    await this.log(user, 'PAYMENT_PROOF_REJECTED', 'Dovadă de plată respinsă', rejectionReason, proof.invoiceId);
    await this.activity.notifyUsers({
      organizationId,
      userIds: [proof.residentUserId],
      type: NotificationType.PAYMENT,
      title: 'Dovada de plată a fost respinsă',
      message: rejectionReason,
      link: `/resident/payment-proofs/${proof.id}`,
    }).catch(() => undefined);
    return { proof: this.serializeAdminPaymentProof(updated, true), message: 'Dovada a fost respinsă.' };
  }

  async getAdminPaymentProofIssues(user: MvpUser, query: Record<string, unknown> = {}) {
    const organizationId = this.requireAdminOrganization(user);
    const proofs = await this.prisma.paymentProof.findMany({
      where: this.adminPaymentProofWhere(organizationId, query),
      include: this.paymentProofInclude(),
      orderBy: [{ createdAt: 'desc' }],
    });
    const type = optionalString(query.type)?.toUpperCase();
    const severity = optionalString(query.severity)?.toUpperCase();
    const { page, limit, skip } = resolvePagination(query, 50, 100);
    let issues = proofs.flatMap((proof) => this.paymentProofIssuesForProof(proof));
    if (type) issues = issues.filter((issue) => issue.type === type);
    if (severity) issues = issues.filter((issue) => issue.severity === severity);
    return {
      items: issues.slice(skip, skip + limit),
      meta: buildPaginationMeta(page, limit, issues.length),
      emptyStateCode: issues.length === 0 ? 'NO_PAYMENT_PROOF_ISSUES' : null,
      emptyStateMessage: issues.length === 0 ? 'Nu există probleme detectate.' : null,
    };
  }

  async getResidentBalanceOverview(user: MvpUser) {
    const snapshot = await this.residentBalanceSnapshot(user);
    const invoiceSummaries = snapshot.invoiceSummaries.filter((invoice) => invoice.status !== BillingDraftInvoiceStatus.CANCELLED);
    const unpaidInvoices = invoiceSummaries.filter((invoice) => invoice.remainingAmount > 0);
    const overdueInvoices = invoiceSummaries.filter((invoice) => invoice.paymentDisplayStatus === 'OVERDUE');
    const partiallyPaidInvoices = invoiceSummaries.filter((invoice) => invoice.paymentDisplayStatus === 'PARTIALLY_PAID');
    const paidInvoices = invoiceSummaries.filter((invoice) => invoice.paymentDisplayStatus === 'PAID');
    const acceptedPayments = snapshot.payments.filter((payment) => ACCEPTED_PAYMENT_STATUSES.includes(payment.status));
    const pendingPaymentProofs = snapshot.paymentProofs.filter((proof: any) => [PaymentProofStatus.SUBMITTED, PaymentProofStatus.IN_REVIEW].includes(proof.status));
    const rejectedPaymentProofs = snapshot.paymentProofs.filter((proof: any) => proof.status === PaymentProofStatus.REJECTED);
    const nextDueInvoice =
      [...unpaidInvoices]
        .filter((invoice) => invoice.dueDate)
        .sort((a, b) => new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime())[0] || null;
    const lastPayment =
      [...acceptedPayments].sort((a, b) => new Date(b.acceptedAt || b.paidAt || b.createdAt).getTime() - new Date(a.acceptedAt || a.paidAt || a.createdAt).getTime())[0] || null;

    return {
      currency: 'MDL',
      apartmentsCount: snapshot.apartments.length,
      totalInvoicedAmount: money(invoiceSummaries.reduce((sum, invoice) => sum + invoice.totalAmount, 0)),
      totalPaidAmount: money(acceptedPayments.reduce((sum, payment) => sum + numberFromDecimal(payment.amount), 0)),
      totalUnpaidAmount: money(unpaidInvoices.reduce((sum, invoice) => sum + invoice.remainingAmount, 0)),
      totalOverdueAmount: money(overdueInvoices.reduce((sum, invoice) => sum + invoice.remainingAmount, 0)),
      unpaidInvoicesCount: unpaidInvoices.length,
      overdueInvoicesCount: overdueInvoices.length,
      paidInvoicesCount: paidInvoices.length,
      partiallyPaidInvoicesCount: partiallyPaidInvoices.length,
      pendingPaymentProofsCount: pendingPaymentProofs.length,
      rejectedPaymentProofsCount: rejectedPaymentProofs.length,
      nextDueInvoice,
      lastPayment: lastPayment ? this.serializeResidentPayment(lastPayment) : null,
      lastPublishedInvoice: snapshot.invoiceSummaries[0] || null,
    };
  }

  async listResidentApartmentBalances(user: MvpUser) {
    const snapshot = await this.residentBalanceSnapshot(user);
    return {
      items: snapshot.apartmentBalances,
      total: snapshot.apartmentBalances.length,
      emptyStateCode: snapshot.apartmentBalances.length ? null : 'NO_APARTMENTS',
      emptyStateMessage: snapshot.apartmentBalances.length ? null : 'Contul tău nu este legat încă de un apartament.',
    };
  }

  async getResidentApartmentBalance(user: MvpUser, apartmentId: string) {
    const snapshot = await this.residentBalanceSnapshot(user, apartmentId);
    const balance = snapshot.apartmentBalances[0];
    if (!balance) throw new NotFoundException('Apartamentul nu a fost găsit.');
    const invoiceSummaries = snapshot.invoiceSummaries.filter((invoice) => invoice.apartmentId === apartmentId);
    const payments = snapshot.payments.filter((payment) => payment.apartmentId === apartmentId);
    return {
      apartment: balance.apartment,
      balance,
      unpaidInvoices: invoiceSummaries.filter((invoice) => invoice.remainingAmount > 0),
      overdueInvoices: invoiceSummaries.filter((invoice) => invoice.paymentDisplayStatus === 'OVERDUE'),
      recentPayments: payments.slice(0, 10).map((payment) => this.serializeResidentPayment(payment)),
      pendingPaymentProofs: snapshot.paymentProofs
        .filter((proof: any) => proof.apartmentId === apartmentId && [PaymentProofStatus.SUBMITTED, PaymentProofStatus.IN_REVIEW].includes(proof.status))
        .map((proof: any) => this.serializeResidentPaymentProof(proof)),
      timelinePreview: this.buildResidentFinancialTimeline(snapshot).slice(0, 10),
    };
  }

  async listResidentPayments(user: MvpUser, query: Record<string, unknown> = {}) {
    const { organizationId, apartmentIds } = await this.residentInvoiceScope(user);
    if (!apartmentIds.length) {
      const { page, limit } = resolvePagination(query, 20, 100);
      return { items: [], meta: buildPaginationMeta(page, limit, 0), emptyStateCode: 'NO_APARTMENT', emptyStateMessage: 'Contul tău nu este legat încă de un apartament.' };
    }
    const { page, limit, skip } = resolvePagination(query, 20, 100);
    const where = this.residentPaymentWhere(organizationId, apartmentIds, query);
    const [rows, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: this.residentPaymentInclude(),
        orderBy: [{ paidAt: 'desc' }, { acceptedAt: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.payment.count({ where }),
    ]);
    return {
      items: rows.map((payment) => this.serializeResidentPayment(payment)),
      meta: buildPaginationMeta(page, limit, total),
      emptyStateCode: total === 0 ? 'NO_PAYMENTS' : null,
      emptyStateMessage: total === 0 ? 'Nu există plăți acceptate încă.' : null,
    };
  }

  async getResidentPayment(user: MvpUser, id: string) {
    const { organizationId, apartmentIds } = await this.residentInvoiceScope(user);
    const payment = await this.prisma.payment.findFirst({
      where: { id, organizationId, apartmentId: { in: apartmentIds.length ? apartmentIds : ['__none__'] } },
      include: this.residentPaymentInclude(),
    });
    if (!payment) throw new NotFoundException('Plata nu a fost găsită.');
    return { payment: this.serializeResidentPayment(payment, true) };
  }

  async getResidentFinancialTimeline(user: MvpUser, query: Record<string, unknown> = {}) {
    const snapshot = await this.residentBalanceSnapshot(user, optionalString(query.apartmentId));
    const { page, limit, skip } = resolvePagination(query, 20, 100);
    const dateFrom = parseDate(query.dateFrom);
    const dateTo = parseDate(query.dateTo);
    const type = optionalString(query.type)?.toUpperCase();
    let entries = this.buildResidentFinancialTimeline(snapshot);
    if (dateFrom) entries = entries.filter((entry) => new Date(String(entry.date || 0)).getTime() >= dateFrom.getTime());
    if (dateTo) entries = entries.filter((entry) => new Date(String(entry.date || 0)).getTime() <= dateTo.getTime());
    if (type) entries = entries.filter((entry) => entry.type === type);
    return {
      items: entries.slice(skip, skip + limit),
      meta: buildPaginationMeta(page, limit, entries.length),
      emptyStateCode: entries.length === 0 ? 'NO_FINANCIAL_ACTIVITY' : null,
      emptyStateMessage: entries.length === 0 ? 'Nu există activitate financiară încă.' : null,
    };
  }

  async getResidentBalanceIssues(user: MvpUser) {
    const snapshot = await this.residentBalanceSnapshot(user);
    const issues: Array<Record<string, unknown>> = [];
    snapshot.invoiceSummaries.forEach((invoice) => {
      if (invoice.status === BillingDraftInvoiceStatus.CANCELLED) return;
      if (invoice.paymentDisplayStatus === 'OVERDUE') {
        issues.push({
          id: `OVERDUE_INVOICE-${invoice.id}`,
          type: 'OVERDUE_INVOICE',
          severity: 'WARNING',
          invoice,
          apartment: invoice.apartment,
          amount: invoice.remainingAmount,
          recommendation: 'Vezi factura și trimite dovada plății dacă ai achitat deja.',
        });
        return;
      }
      if (invoice.paymentDisplayStatus === 'PARTIALLY_PAID') {
        issues.push({
          id: `PARTIALLY_PAID_INVOICE-${invoice.id}`,
          type: 'PARTIALLY_PAID_INVOICE',
          severity: 'INFO',
          invoice,
          apartment: invoice.apartment,
          amount: invoice.remainingAmount,
          recommendation: 'Verifică suma rămasă de achitat pentru această factură.',
        });
        return;
      }
      if (invoice.remainingAmount > 0) {
        issues.push({
          id: `UNPAID_INVOICE-${invoice.id}`,
          type: 'UNPAID_INVOICE',
          severity: 'INFO',
          invoice,
          apartment: invoice.apartment,
          amount: invoice.remainingAmount,
          recommendation: 'Achită factura sau încarcă dovada plății dacă ai achitat deja.',
        });
      }
    });
    (snapshot.paymentProofs || []).forEach((proof: any) => {
      const serializedProof = this.serializeResidentPaymentProof(proof);
      if (proof.status === PaymentProofStatus.SUBMITTED || proof.status === PaymentProofStatus.IN_REVIEW) {
        issues.push({
          id: `PAYMENT_PROOF_PENDING-${proof.id}`,
          type: 'PAYMENT_PROOF_PENDING',
          severity: 'INFO',
          paymentProof: serializedProof,
          apartment: serializedProof.apartment,
          amount: serializedProof.amount,
          recommendation: 'Dovada este în verificare la administrație.',
        });
      }
      if (proof.status === PaymentProofStatus.REJECTED) {
        issues.push({
          id: `PAYMENT_PROOF_REJECTED-${proof.id}`,
          type: 'PAYMENT_PROOF_REJECTED',
          severity: 'WARNING',
          paymentProof: serializedProof,
          apartment: serializedProof.apartment,
          amount: serializedProof.amount,
          recommendation: 'Verifică motivul respingerii și trimite o dovadă corectă.',
        });
      }
    });
    snapshot.payments.forEach((payment) => {
      const serializedPayment = this.serializeResidentPayment(payment);
      if (payment.status === PaymentStatus.REVERSED) {
        issues.push({
          id: `PAYMENT_REVERSED-${payment.id}`,
          type: 'PAYMENT_REVERSED',
          severity: 'WARNING',
          payment: serializedPayment,
          apartment: serializedPayment.apartment,
          amount: serializedPayment.amount,
          recommendation: 'Plata a fost inversată. Verifică soldul facturii asociate.',
        });
      }
    });
    return {
      issues,
      total: issues.length,
      warningsCount: issues.filter((issue) => issue.severity === 'WARNING').length,
      infoCount: issues.filter((issue) => issue.severity === 'INFO').length,
    };
  }

  async getAdminPaymentsOverview(user: MvpUser) {
    const organizationId = this.requireAdminOrganization(user);
    const [payments, invoices, apartments] = await Promise.all([
      this.prisma.payment.findMany({ where: { organizationId }, include: { billingDraftInvoice: true } }),
      this.prisma.billingDraftInvoice.findMany({
        where: { organizationId, status: { in: LEDGER_INVOICE_STATUSES } },
        include: { payments: true },
      }),
      this.prisma.apartment.findMany({ where: { organizationId }, select: { id: true } }),
    ]);
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const acceptedPayments = payments.filter((payment) => ACCEPTED_PAYMENT_STATUSES.includes(payment.status));
    const rejectedPayments = payments.filter((payment) => payment.status === PaymentStatus.REJECTED || payment.status === PaymentStatus.FAILED);
    const reversedPayments = payments.filter((payment) => payment.status === PaymentStatus.REVERSED || payment.status === PaymentStatus.CANCELLED);
    const invoiceStates = invoices.map((invoice) => this.invoicePaymentState(invoice, invoice.payments || []));
    const balances = await Promise.all(apartments.map((apartment) => this.calculateApartmentBalance(organizationId, apartment.id)));
    const issues = await this.reconciliationIssuesForOrganization(organizationId, {});
    return {
      totalPayments: payments.length,
      acceptedPayments: acceptedPayments.length,
      pendingPayments: payments.filter((payment) => payment.status === PaymentStatus.PENDING).length,
      rejectedPayments: rejectedPayments.length,
      reversedPayments: reversedPayments.length,
      totalAcceptedAmount: money(acceptedPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)),
      totalPendingAmount: money(payments.filter((payment) => payment.status === PaymentStatus.PENDING).reduce((sum, payment) => sum + Number(payment.amount || 0), 0)),
      paymentsToday: acceptedPayments.filter((payment) => new Date(payment.paidAt || payment.acceptedAt || payment.createdAt) >= todayStart).length,
      paymentsThisMonth: money(acceptedPayments.filter((payment) => new Date(payment.paidAt || payment.acceptedAt || payment.createdAt) >= monthStart).reduce((sum, payment) => sum + Number(payment.amount || 0), 0)),
      unpaidInvoices: invoiceStates.filter((state) => state.remainingAmount > 0 && state.paidAmount <= 0).length,
      partiallyPaidInvoices: invoiceStates.filter((state) => state.remainingAmount > 0 && state.paidAmount > 0).length,
      paidInvoices: invoiceStates.filter((state) => state.remainingAmount <= 0).length,
      overdueInvoices: invoiceStates.filter((state) => state.remainingAmount > 0 && state.invoice.dueDate && new Date(state.invoice.dueDate).getTime() < Date.now()).length,
      totalOutstandingAmount: money(invoiceStates.reduce((sum, state) => sum + Math.max(state.remainingAmount, 0), 0)),
      totalOverdueAmount: money(
        invoiceStates
          .filter((state) => state.remainingAmount > 0 && state.invoice.dueDate && new Date(state.invoice.dueDate).getTime() < Date.now())
          .reduce((sum, state) => sum + state.remainingAmount, 0),
      ),
      apartmentsWithDebt: balances.filter((balance) => balance.totalRemaining > 0).length,
      apartmentsWithOverpayment: balances.filter((balance) => balance.overpaidAmount > 0).length,
      warningsCount: issues.filter((issue) => issue.severity === 'WARNING').length,
      criticalIssuesCount: issues.filter((issue) => issue.severity === 'CRITICAL').length,
    };
  }

  async listAdminPaymentsLedger(user: MvpUser, query: Record<string, unknown> = {}) {
    const organizationId = this.requireAdminOrganization(user);
    const { page, limit, skip } = resolvePagination(query, 50, 100);
    const where = this.adminLedgerPaymentWhere(organizationId, query);
    const [rows, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: this.paymentLedgerInclude(),
        orderBy: [{ paidAt: 'desc' }, { acceptedAt: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.payment.count({ where }),
    ]);
    return {
      items: rows.map((payment) => this.serializeAdminPayment(payment)),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async getAdminPaymentLedger(user: MvpUser, id: string) {
    const organizationId = this.requireAdminOrganization(user);
    const payment = await this.prisma.payment.findFirst({
      where: { id, organizationId },
      include: this.paymentLedgerInclude(),
    });
    if (!payment) throw new NotFoundException('Plata nu a fost găsită.');
    return {
      payment: this.serializeAdminPayment(payment, true),
      reconciliation: await this.reconciliationInfoForPayment(organizationId, payment),
      activity: [],
    };
  }

  async createAdminManualLedgerPayment(user: MvpUser, body: unknown) {
    const organizationId = this.requireAdminOrganization(user);
    const payload = isRecord(body) ? body : {};
    const invoiceId = optionalString(payload.invoiceId);
    const apartmentId = optionalString(payload.apartmentId);
    const amount = Number(payload.amount);
    if (!invoiceId && !apartmentId) throw new BadRequestException('Alege factura sau apartamentul.');
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('Suma trebuie să fie mai mare decât 0.');
    const method = this.parseLedgerPaymentMethod(payload.method);
    const paidAt = parseDate(payload.paidAt || payload.paymentDate) || new Date();
    const invoice = invoiceId
      ? await this.prisma.billingDraftInvoice.findFirst({ where: { id: invoiceId, organizationId }, include: this.invoiceDetailInclude() })
      : null;
    if (invoiceId && !invoice) throw new NotFoundException('Factura nu a fost găsită.');
    const resolvedApartmentId = apartmentId || invoice?.apartmentId;
    if (!resolvedApartmentId) throw new BadRequestException('Apartamentul este obligatoriu.');
    if (invoice && invoice.apartmentId !== resolvedApartmentId) throw new BadRequestException('Factura nu aparține apartamentului ales.');
    const apartment = await this.prisma.apartment.findFirst({
      where: { id: resolvedApartmentId, organizationId },
      include: { residents: { take: 1 }, ownerResident: true },
    });
    if (!apartment) throw new NotFoundException('Apartamentul nu a fost găsit.');
    const residentUserId = invoice?.resident?.userId || invoice?.owner?.userId || apartment.residents?.[0]?.userId || apartment.ownerResident?.userId || null;
    const created = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          organizationId,
          apartmentId: resolvedApartmentId,
          billingDraftInvoiceId: invoice?.id || null,
          residentUserId,
          amount: money(amount),
          currency: BillingCurrency.MDL,
          method,
          status: PaymentStatus.ACCEPTED,
          provider: method === PaymentMethod.CASH ? PaymentProvider.CASH : PaymentProvider.MANUAL_BANK_TRANSFER,
          source: PaymentSource.MANUAL_ENTRY,
          paidAt,
          acceptedAt: new Date(),
          acceptedById: user.id,
          confirmedAt: new Date(),
          createdByUserId: user.id,
          externalReference: optionalString(payload.externalReference) || null,
          note: optionalString(payload.note) || null,
          internalNote: optionalString(payload.internalNote) || null,
          month: invoice?.billingPeriod ? monthKey(invoice.billingPeriod) : monthKey({ year: paidAt.getFullYear(), month: paidAt.getMonth() + 1 }),
        },
        include: this.paymentLedgerInclude(),
      });
      await this.ensureReceiptForPayment(tx, payment);
      if (invoice) await this.recalculateInvoicePaymentStatus(invoice.id, user.id, tx);
      return payment;
    });
    await this.log(user, 'PAYMENT_MANUAL_CREATED', 'Plată manuală înregistrată', `Plata de ${money(amount).toLocaleString('ro-RO')} MDL a fost înregistrată manual.`, created.id);
    return {
      payment: this.serializeAdminPayment(created, true),
      message: 'Plata manuală a fost înregistrată.',
    };
  }

  async updateAdminLedgerPayment(user: MvpUser, id: string, body: unknown) {
    const organizationId = this.requireAdminOrganization(user);
    const payment = await this.prisma.payment.findFirst({ where: { id, organizationId } });
    if (!payment) throw new NotFoundException('Plata nu a fost găsită.');
    if (payment.source === PaymentSource.PAYMENT_PROOF) throw new BadRequestException('Plățile create din dovezi acceptate nu se editează aici.');
    if (!REVERSIBLE_PAYMENT_STATUSES.includes(payment.status) && payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException('Această plată nu mai poate fi editată.');
    }
    const payload = isRecord(body) ? body : {};
    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        note: payload.note === undefined ? undefined : optionalString(payload.note) || null,
        internalNote: payload.internalNote === undefined ? undefined : optionalString(payload.internalNote) || null,
        externalReference: payload.externalReference === undefined ? undefined : optionalString(payload.externalReference) || null,
        paidAt: payload.paidAt === undefined ? undefined : parseDate(payload.paidAt) || null,
      },
      include: this.paymentLedgerInclude(),
    });
    await this.log(user, 'PAYMENT_UPDATED', 'Plată actualizată', 'Detaliile plății au fost actualizate.', updated.id);
    return { payment: this.serializeAdminPayment(updated, true) };
  }

  async reverseAdminLedgerPayment(user: MvpUser, id: string, body: unknown) {
    const organizationId = this.requireAdminOrganization(user);
    const payload = isRecord(body) ? body : {};
    if (payload.confirm !== true) throw new BadRequestException('Confirmarea este obligatorie.');
    const reason = optionalString(payload.reason);
    if (!reason) throw new BadRequestException('Motivul reversal este obligatoriu.');
    const payment = await this.prisma.payment.findFirst({ where: { id, organizationId }, include: this.paymentLedgerInclude() });
    if (!payment) throw new NotFoundException('Plata nu a fost găsită.');
    if (!REVERSIBLE_PAYMENT_STATUSES.includes(payment.status)) throw new BadRequestException('Doar plățile acceptate pot fi reversate.');
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.REVERSED,
          reversedAt: new Date(),
          reversedById: user.id,
          reversalReason: reason,
          internalNote: [payment.internalNote, `Reversed: ${reason}`].filter(Boolean).join('\n'),
        },
        include: this.paymentLedgerInclude(),
      });
      if (payment.billingDraftInvoiceId) await this.recalculateInvoicePaymentStatus(payment.billingDraftInvoiceId, user.id, tx);
      return row;
    });
    await this.log(user, 'PAYMENT_REVERSED', 'Plată reversată', reason, updated.id);
    return { payment: this.serializeAdminPayment(updated, true), message: 'Plata a fost marcată ca reversed.' };
  }

  async getAdminApartmentBalances(user: MvpUser, query: Record<string, unknown> = {}) {
    const organizationId = this.requireAdminOrganization(user);
    const { page, limit, skip } = resolvePagination(query, 50, 100);
    const apartmentWhere: Prisma.ApartmentWhereInput = { organizationId };
    if (optionalString(query.buildingId)) apartmentWhere.buildingId = optionalString(query.buildingId);
    if (optionalString(query.entranceId)) apartmentWhere.staircaseId = optionalString(query.entranceId);
    const search = optionalString(query.search);
    if (search) {
      apartmentWhere.OR = [
        { number: { contains: search, mode: 'insensitive' } },
        { building: { name: { contains: search, mode: 'insensitive' } } },
        { staircase: { name: { contains: search, mode: 'insensitive' } } },
        { residents: { some: { firstName: { contains: search, mode: 'insensitive' } } } },
        { residents: { some: { lastName: { contains: search, mode: 'insensitive' } } } },
      ];
    }
    const apartments = await this.prisma.apartment.findMany({
      where: apartmentWhere,
      include: this.apartmentLedgerInclude(),
      orderBy: [{ building: { name: 'asc' } }, { staircase: { name: 'asc' } }, { number: 'asc' }],
    });
    let balances = await Promise.all(apartments.map((apartment) => this.calculateApartmentBalance(organizationId, apartment.id, apartment)));
    if (this.bool(query.onlyWithDebt)) balances = balances.filter((row) => row.totalRemaining > 0);
    if (this.bool(query.onlyOverpaid)) balances = balances.filter((row) => row.overpaidAmount > 0);
    return {
      items: balances.slice(skip, skip + limit),
      meta: buildPaginationMeta(page, limit, balances.length),
    };
  }

  async getAdminApartmentLedger(user: MvpUser, apartmentId: string) {
    const organizationId = this.requireAdminOrganization(user);
    const apartment = await this.prisma.apartment.findFirst({ where: { id: apartmentId, organizationId }, include: this.apartmentLedgerInclude() });
    if (!apartment) throw new NotFoundException('Apartamentul nu a fost găsit.');
    const [invoices, payments] = await Promise.all([
      this.prisma.billingDraftInvoice.findMany({
        where: { organizationId, apartmentId, status: { in: LEDGER_INVOICE_STATUSES } },
        include: { billingPeriod: true },
        orderBy: [{ billingPeriod: { year: 'asc' } }, { billingPeriod: { month: 'asc' } }, { createdAt: 'asc' }],
      }),
      this.prisma.payment.findMany({
        where: { organizationId, apartmentId },
        include: this.paymentLedgerInclude(),
        orderBy: [{ paidAt: 'asc' }, { createdAt: 'asc' }],
      }),
    ]);
    const entries = [
      ...invoices.map((invoice) => ({
        id: invoice.id,
        type: 'INVOICE',
        date: invoice.publishedAt || invoice.createdAt,
        invoice: this.serializeInvoiceForLedger(invoice),
        amount: numberFromDecimal(invoice.total),
      })),
      ...payments.map((payment) => ({
        id: payment.id,
        type: payment.status === PaymentStatus.REVERSED || payment.status === PaymentStatus.CANCELLED ? 'REVERSAL' : payment.method === PaymentMethod.ADJUSTMENT ? 'ADJUSTMENT' : 'PAYMENT',
        date: payment.paidAt || payment.acceptedAt || payment.createdAt,
        payment: this.serializeAdminPayment(payment),
        amount: ACCEPTED_PAYMENT_STATUSES.includes(payment.status) ? -Number(payment.amount || 0) : 0,
      })),
    ].sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());
    let runningBalance = 0;
    const chronologicalEntries = entries.map((entry) => {
      runningBalance = money(runningBalance + Number(entry.amount || 0));
      return { ...entry, runningBalance };
    });
    return {
      apartment: this.serializeApartment(apartment),
      resident: this.primaryApartmentContact(apartment),
      summary: await this.calculateApartmentBalance(organizationId, apartmentId, apartment),
      entries: chronologicalEntries,
    };
  }

  async getAdminReconciliationIssues(user: MvpUser, query: Record<string, unknown> = {}) {
    const organizationId = this.requireAdminOrganization(user);
    let issues = await this.reconciliationIssuesForOrganization(organizationId, query);
    const type = optionalString(query.type);
    const severity = optionalString(query.severity);
    if (type) issues = issues.filter((issue) => issue.type === type);
    if (severity) issues = issues.filter((issue) => issue.severity === severity);
    const search = optionalString(query.search)?.toLowerCase();
    if (search) {
      issues = issues.filter((issue) => JSON.stringify(issue).toLowerCase().includes(search));
    }
    const { page, limit, skip } = resolvePagination(query, 50, 100);
    return { issues: issues.slice(skip, skip + limit), meta: buildPaginationMeta(page, limit, issues.length) };
  }

  async recalculateAdminReconciliation(user: MvpUser) {
    const organizationId = this.requireAdminOrganization(user);
    const invoices = await this.prisma.billingDraftInvoice.findMany({ where: { organizationId, status: { in: LEDGER_INVOICE_STATUSES } }, select: { id: true } });
    for (const invoice of invoices) {
      await this.recalculateInvoicePaymentStatus(invoice.id, user.id);
    }
    const issues = await this.reconciliationIssuesForOrganization(organizationId, {});
    await this.log(user, 'RECONCILIATION_RUN', 'Reconciliere recalculată', `Au fost recalculate ${invoices.length} facturi.`, null);
    return { recalculatedInvoices: invoices.length, issuesCount: issues.length, message: 'Soldurile au fost recalculate.' };
  }

  async searchAdminLedgerInvoices(user: MvpUser, query: Record<string, unknown> = {}) {
    const organizationId = this.requireAdminOrganization(user);
    const search = optionalString(query.search);
    const where: Prisma.BillingDraftInvoiceWhereInput = { organizationId, status: { in: LEDGER_INVOICE_STATUSES } };
    if (this.bool(query.unpaidOnly)) where.status = { in: [BillingDraftInvoiceStatus.PUBLISHED, BillingDraftInvoiceStatus.PARTIALLY_PAID] };
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { apartment: { number: { contains: search, mode: 'insensitive' } } },
        { resident: { firstName: { contains: search, mode: 'insensitive' } } },
        { resident: { lastName: { contains: search, mode: 'insensitive' } } },
        { owner: { firstName: { contains: search, mode: 'insensitive' } } },
        { owner: { lastName: { contains: search, mode: 'insensitive' } } },
      ];
    }
    const rows = await this.prisma.billingDraftInvoice.findMany({
      where,
      include: { ...this.invoiceListInclude(), payments: true },
      orderBy: [{ updatedAt: 'desc' }],
      take: 25,
    });
    return { items: rows.map((invoice) => this.serializeInvoicePaymentOption(invoice)).filter((invoice) => !this.bool(query.unpaidOnly) || invoice.remainingAmount > 0) };
  }

  async listAdminBillingDraftInvoicePayments(user: MvpUser, id: string) {
    const organizationId = this.requireAdminOrganization(user);
    const invoice = await this.prisma.billingDraftInvoice.findFirst({ where: { id, organizationId }, include: { ...this.invoiceDetailInclude(), payments: { include: this.paymentLedgerInclude() } } });
    if (!invoice) throw new NotFoundException('Factura nu a fost găsită.');
    const items = (invoice.payments || []).map((payment: any) => this.serializeAdminPayment(payment));
    return {
      items,
      stats: {
        totalPaid: money(items.filter((item: any) => ACCEPTED_PAYMENT_STATUSES.includes(item.status)).reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0)),
        acceptedCount: items.filter((item: any) => ACCEPTED_PAYMENT_STATUSES.includes(item.status)).length,
        reversedCount: items.filter((item: any) => item.status === PaymentStatus.REVERSED || item.status === PaymentStatus.CANCELLED).length,
      },
    };
  }

  private adminLedgerPaymentWhere(organizationId: string, query: Record<string, unknown>): Prisma.PaymentWhereInput {
    const where: Prisma.PaymentWhereInput = { organizationId };
    const status = optionalString(query.status) as PaymentStatus | undefined;
    if (status && Object.values(PaymentStatus).includes(status)) where.status = status;
    const method = optionalString(query.method) as PaymentMethod | undefined;
    if (method && Object.values(PaymentMethod).includes(method)) where.method = method;
    const source = optionalString(query.source) as PaymentSource | undefined;
    if (source && Object.values(PaymentSource).includes(source)) where.source = source;
    if (optionalString(query.invoiceId)) where.billingDraftInvoiceId = optionalString(query.invoiceId);
    if (optionalString(query.apartmentId)) where.apartmentId = optionalString(query.apartmentId);
    if (optionalString(query.residentUserId)) where.residentUserId = optionalString(query.residentUserId);
    const dateFrom = parseDate(query.dateFrom);
    const dateTo = parseDate(query.dateTo);
    if (dateFrom || dateTo) where.paidAt = { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) };
    const search = optionalString(query.search);
    if (search) {
      where.OR = [
        { externalReference: { contains: search, mode: 'insensitive' } },
        { note: { contains: search, mode: 'insensitive' } },
        { internalNote: { contains: search, mode: 'insensitive' } },
        { billingDraftInvoice: { invoiceNumber: { contains: search, mode: 'insensitive' } } },
        { apartment: { number: { contains: search, mode: 'insensitive' } } },
        { billingDraftInvoice: { resident: { firstName: { contains: search, mode: 'insensitive' } } } },
        { billingDraftInvoice: { resident: { lastName: { contains: search, mode: 'insensitive' } } } },
        { billingDraftInvoice: { owner: { firstName: { contains: search, mode: 'insensitive' } } } },
        { billingDraftInvoice: { owner: { lastName: { contains: search, mode: 'insensitive' } } } },
      ];
    }
    return where;
  }

  private paymentLedgerInclude() {
    return {
      apartment: { include: { building: { select: { id: true, name: true } }, staircase: { select: { id: true, name: true } } } },
      billingDraftInvoice: {
        include: {
          billingPeriod: true,
          apartment: { include: { building: { select: { id: true, name: true } }, staircase: { select: { id: true, name: true } } } },
          resident: true,
          owner: true,
        },
      },
      residentUser: { select: { id: true, firstName: true, lastName: true, fullName: true, email: true, phone: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true, fullName: true, email: true } },
      acceptedBy: { select: { id: true, firstName: true, lastName: true, fullName: true, email: true } },
      rejectedBy: { select: { id: true, firstName: true, lastName: true, fullName: true, email: true } },
      reversedBy: { select: { id: true, firstName: true, lastName: true, fullName: true, email: true } },
    } satisfies Prisma.PaymentInclude;
  }

  private residentPaymentInclude() {
    return {
      apartment: { include: { building: { select: { id: true, name: true } }, staircase: { select: { id: true, name: true } } } },
      billingDraftInvoice: { include: this.invoiceListInclude() },
      residentUser: { select: { id: true, firstName: true, lastName: true, fullName: true, email: true, phone: true } },
    } satisfies Prisma.PaymentInclude;
  }

  private paymentProofInclude() {
    return {
      apartment: { include: { building: { select: { id: true, name: true } }, staircase: { select: { id: true, name: true } } } },
      invoice: {
        include: {
          billingPeriod: true,
          apartment: {
            include: {
              building: { select: { id: true, name: true } },
              staircase: { select: { id: true, name: true } },
              residents: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, userId: true }, take: 5 },
              ownerResident: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, userId: true } },
            },
          },
          resident: true,
          owner: true,
          payments: { include: this.paymentLedgerInclude(), orderBy: [{ paidAt: 'desc' }, { acceptedAt: 'desc' }, { createdAt: 'desc' }] },
        },
      },
      residentUser: { select: { id: true, firstName: true, lastName: true, fullName: true, email: true, phone: true } },
      reviewedBy: { select: { id: true, firstName: true, lastName: true, fullName: true, email: true } },
      payment: { include: this.paymentLedgerInclude() },
    } satisfies Prisma.PaymentProofInclude;
  }

  private adminPaymentProofWhere(organizationId: string, query: Record<string, unknown>): Prisma.PaymentProofWhereInput {
    const where: Prisma.PaymentProofWhereInput = { organizationId };
    const status = optionalString(query.status)?.toUpperCase() as PaymentProofStatus | undefined;
    if (status && Object.values(PaymentProofStatus).includes(status)) where.status = status;
    const method = optionalString(query.method)?.toUpperCase() as PaymentMethod | undefined;
    if (method && Object.values(PaymentMethod).includes(method)) where.method = method;
    const invoiceId = optionalString(query.invoiceId);
    if (invoiceId) where.invoiceId = invoiceId;
    const apartmentId = optionalString(query.apartmentId);
    if (apartmentId) where.apartmentId = apartmentId;
    const dateFrom = parseDate(query.dateFrom);
    const dateTo = parseDate(query.dateTo);
    if (dateFrom || dateTo) where.createdAt = { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) };
    const search = optionalString(query.search);
    if (search) {
      where.OR = [
        { externalReference: { contains: search, mode: 'insensitive' } },
        { residentNote: { contains: search, mode: 'insensitive' } },
        { invoice: { invoiceNumber: { contains: search, mode: 'insensitive' } } },
        { apartment: { number: { contains: search, mode: 'insensitive' } } },
        { residentUser: { email: { contains: search, mode: 'insensitive' } } },
        { residentUser: { firstName: { contains: search, mode: 'insensitive' } } },
        { residentUser: { lastName: { contains: search, mode: 'insensitive' } } },
      ];
    }
    return where;
  }

  private async findPossibleDuplicatePaymentProof(organizationId: string, invoiceId: string, amount: number, paidAt: Date | null, externalReference: string | null) {
    const where: Prisma.PaymentProofWhereInput = {
      organizationId,
      invoiceId,
      amount,
      status: { in: [PaymentProofStatus.SUBMITTED, PaymentProofStatus.IN_REVIEW, PaymentProofStatus.ACCEPTED, PaymentProofStatus.PARTIALLY_ACCEPTED] },
    };
    if (externalReference) where.externalReference = externalReference;
    if (paidAt) {
      const start = new Date(paidAt);
      start.setHours(0, 0, 0, 0);
      const end = new Date(paidAt);
      end.setHours(23, 59, 59, 999);
      where.paidAt = { gte: start, lte: end };
    }
    return this.prisma.paymentProof.findFirst({ where, select: { id: true } });
  }

  private async withPaymentProofFileAssetIds(organizationId: string, proofs: any[]) {
    if (!proofs.length) return proofs;
    const urls = Array.from(new Set(proofs.map((proof) => proof.proofFileUrl).filter(Boolean)));
    if (!urls.length) return proofs.map((proof) => ({ ...proof, proofFileAssetId: null }));
    const assets = await this.prisma.fileAsset.findMany({
      where: {
        organizationId,
        fileUrl: { in: urls as string[] },
        entityType: { in: [FileAssetEntityType.RECEIPT_PDF, FileAssetEntityType.OTHER] },
      },
      select: { id: true, fileUrl: true },
    });
    const byUrl = new Map(assets.map((asset) => [asset.fileUrl, asset.id]));
    return proofs.map((proof) => ({
      ...proof,
      proofFileAssetId: proof.proofFileUrl ? byUrl.get(proof.proofFileUrl) || null : null,
    }));
  }

  private serializeResidentPaymentProof(proof: any, detail = false) {
    const invoiceState = proof.invoice ? this.invoicePaymentState(proof.invoice, proof.invoice.payments || []) : null;
    const payload: Record<string, unknown> = {
      id: proof.id,
      proofId: proof.id,
      invoiceId: proof.invoiceId,
      invoiceNumber: proof.invoice?.invoiceNumber || null,
      invoice: proof.invoice
        ? {
            id: proof.invoice.id,
            invoiceNumber: proof.invoice.invoiceNumber,
            billingMonth: proof.invoice.billingPeriod ? monthKey(proof.invoice.billingPeriod) : null,
            status: proof.invoice.status,
            totalAmount: numberFromDecimal(proof.invoice.total),
            remainingAmount: invoiceState?.remainingAmount ?? null,
          }
        : null,
      apartmentId: proof.apartmentId,
      apartment: apartmentInfo(proof.apartment || proof.invoice?.apartment),
      amount: numberFromDecimal(proof.amount),
      acceptedAmount: proof.acceptedAmount === null || proof.acceptedAmount === undefined ? null : numberFromDecimal(proof.acceptedAmount),
      currency: proof.currency,
      method: proof.method,
      status: proof.status,
      paidAt: proof.paidAt,
      createdAt: proof.createdAt,
      reviewedAt: proof.reviewedAt,
      rejectionReason: proof.rejectionReason || null,
      paymentId: proof.paymentId || null,
      possibleDuplicate: Boolean(proof.possibleDuplicate),
    };
    if (detail) {
      payload.proofFileAssetId = proof.proofFileAssetId || null;
      payload.proofFileUrl = proof.proofFileUrl || null;
      payload.proofFileName = proof.proofFileName || null;
      payload.proofFileMimeType = proof.proofFileMimeType || null;
      payload.proofFileSize = proof.proofFileSize || null;
      payload.externalReference = proof.externalReference || null;
      payload.residentNote = proof.residentNote || null;
      payload.adminNote = proof.adminNote || null;
    }
    return payload;
  }

  private serializeAdminPaymentProof(proof: any, detail = false) {
    const invoiceState = proof.invoice ? this.invoicePaymentState(proof.invoice, proof.invoice.payments || []) : null;
    const residentName = proof.residentUser?.fullName || fullName(proof.residentUser) || proof.residentUser?.email || proof.residentUser?.phone || null;
    const payload: Record<string, unknown> = {
      id: proof.id,
      proofId: proof.id,
      invoiceId: proof.invoiceId,
      invoiceNumber: proof.invoice?.invoiceNumber || null,
      invoice: proof.invoice ? this.serializeInvoiceForLedger(proof.invoice) : null,
      apartmentId: proof.apartmentId,
      apartment: apartmentInfo(proof.apartment || proof.invoice?.apartment),
      resident: proof.residentUser ? { id: proof.residentUser.id, name: residentName, email: proof.residentUser.email || null, phone: proof.residentUser.phone || null } : null,
      owner: proof.invoice?.owner ? { id: proof.invoice.owner.id, name: fullName(proof.invoice.owner), email: proof.invoice.owner.email, phone: proof.invoice.owner.phone } : null,
      amount: numberFromDecimal(proof.amount),
      acceptedAmount: proof.acceptedAmount === null || proof.acceptedAmount === undefined ? null : numberFromDecimal(proof.acceptedAmount),
      currency: proof.currency,
      method: proof.method,
      status: proof.status,
      paidAt: proof.paidAt,
      createdAt: proof.createdAt,
      reviewedAt: proof.reviewedAt,
      reviewedBy: proof.reviewedBy ? { id: proof.reviewedBy.id, name: fullName(proof.reviewedBy) || proof.reviewedBy.email } : null,
      proofFileAssetId: proof.proofFileAssetId || null,
      proofFileUrl: proof.proofFileUrl || null,
      proofFileName: proof.proofFileName || null,
      proofFileMimeType: proof.proofFileMimeType || null,
      proofFileSize: proof.proofFileSize || null,
      externalReference: proof.externalReference || null,
      remainingAmount: invoiceState?.remainingAmount ?? null,
      warnings: this.paymentProofIssuesForProof(proof),
      paymentId: proof.paymentId || null,
      linkedPayment: proof.payment ? this.serializeAdminPayment(proof.payment) : null,
      possibleDuplicate: Boolean(proof.possibleDuplicate),
    };
    if (detail) {
      payload.residentNote = proof.residentNote || null;
      payload.adminNote = proof.adminNote || null;
      payload.rejectionReason = proof.rejectionReason || null;
      payload.existingPayments = (proof.invoice?.payments || []).map((payment: any) => this.serializeAdminPayment(payment));
    }
    return payload;
  }

  private paymentProofIssuesForProof(proof: any): PaymentProofIssue[] {
    const issues: PaymentProofIssue[] = [];
    const invoice = proof.invoice || null;
    const serializedProof = { id: proof.id, status: proof.status, amount: numberFromDecimal(proof.amount) };
    const serializedInvoice = invoice ? { id: invoice.id, invoiceNumber: invoice.invoiceNumber, status: invoice.status, total: numberFromDecimal(invoice.total) } : null;
    const serializedApartment = apartmentInfo(proof.apartment || invoice?.apartment);
    const push = (type: PaymentProofIssueType, severity: IssueSeverity, title: string, recommendation: string, blocking = severity === 'CRITICAL') => {
      issues.push({
        id: `${type}-${proof.id}`,
        type,
        severity,
        blocking,
        title,
        recommendation,
        proof: serializedProof,
        invoice: serializedInvoice,
        apartment: serializedApartment,
      });
    };
    if (!invoice) {
      push('RESIDENT_NOT_LINKED_TO_INVOICE', 'CRITICAL', 'Factura asociată nu mai există', 'Verifică manual factura și apartamentul înainte de acceptare.');
      return issues;
    }
    const state = this.invoicePaymentState(invoice, invoice.payments || []);
    const reviewable = REVIEWABLE_PAYMENT_PROOF_STATUSES.includes(proof.status);
    if (invoice.status === BillingDraftInvoiceStatus.CANCELLED) push('INVOICE_CANCELLED', 'CRITICAL', 'Factura este anulată', 'Respinge dovada sau verifică dacă factura trebuie republicată.');
    if (reviewable && state.remainingAmount <= 0) push('INVOICE_ALREADY_PAID', 'CRITICAL', 'Factura este deja achitată', 'Nu accepta dovada fără o verificare manuală a soldului.');
    if (reviewable && numberFromDecimal(proof.amount) > state.remainingAmount) push('AMOUNT_EXCEEDS_REMAINING', 'WARNING', 'Suma depășește soldul rămas', 'Acceptă doar suma verificată sau respinge dovada.');
    if (!proof.proofFileUrl) push('MISSING_PROOF_FILE', 'WARNING', 'Dovada nu are fișier/link atașat', 'Solicită locatarului un document sau verifică manual referința.', false);
    if (!proof.paidAt) push('MISSING_PAID_DATE', 'WARNING', 'Data plății lipsește', 'Completează data la acceptare dacă extrasul o confirmă.', false);
    if (proof.possibleDuplicate) push('DUPLICATE_PROOF', 'WARNING', 'Dovadă posibil duplicată', 'Compară referința, suma și data cu dovezile existente.', false);
    if (String(proof.currency) !== String(invoice.currency)) push('CURRENCY_MISMATCH', 'CRITICAL', 'Moneda nu corespunde facturii', 'Respinge dovada sau cere corectare.');
    if (proof.paymentId || ACCEPTED_PAYMENT_PROOF_STATUSES.includes(proof.status)) {
      push('PAYMENT_ALREADY_ACCEPTED', 'INFO', 'Dovada are plată creată', 'Nu crea o plată dublă pentru aceeași dovadă.', false);
    }
    const linkedUserIds = [
      invoice.resident?.userId,
      invoice.owner?.userId,
      invoice.apartment?.ownerResident?.userId,
      ...(invoice.apartment?.residents || []).map((resident: any) => resident.userId),
    ].filter(Boolean);
    if (linkedUserIds.length && !linkedUserIds.includes(proof.residentUserId)) {
      push('RESIDENT_NOT_LINKED_TO_INVOICE', 'CRITICAL', 'Locatarul nu mai este legat de factură', 'Verifică drepturile de acces înainte de acceptare.');
    }
    return issues;
  }

  private apartmentLedgerInclude() {
    return {
      building: { select: { id: true, name: true } },
      staircase: { select: { id: true, name: true } },
      ownerResident: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, userId: true } },
      residents: {
        select: { id: true, firstName: true, lastName: true, email: true, phone: true, userId: true },
        take: 3,
      },
    } satisfies Prisma.ApartmentInclude;
  }

  private parseLedgerPaymentMethod(value: unknown): PaymentMethod {
    const normalized = optionalString(value)?.toUpperCase() || 'CASH';
    const map: Record<string, PaymentMethod> = {
      CASH: PaymentMethod.CASH,
      BANK: PaymentMethod.BANK,
      BANK_TRANSFER: PaymentMethod.BANK_TRANSFER,
      MANUAL_BANK_TRANSFER: PaymentMethod.MANUAL_BANK_TRANSFER,
      TERMINAL: PaymentMethod.TERMINAL,
      CARD_TERMINAL: PaymentMethod.TERMINAL,
      CARD_EXTERNAL: PaymentMethod.CARD_EXTERNAL,
      BANK_STATEMENT: PaymentMethod.BANK_STATEMENT,
      ADJUSTMENT: PaymentMethod.ADJUSTMENT,
      OTHER: PaymentMethod.OTHER,
    };
    const method = map[normalized];
    if (!method) throw new BadRequestException('Metoda de plată nu este validă.');
    return method;
  }

  private async ensureReceiptForPayment(client: Prisma.TransactionClient, payment: any) {
    const organization = await client.organization.findUnique({
      where: { id: payment.organizationId },
      select: { receiptPrefix: true },
    });
    const paymentDate = payment.paidAt || payment.acceptedAt || payment.confirmedAt || new Date();
    const stamp = new Date(paymentDate).toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = (organization?.receiptPrefix || 'RCPT').trim().toUpperCase();
    await client.receipt.upsert({
      where: { paymentId: payment.id },
      create: {
        organizationId: payment.organizationId,
        apartmentId: payment.apartmentId,
        paymentId: payment.id,
        receiptNumber: `${prefix}-${stamp}-${payment.id.slice(0, 8).toUpperCase()}`,
        amount: numberFromDecimal(payment.amount),
        paymentDate,
      },
      update: {
        amount: numberFromDecimal(payment.amount),
        paymentDate,
      },
    });
  }

  private async recalculateInvoicePaymentStatus(invoiceId: string, actorUserId?: string | null, client: any = this.prisma) {
    const invoice = await client.billingDraftInvoice.findUnique({
      where: { id: invoiceId },
      include: { payments: true },
    });
    if (!invoice) return null;
    if (![BillingDraftInvoiceStatus.PUBLISHED, BillingDraftInvoiceStatus.PARTIALLY_PAID, BillingDraftInvoiceStatus.PAID].includes(invoice.status)) {
      return { invoice, paidAmount: 0, remainingAmount: numberFromDecimal(invoice.total) };
    }
    const state = this.invoicePaymentState(invoice, invoice.payments || []);
    const nextStatus =
      state.remainingAmount <= 0
        ? BillingDraftInvoiceStatus.PAID
        : state.paidAmount > 0
          ? BillingDraftInvoiceStatus.PARTIALLY_PAID
          : BillingDraftInvoiceStatus.PUBLISHED;
    const updated = await client.billingDraftInvoice.update({
      where: { id: invoice.id },
      data: {
        status: nextStatus,
        paidAt: nextStatus === BillingDraftInvoiceStatus.PAID ? new Date() : null,
      },
    });
    if (actorUserId) {
      await this.activity.createActivity({
        organizationId: invoice.organizationId,
        actorUserId,
        type: 'INVOICE_PAYMENT_STATUS_RECALCULATED',
        title: 'Status factură recalculat',
        message: `Factura ${invoice.invoiceNumber || invoice.id} are status ${nextStatus}.`,
        targetType: 'INVOICE',
        targetId: invoice.id,
        link: `/admin/invoices/${invoice.id}`,
      }).catch(() => undefined);
    }
    return { invoice: updated, paidAmount: state.paidAmount, remainingAmount: state.remainingAmount };
  }

  private invoicePaymentState(invoice: any, payments: any[] = []) {
    const total = money(numberFromDecimal(invoice.total));
    const paidAmount = money(
      payments
        .filter((payment) => ACCEPTED_PAYMENT_STATUSES.includes(payment.status))
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    );
    const remainingAmount = money(Math.max(total - paidAmount, 0));
    const overpaidAmount = money(Math.max(paidAmount - total, 0));
    return { invoice, total, paidAmount, remainingAmount, overpaidAmount };
  }

  private async calculateApartmentBalance(organizationId: string, apartmentId: string, apartmentInput?: any) {
    const [apartment, invoices, payments] = await Promise.all([
      apartmentInput ||
        this.prisma.apartment.findFirst({
          where: { id: apartmentId, organizationId },
          include: this.apartmentLedgerInclude(),
        }),
      this.prisma.billingDraftInvoice.findMany({
        where: { organizationId, apartmentId, status: { in: LEDGER_INVOICE_STATUSES } },
        include: { payments: true },
      }),
      this.prisma.payment.findMany({
        where: { organizationId, apartmentId, status: { in: ACCEPTED_PAYMENT_STATUSES } },
        orderBy: [{ paidAt: 'desc' }, { acceptedAt: 'desc' }, { createdAt: 'desc' }],
      }),
    ]);
    const invoiceStates = invoices.map((invoice) => this.invoicePaymentState(invoice, invoice.payments || []));
    const totalInvoiced = money(invoiceStates.reduce((sum, state) => sum + state.total, 0));
    const totalPaid = money(payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0));
    const totalRemaining = money(Math.max(totalInvoiced - totalPaid, 0));
    const overpaidAmount = money(Math.max(totalPaid - totalInvoiced, 0));
    const overdueAmount = money(
      invoiceStates
        .filter((state) => state.remainingAmount > 0 && state.invoice.dueDate && new Date(state.invoice.dueDate).getTime() < Date.now())
        .reduce((sum, state) => sum + state.remainingAmount, 0),
    );
    const partiallyPaidInvoicesCount = invoiceStates.filter((state) => state.paidAmount > 0 && state.remainingAmount > 0).length;
    let status: 'CLEAR' | 'DEBT' | 'OVERPAID' | 'PARTIAL' = 'CLEAR';
    if (overpaidAmount > 0) status = 'OVERPAID';
    else if (partiallyPaidInvoicesCount > 0) status = 'PARTIAL';
    else if (totalRemaining > 0) status = 'DEBT';
    return {
      apartment: this.serializeApartment(apartment),
      building: apartment?.building || null,
      entrance: apartment?.staircase || null,
      resident: this.primaryApartmentContact(apartment),
      totalInvoiced,
      totalPaid,
      totalRemaining,
      balance: totalRemaining,
      overdueAmount,
      overpaidAmount,
      invoicesCount: invoices.length,
      unpaidInvoicesCount: invoiceStates.filter((state) => state.remainingAmount > 0 && state.paidAmount <= 0).length,
      partiallyPaidInvoicesCount,
      paidInvoicesCount: invoiceStates.filter((state) => state.remainingAmount <= 0).length,
      lastPaymentAt: payments[0]?.paidAt || payments[0]?.acceptedAt || payments[0]?.createdAt || null,
      status,
    };
  }

  private async reconciliationInfoForPayment(organizationId: string, payment: any) {
    if (!payment.billingDraftInvoiceId) {
      return { type: 'PAYMENT_WITHOUT_INVOICE', severity: 'WARNING', message: 'Plata nu este legată de o factură.' };
    }
    const invoice = await this.prisma.billingDraftInvoice.findFirst({
      where: { id: payment.billingDraftInvoiceId, organizationId },
      include: { payments: true },
    });
    if (!invoice) return { type: 'PAYMENT_WITHOUT_INVOICE', severity: 'WARNING', message: 'Factura legată nu mai există.' };
    const state = this.invoicePaymentState(invoice, invoice.payments || []);
    if (state.overpaidAmount > 0) return { type: 'OVERPAYMENT', severity: 'WARNING', amount: state.overpaidAmount };
    if (state.remainingAmount > 0) return { type: 'PARTIAL_PAYMENT', severity: 'INFO', amount: state.remainingAmount };
    return { type: 'PAYMENT_MATCHED', severity: 'INFO', amount: Number(payment.amount || 0) };
  }

  private async reconciliationIssuesForOrganization(organizationId: string, query: Record<string, unknown>) {
    const [payments, invoices, apartments] = await Promise.all([
      this.prisma.payment.findMany({
        where: { organizationId },
        include: this.paymentLedgerInclude(),
      }),
      this.prisma.billingDraftInvoice.findMany({
        where: { organizationId, status: { in: LEDGER_INVOICE_STATUSES } },
        include: { payments: true, apartment: { include: { building: true, staircase: true } }, resident: true, owner: true, billingPeriod: true },
      }),
      this.prisma.apartment.findMany({ where: { organizationId }, include: this.apartmentLedgerInclude() }),
    ]);
    const issues: any[] = [];
    payments.forEach((payment) => {
      const base = {
        payment: this.serializeAdminPayment(payment),
        invoice: payment.billingDraftInvoice ? this.serializeInvoiceForLedger(payment.billingDraftInvoice) : null,
        apartment: this.serializeApartment(payment.apartment),
        amount: Number(payment.amount || 0),
      };
      if (!payment.billingDraftInvoiceId && ACCEPTED_PAYMENT_STATUSES.includes(payment.status)) {
        issues.push({ id: `PAYMENT_WITHOUT_INVOICE:${payment.id}`, type: 'PAYMENT_WITHOUT_INVOICE', severity: 'WARNING', blocking: false, recommendation: 'Leagă plata de o factură sau verifică dacă este avans.', ...base });
      }
      if (!payment.paymentProofId && payment.source === PaymentSource.MANUAL_ENTRY) {
        issues.push({ id: `PAYMENT_WITHOUT_PROOF:${payment.id}`, type: 'PAYMENT_WITHOUT_PROOF', severity: 'INFO', blocking: false, recommendation: 'Păstrează referința sau nota internă pentru audit.', ...base });
      }
      if (payment.status === PaymentStatus.REVERSED) {
        issues.push({ id: `PAYMENT_REVERSED:${payment.id}`, type: 'PAYMENT_REVERSED', severity: 'INFO', blocking: false, recommendation: 'Verifică soldul recalculat al facturii.', ...base });
      }
    });
    const duplicateReferences = new Map<string, any[]>();
    payments
      .filter((payment) => payment.externalReference && ACCEPTED_PAYMENT_STATUSES.includes(payment.status))
      .forEach((payment) => {
        const key = `${payment.externalReference}`.toLowerCase();
        duplicateReferences.set(key, [...(duplicateReferences.get(key) || []), payment]);
      });
    duplicateReferences.forEach((rows) => {
      if (rows.length <= 1) return;
      rows.forEach((payment) => {
        issues.push({
          id: `DUPLICATE_PAYMENT_REFERENCE:${payment.id}`,
          type: 'DUPLICATE_PAYMENT_REFERENCE',
          severity: 'WARNING',
          blocking: false,
          payment: this.serializeAdminPayment(payment),
          invoice: payment.billingDraftInvoice ? this.serializeInvoiceForLedger(payment.billingDraftInvoice) : null,
          apartment: this.serializeApartment(payment.apartment),
          amount: Number(payment.amount || 0),
          recommendation: 'Verifică dacă referința externă a fost introdusă de două ori.',
        });
      });
    });
    invoices.forEach((invoice) => {
      const state = this.invoicePaymentState(invoice, invoice.payments || []);
      const invoiceSummary = this.serializeInvoiceForLedger(invoice);
      const apartment = this.serializeApartment(invoice.apartment);
      if (state.overpaidAmount > 0) {
        issues.push({ id: `PAYMENT_AMOUNT_EXCEEDS_REMAINING:${invoice.id}`, type: 'PAYMENT_AMOUNT_EXCEEDS_REMAINING', severity: 'WARNING', blocking: false, invoice: invoiceSummary, apartment, amount: state.overpaidAmount, recommendation: 'Verifică dacă diferența este avans sau eroare de introducere.' });
      }
      if (state.paidAmount > 0 && state.remainingAmount > 0) {
        issues.push({ id: `INVOICE_PARTIALLY_PAID:${invoice.id}`, type: 'INVOICE_PARTIALLY_PAID', severity: 'INFO', blocking: false, invoice: invoiceSummary, apartment, amount: state.remainingAmount, recommendation: 'Urmărește diferența restantă.' });
      }
      if (state.remainingAmount > 0 && invoice.dueDate && new Date(invoice.dueDate).getTime() < Date.now()) {
        issues.push({ id: `INVOICE_OVERDUE:${invoice.id}`, type: 'INVOICE_OVERDUE', severity: 'WARNING', blocking: false, invoice: invoiceSummary, apartment, amount: state.remainingAmount, recommendation: 'Contactează locatarul sau verifică dacă plata a fost înregistrată.' });
      }
    });
    for (const apartment of apartments) {
      const balance = await this.calculateApartmentBalance(organizationId, apartment.id, apartment);
      if (balance.totalRemaining > 0) {
        issues.push({ id: `APARTMENT_HAS_DEBT:${apartment.id}`, type: 'APARTMENT_HAS_DEBT', severity: 'WARNING', blocking: false, apartment: balance.apartment, amount: balance.totalRemaining, recommendation: 'Verifică ledgerul apartamentului și facturile restante.' });
      }
      if (balance.overpaidAmount > 0) {
        issues.push({ id: `APARTMENT_OVERPAID:${apartment.id}`, type: 'APARTMENT_OVERPAID', severity: 'INFO', blocking: false, apartment: balance.apartment, amount: balance.overpaidAmount, recommendation: 'Marchează diferența ca avans sau corectează plata într-un task viitor.' });
      }
    }
    if (optionalString(query.apartmentId)) return issues.filter((issue) => issue.apartment?.id === optionalString(query.apartmentId));
    if (optionalString(query.invoiceId)) return issues.filter((issue) => issue.invoice?.id === optionalString(query.invoiceId));
    return issues;
  }

  private serializeAdminPayment(payment: any, detail = false) {
    const invoice = payment.billingDraftInvoice || null;
    const contact = invoice?.resident || invoice?.owner || null;
    const serialized = {
      id: payment.id,
      paymentId: payment.id,
      invoiceId: payment.billingDraftInvoiceId || null,
      invoiceNumber: invoice?.invoiceNumber || null,
      billingMonth: invoice?.billingPeriod ? monthKey(invoice.billingPeriod) : payment.month,
      apartment: this.serializeApartment(payment.apartment || invoice?.apartment),
      resident: contact ? { id: contact.id, fullName: fullName(contact), phone: contact.phone, email: contact.email, hasUserAccount: Boolean(contact.userId) } : null,
      owner: invoice?.owner ? { id: invoice.owner.id, fullName: fullName(invoice.owner), phone: invoice.owner.phone, email: invoice.owner.email, hasUserAccount: Boolean(invoice.owner.userId) } : null,
      amount: Number(payment.amount || 0),
      currency: payment.currency,
      method: payment.method,
      status: payment.status,
      source: payment.source || 'MANUAL_ENTRY',
      paidAt: payment.paidAt,
      paymentDate: payment.paidAt,
      acceptedAt: payment.acceptedAt || payment.confirmedAt,
      externalReference: payment.externalReference || null,
      referenceNumber: payment.externalReference || null,
      note: payment.note || null,
      notes: payment.note || null,
      internalNote: detail ? payment.internalNote || null : undefined,
      linkedProof: payment.paymentProofId ? { id: payment.paymentProofId } : null,
      paymentProofId: payment.paymentProofId || null,
      createdBy: payment.createdBy ? { id: payment.createdBy.id, fullName: fullName(payment.createdBy), email: payment.createdBy.email } : null,
      acceptedBy: payment.acceptedBy ? { id: payment.acceptedBy.id, fullName: fullName(payment.acceptedBy), email: payment.acceptedBy.email } : null,
      reversedAt: payment.reversedAt || null,
      reversalReason: detail ? payment.reversalReason || null : undefined,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
    return detail ? { ...serialized, invoice: invoice ? this.serializeInvoiceForLedger(invoice) : null } : serialized;
  }

  private serializeInvoiceForLedger(invoice: any) {
    if (!invoice) return null;
    return {
      id: invoice.id,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      billingMonth: invoice.billingPeriod ? monthKey(invoice.billingPeriod) : null,
      status: invoice.status,
      total: numberFromDecimal(invoice.total),
      totalAmount: numberFromDecimal(invoice.total),
      dueDate: invoice.dueDate,
      publishedAt: invoice.publishedAt,
      apartment: invoice.apartment ? this.serializeApartment(invoice.apartment) : null,
    };
  }

  private serializeInvoicePaymentOption(invoice: any) {
    const state = this.invoicePaymentState(invoice, invoice.payments || []);
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      billingMonth: invoice.billingPeriod ? monthKey(invoice.billingPeriod) : null,
      status: invoice.status,
      totalAmount: state.total,
      paidAmount: state.paidAmount,
      balanceAmount: state.remainingAmount,
      remainingAmount: state.remainingAmount,
      dueDate: invoice.dueDate,
      apartment: this.serializeApartment(invoice.apartment),
      resident: invoice.resident ? { id: invoice.resident.id, fullName: fullName(invoice.resident), phone: invoice.resident.phone, email: invoice.resident.email } : null,
      owner: invoice.owner ? { id: invoice.owner.id, fullName: fullName(invoice.owner), phone: invoice.owner.phone, email: invoice.owner.email } : null,
    };
  }

  private serializeApartment(apartment?: any) {
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

  private primaryApartmentContact(apartment?: any) {
    const resident = apartment?.ownerResident || apartment?.residents?.[0];
    if (!resident) return null;
    return { id: resident.id, fullName: fullName(resident), phone: resident.phone, email: resident.email, hasUserAccount: Boolean(resident.userId) };
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

  private async residentBalanceSnapshot(user: MvpUser, apartmentId?: string): Promise<any> {
    const { organizationId, apartmentIds } = await this.residentInvoiceScope(user);
    if (apartmentId && !apartmentIds.includes(apartmentId)) throw new ForbiddenException('Nu ai acces la acest apartament.');
    const scopedApartmentIds = apartmentId ? [apartmentId] : apartmentIds;
    if (!scopedApartmentIds.length) {
      return { organizationId, apartmentIds: [], apartments: [], invoices: [], invoiceSummaries: [], payments: [], paymentProofs: [], apartmentBalances: [] };
    }
    const [apartments, invoices, payments, paymentProofs] = await Promise.all([
      this.prisma.apartment.findMany({
        where: { organizationId, id: { in: scopedApartmentIds } },
        include: this.apartmentLedgerInclude(),
        orderBy: [{ building: { name: 'asc' } }, { staircase: { name: 'asc' } }, { number: 'asc' }],
      }),
      this.prisma.billingDraftInvoice.findMany({
        where: this.residentInvoiceWhere(organizationId, scopedApartmentIds),
        include: this.invoiceListInclude(),
        orderBy: [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
      }),
      this.prisma.payment.findMany({
        where: { organizationId, apartmentId: { in: scopedApartmentIds } },
        include: this.residentPaymentInclude(),
        orderBy: [{ paidAt: 'desc' }, { acceptedAt: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.paymentProof.findMany({
        where: { organizationId, apartmentId: { in: scopedApartmentIds }, residentUserId: user.id },
        include: this.paymentProofInclude(),
        orderBy: [{ createdAt: 'desc' }],
      }),
    ]);
    const paidByInvoice = await this.paidAmountsForInvoices(
      organizationId,
      invoices.map((invoice) => invoice.id),
    );
    const invoiceSummaries = invoices.map((invoice) => this.serializeResidentInvoiceList(invoice, paidByInvoice.get(invoice.id) || 0));
    return {
      organizationId,
      apartmentIds: scopedApartmentIds,
      apartments,
      invoices,
      invoiceSummaries,
      payments,
      paymentProofs,
      apartmentBalances: this.buildResidentApartmentBalances(apartments, invoiceSummaries, payments),
    };
  }

  private buildResidentApartmentBalances(apartments: any[], invoiceSummaries: any[], payments: any[]) {
    return apartments.map((apartment) => {
      const apartmentInvoices = invoiceSummaries.filter((invoice) => invoice.apartmentId === apartment.id && invoice.status !== BillingDraftInvoiceStatus.CANCELLED);
      const apartmentPayments = payments.filter((payment) => payment.apartmentId === apartment.id && ACCEPTED_PAYMENT_STATUSES.includes(payment.status));
      const unpaidInvoices = apartmentInvoices.filter((invoice) => invoice.remainingAmount > 0);
      const overdueInvoices = apartmentInvoices.filter((invoice) => invoice.paymentDisplayStatus === 'OVERDUE');
      const partialInvoices = apartmentInvoices.filter((invoice) => invoice.paymentDisplayStatus === 'PARTIALLY_PAID');
      const totalInvoicedAmount = money(apartmentInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0));
      const totalPaidAmount = money(apartmentPayments.reduce((sum, payment) => sum + numberFromDecimal(payment.amount), 0));
      const totalUnpaidAmount = money(unpaidInvoices.reduce((sum, invoice) => sum + invoice.remainingAmount, 0));
      const overdueAmount = money(overdueInvoices.reduce((sum, invoice) => sum + invoice.remainingAmount, 0));
      const lastPayment =
        [...apartmentPayments].sort((a, b) => new Date(b.acceptedAt || b.paidAt || b.createdAt).getTime() - new Date(a.acceptedAt || a.paidAt || a.createdAt).getTime())[0] || null;
      const lastInvoice =
        [...apartmentInvoices].sort((a, b) => new Date(b.publishedAt || b.updatedAt).getTime() - new Date(a.publishedAt || a.updatedAt).getTime())[0] || null;
      const status = overdueAmount > 0 ? 'OVERDUE' : totalUnpaidAmount > 0 ? (partialInvoices.length ? 'PARTIALLY_PAID' : 'UNPAID') : 'CLEAR';
      return {
        apartmentId: apartment.id,
        apartmentNumber: apartment.number,
        buildingName: apartment.building?.name || null,
        entranceName: apartment.staircase?.name || null,
        apartment: apartmentInfo(apartment),
        totalInvoicedAmount,
        totalPaidAmount,
        totalUnpaidAmount,
        overdueAmount,
        unpaidInvoicesCount: unpaidInvoices.length,
        overdueInvoicesCount: overdueInvoices.length,
        lastInvoice,
        lastPayment: lastPayment ? this.serializeResidentPayment(lastPayment) : null,
        status,
      };
    });
  }

  private residentPaymentWhere(organizationId: string, apartmentIds: string[], query: Record<string, unknown>): Prisma.PaymentWhereInput {
    const where: Prisma.PaymentWhereInput = {
      organizationId,
      apartmentId: { in: apartmentIds.length ? apartmentIds : ['__none__'] },
    };
    const requestedApartmentId = optionalString(query.apartmentId);
    if (requestedApartmentId) where.apartmentId = apartmentIds.includes(requestedApartmentId) ? requestedApartmentId : '__none__';
    const status = optionalString(query.status)?.toUpperCase() as PaymentStatus | undefined;
    if (status && Object.values(PaymentStatus).includes(status)) where.status = status;
    const method = optionalString(query.method)?.toUpperCase() as PaymentMethod | undefined;
    if (method && Object.values(PaymentMethod).includes(method)) where.method = method;
    const source = optionalString(query.source)?.toUpperCase() as PaymentSource | undefined;
    if (source && Object.values(PaymentSource).includes(source)) where.source = source;
    const invoiceId = optionalString(query.invoiceId);
    if (invoiceId) where.billingDraftInvoiceId = invoiceId;
    const dateFrom = parseDate(query.dateFrom);
    const dateTo = parseDate(query.dateTo);
    if (dateFrom || dateTo) where.paidAt = { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) };
    const search = optionalString(query.search);
    if (search) {
      where.OR = [
        { externalReference: { contains: search, mode: 'insensitive' } },
        { note: { contains: search, mode: 'insensitive' } },
        { billingDraftInvoice: { invoiceNumber: { contains: search, mode: 'insensitive' } } },
        { apartment: { number: { contains: search, mode: 'insensitive' } } },
      ];
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
        status: { in: ACCEPTED_PAYMENT_STATUSES },
        OR: [
          { billingDraftInvoiceId: invoiceId },
          { paymentIntent: { is: { metadataJson: { path: ['internalInvoiceId'], equals: invoiceId } } } },
        ],
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

  private serializeAdminInvoice(invoice: any, issues: InvoiceIssue[], paidAmount = 0) {
    return {
      ...this.serializeInvoiceBase(invoice, paidAmount),
      billingPeriod: invoice.billingPeriod,
      billingMonth: monthKey(invoice.billingPeriod),
      apartment: apartmentInfo(invoice.apartment),
      owner: invoice.owner ? { id: invoice.owner.id, name: fullName(invoice.owner), phone: invoice.owner.phone, email: invoice.owner.email, hasUserAccount: Boolean(invoice.owner.userId) } : null,
      resident: invoice.resident ? { id: invoice.resident.id, name: fullName(invoice.resident), phone: invoice.resident.phone, email: invoice.resident.email, hasUserAccount: Boolean(invoice.resident.userId) } : null,
      linesCount: invoice._count?.lines ?? invoice.lines?.length ?? 0,
      issues,
    };
  }

  private serializeAdminInvoiceDetail(invoice: any, issues: InvoiceIssue[], paidAmount = 0) {
    return {
      ...this.serializeAdminInvoice({ ...invoice, _count: { lines: invoice.lines?.length || 0 } }, issues, paidAmount),
      publishedBy: invoice.publishedBy ? { id: invoice.publishedBy.id, name: fullName(invoice.publishedBy) || invoice.publishedBy.email } : null,
      lines: (invoice.lines || []).map((line: any) => this.serializeLine(line)),
    };
  }

  private serializeInvoiceBase(invoice: any, paidAmountInput?: number) {
    const total = numberFromDecimal(invoice.total);
    const paidAmount = paidAmountInput === undefined ? (invoice.status === BillingDraftInvoiceStatus.PAID ? total : 0) : money(paidAmountInput);
    return {
      id: invoice.id,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      total,
      totalAmount: total,
      paidAmount,
      balanceAmount: money(Math.max(total - paidAmount, 0)),
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
    const base = this.serializeInvoiceBase(invoice, paidAmount);
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

  private serializeResidentInvoiceDetail(invoice: any, organization: any, paidAmount = 0, activePaymentIntent: any = null, paymentProofs: any[] = []) {
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
      paymentProofs: paymentProofs.map((proof) => this.serializeResidentPaymentProof(proof, true)),
      paymentUnavailableMessage: 'Plata online va fi disponibilă ulterior.',
      payments: [],
    };
  }

  private serializeResidentPayment(payment: any, detail = false) {
    const invoice = payment.billingDraftInvoice ? this.serializeResidentInvoiceList(payment.billingDraftInvoice, 0) : null;
    const residentName = payment.residentUser?.fullName || fullName(payment.residentUser) || payment.residentUser?.email || payment.residentUser?.phone || null;
    const payload: Record<string, unknown> = {
      id: payment.id,
      paymentId: payment.id,
      invoiceId: payment.billingDraftInvoiceId || null,
      invoiceNumber: payment.billingDraftInvoice?.invoiceNumber || null,
      invoice: invoice
        ? {
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            status: invoice.status,
            totalAmount: invoice.totalAmount,
            remainingAmount: invoice.remainingAmount,
            billingPeriod: invoice.billingPeriod,
            billingMonth: invoice.billingMonth,
          }
        : null,
      apartmentId: payment.apartmentId,
      apartment: apartmentInfo(payment.apartment || payment.billingDraftInvoice?.apartment),
      resident: payment.residentUser ? { id: payment.residentUser.id, name: residentName, email: payment.residentUser.email || null, phone: payment.residentUser.phone || null } : null,
      amount: numberFromDecimal(payment.amount),
      currency: payment.currency,
      method: payment.method,
      status: payment.status,
      source: payment.source,
      paidAt: payment.paidAt,
      acceptedAt: payment.acceptedAt,
      externalReference: payment.externalReference || null,
      linkedProof: payment.paymentProofId ? { id: payment.paymentProofId } : null,
      note: payment.note || null,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
    if (detail) {
      payload.provider = payment.provider || null;
      payload.rejectedAt = payment.rejectedAt || null;
      payload.rejectionReason = payment.rejectionReason || null;
      payload.reversedAt = payment.reversedAt || null;
      payload.reversalReason = payment.reversalReason || null;
    }
    return payload;
  }

  private buildResidentFinancialTimeline(snapshot: { invoiceSummaries: any[]; payments: any[]; paymentProofs?: any[] }) {
    const entries: Array<Record<string, unknown>> = [];
    snapshot.invoiceSummaries.forEach((invoice) => {
      const publishedDate = invoice.publishedAt || invoice.updatedAt || invoice.createdAt;
      if (publishedDate) {
        entries.push({
          id: `invoice-published-${invoice.id}`,
          date: publishedDate,
          type: 'INVOICE_PUBLISHED',
          title: `Factura ${invoice.invoiceNumber || invoice.id} a fost publicată`,
          description: `Factură pentru ${invoice.billingMonth || 'perioada curentă'}.`,
          amount: invoice.totalAmount,
          currency: invoice.currency,
          invoiceId: invoice.id,
          paymentId: null,
          paymentProofId: null,
          apartmentId: invoice.apartmentId,
          apartment: invoice.apartment,
          status: invoice.paymentDisplayStatus,
        });
      }
      if (invoice.paymentDisplayStatus === 'PAID') {
        entries.push({
          id: `invoice-paid-${invoice.id}`,
          date: invoice.updatedAt || invoice.publishedAt,
          type: 'INVOICE_PAID',
          title: `Factura ${invoice.invoiceNumber || invoice.id} este achitată`,
          description: 'Soldul facturii este 0.',
          amount: invoice.totalAmount,
          currency: invoice.currency,
          invoiceId: invoice.id,
          paymentId: null,
          paymentProofId: null,
          apartmentId: invoice.apartmentId,
          apartment: invoice.apartment,
          status: 'PAID',
        });
      }
      if (invoice.paymentDisplayStatus === 'PARTIALLY_PAID') {
        entries.push({
          id: `invoice-partial-${invoice.id}`,
          date: invoice.updatedAt || invoice.publishedAt,
          type: 'INVOICE_PARTIALLY_PAID',
          title: `Factura ${invoice.invoiceNumber || invoice.id} este achitată parțial`,
          description: `Mai rămâne de achitat ${invoice.remainingAmount} ${invoice.currency}.`,
          amount: invoice.remainingAmount,
          currency: invoice.currency,
          invoiceId: invoice.id,
          paymentId: null,
          paymentProofId: null,
          apartmentId: invoice.apartmentId,
          apartment: invoice.apartment,
          status: 'PARTIALLY_PAID',
        });
      }
    });
    snapshot.payments.forEach((payment) => {
      const serialized = this.serializeResidentPayment(payment);
      const accepted = ACCEPTED_PAYMENT_STATUSES.includes(payment.status);
      const isProof = payment.source === PaymentSource.PAYMENT_PROOF;
      let type: string | null = null;
      let title = '';
      let description = '';
      if (isProof && payment.status === PaymentStatus.PENDING) {
        type = 'PAYMENT_PROOF_SUBMITTED';
        title = 'Dovadă de plată trimisă';
        description = 'Dovada este în verificare la administrație.';
      } else if (isProof && accepted) {
        type = 'PAYMENT_PROOF_ACCEPTED';
        title = 'Dovadă de plată acceptată';
        description = 'Plata asociată dovezii a fost acceptată.';
      } else if (isProof && payment.status === PaymentStatus.REJECTED) {
        type = 'PAYMENT_PROOF_REJECTED';
        title = 'Dovadă de plată respinsă';
        description = payment.rejectionReason || 'Dovada a fost respinsă de administrație.';
      } else if (accepted) {
        type = 'PAYMENT_ACCEPTED';
        title = 'Plată acceptată';
        description = payment.billingDraftInvoice?.invoiceNumber ? `Plată pentru factura ${payment.billingDraftInvoice.invoiceNumber}.` : 'Plată înregistrată în contul apartamentului.';
      } else if (payment.status === PaymentStatus.REVERSED || payment.status === PaymentStatus.CANCELLED) {
        type = 'PAYMENT_REVERSED';
        title = payment.status === PaymentStatus.REVERSED ? 'Plată inversată' : 'Plată anulată';
        description = payment.reversalReason || payment.note || 'Soldul a fost recalculat după modificarea plății.';
      }
      if (!type) return;
      entries.push({
        id: `${type}-${payment.id}`,
        date: payment.acceptedAt || payment.paidAt || payment.updatedAt || payment.createdAt,
        type,
        title,
        description,
        amount: numberFromDecimal(payment.amount),
        currency: payment.currency,
        invoiceId: payment.billingDraftInvoiceId || null,
        paymentId: payment.id,
        paymentProofId: payment.paymentProofId || null,
        apartmentId: payment.apartmentId,
        apartment: serialized.apartment,
        status: payment.status,
      });
    });
    (snapshot.paymentProofs || []).forEach((proof) => {
      let type: string | null = null;
      let title = '';
      let description = '';
      if (proof.status === PaymentProofStatus.SUBMITTED || proof.status === PaymentProofStatus.IN_REVIEW) {
        type = 'PAYMENT_PROOF_SUBMITTED';
        title = proof.status === PaymentProofStatus.IN_REVIEW ? 'Dovadă de plată în verificare' : 'Dovadă de plată trimisă';
        description = 'Administrația verifică dovada transmisă.';
      } else if (proof.status === PaymentProofStatus.ACCEPTED || proof.status === PaymentProofStatus.PARTIALLY_ACCEPTED) {
        type = 'PAYMENT_PROOF_ACCEPTED';
        title = proof.status === PaymentProofStatus.PARTIALLY_ACCEPTED ? 'Dovadă de plată acceptată parțial' : 'Dovadă de plată acceptată';
        description = proof.status === PaymentProofStatus.PARTIALLY_ACCEPTED ? 'Doar o parte din sumă a fost acceptată.' : 'Plata asociată dovezii a fost acceptată.';
      } else if (proof.status === PaymentProofStatus.REJECTED) {
        type = 'PAYMENT_PROOF_REJECTED';
        title = 'Dovadă de plată respinsă';
        description = proof.rejectionReason || 'Dovada a fost respinsă de administrație.';
      }
      if (!type) return;
      entries.push({
        id: `${type}-${proof.id}`,
        date: proof.reviewedAt || proof.createdAt,
        type,
        title,
        description,
        amount: numberFromDecimal(proof.acceptedAmount || proof.amount),
        currency: proof.currency,
        invoiceId: proof.invoiceId,
        paymentId: proof.paymentId || null,
        paymentProofId: proof.id,
        apartmentId: proof.apartmentId,
        apartment: apartmentInfo(proof.apartment || proof.invoice?.apartment),
        status: proof.status,
      });
    });
    return entries.sort((a, b) => new Date(String(b.date || 0)).getTime() - new Date(String(a.date || 0)).getTime());
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
