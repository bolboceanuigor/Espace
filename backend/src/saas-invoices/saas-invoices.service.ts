import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BillingCurrency,
  Prisma,
  SaasBillingCycle,
  SaasInvoiceEventType,
  SaasInvoiceLineType,
  SaasInvoiceSource,
  SaasInvoiceStatus,
  SaasSubscriptionStatus,
} from '@prisma/client';
import { buildPaginationMeta, resolvePagination } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';

type Actor = { id?: string; sub?: string; organizationId?: string | null };
type Payload = Record<string, unknown>;

const FINAL_STATUSES: SaasInvoiceStatus[] = [SaasInvoiceStatus.CANCELLED, SaasInvoiceStatus.VOID];
const PAYABLE_STATUSES: SaasInvoiceStatus[] = [SaasInvoiceStatus.ISSUED, SaasInvoiceStatus.PARTIALLY_PAID];
const DUPLICATE_BLOCK_STATUSES: SaasInvoiceStatus[] = [
  SaasInvoiceStatus.ISSUED,
  SaasInvoiceStatus.PARTIALLY_PAID,
  SaasInvoiceStatus.PAID,
];
const BILLABLE_SUBSCRIPTION_STATUSES: SaasSubscriptionStatus[] = [
  SaasSubscriptionStatus.ACTIVE,
  SaasSubscriptionStatus.TRIALING,
  SaasSubscriptionStatus.PAST_DUE,
];

@Injectable()
export class SaasInvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  async superadminList(query: Record<string, unknown>) {
    const { page, limit, skip } = resolvePagination({ page: Number(query.page) || undefined, limit: Number(query.limit) || undefined }, 20, 100);
    const where = this.where(query);
    const [total, invoices, stats] = await Promise.all([
      this.prisma.saasInvoice.count({ where }),
      this.prisma.saasInvoice.findMany({
        where,
        include: this.listInclude(),
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.superadminStats(),
    ]);
    return { items: invoices.map((invoice) => this.serializeList(invoice)), meta: buildPaginationMeta(page, limit, total), stats };
  }

  async superadminStats() {
    const invoices = await this.prisma.saasInvoice.findMany({ select: { status: true, totalAmount: true, paidAmount: true, balanceAmount: true, dueDate: true } });
    return this.stats(invoices);
  }

  async associationInvoices(associationId: string, query: Record<string, unknown>) {
    const where = { ...this.where(query), associationId };
    const invoices = await this.prisma.saasInvoice.findMany({ where, include: this.listInclude(), orderBy: { createdAt: 'desc' } });
    return { items: invoices.map((invoice) => this.serializeList(invoice)), meta: { total: invoices.length }, stats: this.stats(invoices) };
  }

  async superadminGet(id: string) {
    const invoice = await this.prisma.saasInvoice.findUnique({ where: { id }, include: this.detailInclude() });
    if (!invoice) throw new NotFoundException('Factura SaaS nu a fost găsită.');
    return this.serializeDetail(invoice, true);
  }

  async events(id: string) {
    const invoice = await this.prisma.saasInvoice.findUnique({ where: { id }, select: { id: true } });
    if (!invoice) throw new NotFoundException('Factura SaaS nu a fost găsită.');
    const events = await this.prisma.saasInvoiceEvent.findMany({
      where: { invoiceId: id },
      orderBy: { createdAt: 'desc' },
      include: { actor: { select: { id: true, email: true, firstName: true, lastName: true } } },
    });
    return { items: events.map((event) => this.serializeEvent(event)) };
  }

  async createManual(actor: Actor, body: unknown) {
    const payload = this.payload(body);
    const associationId = this.requiredString(payload.associationId, 'Asociația este obligatorie.');
    await this.assertAssociation(associationId);
    const subscriptionId = this.optionalString(payload.subscriptionId);
    const subscription = subscriptionId ? await this.assertSubscription(associationId, subscriptionId) : null;
    const billingPeriodStart = this.requiredDate(payload.billingPeriodStart, 'Perioada de început este obligatorie.');
    const billingPeriodEnd = this.requiredDate(payload.billingPeriodEnd, 'Perioada de sfârșit este obligatorie.');
    const issueDate = this.optionalDate(payload.issueDate) || new Date();
    const dueDate = this.requiredDate(payload.dueDate, 'Scadența este obligatorie.');
    if (dueDate < issueDate) throw new BadRequestException('Scadența nu poate fi înainte de data emiterii.');
    await this.assertDuplicateAllowed(subscriptionId, billingPeriodStart, billingPeriodEnd, payload);
    const currency = this.optionalEnum(payload.currency, BillingCurrency) || subscription?.currency || BillingCurrency.MDL;
    const lines = this.normalizeLines(payload.lines, currency, subscriptionId, this.optionalString(payload.planId) || subscription?.planId || undefined);
    const totals = this.calculateTotals(lines, this.optionalNumber(payload.taxAmount) || 0);
    const invoiceNumber = await this.nextInvoiceNumber(issueDate);
    const invoice = await this.prisma.saasInvoice.create({
      data: {
        associationId,
        subscriptionId,
        planId: this.optionalString(payload.planId) || subscription?.planId || null,
        invoiceNumber,
        billingPeriodStart,
        billingPeriodEnd,
        billingMonth: this.monthKey(billingPeriodStart),
        issueDate,
        dueDate,
        currency,
        ...totals,
        notes: this.optionalString(payload.notes),
        internalNotes: this.optionalString(payload.internalNotes),
        source: SaasInvoiceSource.MANUAL,
        sourceUpgradeRequestId: this.optionalString(payload.sourceUpgradeRequestId),
        duplicateReason: this.optionalString(payload.duplicateReason),
        createdById: this.actorId(actor),
        lines: { create: lines },
      },
      include: this.detailInclude(),
    });
    await this.event(invoice.id, invoice.associationId, this.actorId(actor), SaasInvoiceEventType.INVOICE_CREATED, 'Factură creată', 'Factura SaaS a fost creată ca draft.');
    await this.audit(this.actorId(actor), 'SAAS_INVOICE_CREATED', invoice, null);
    return this.serializeDetail(invoice, true);
  }

  async createFromSubscription(actor: Actor, body: unknown) {
    const payload = this.payload(body);
    const associationId = this.requiredString(payload.associationId, 'Asociația este obligatorie.');
    const subscriptionId = this.requiredString(payload.subscriptionId, 'Abonamentul este obligatoriu.');
    const subscription = await this.assertSubscription(associationId, subscriptionId);
    if (!BILLABLE_SUBSCRIPTION_STATUSES.includes(subscription.status)) {
      throw new BadRequestException('Abonamentul trebuie să fie ACTIVE, TRIALING sau PAST_DUE pentru facturare.');
    }
    const billingPeriodStart = this.requiredDate(payload.billingPeriodStart, 'Perioada de început este obligatorie.');
    const billingPeriodEnd = this.requiredDate(payload.billingPeriodEnd, 'Perioada de sfârșit este obligatorie.');
    await this.assertDuplicateAllowed(subscriptionId, billingPeriodStart, billingPeriodEnd, payload);
    const dueDate = this.requiredDate(payload.dueDate, 'Scadența este obligatorie.');
    const issueDate = this.optionalDate(payload.issueDate) || new Date();
    if (dueDate < issueDate) throw new BadRequestException('Scadența nu poate fi înainte de data emiterii.');
    const price = this.subscriptionPrice(subscription);
    if (price <= 0 && !this.optionalBoolean(payload.allowZeroInvoice)) throw new BadRequestException('Abonamentul are preț 0. Confirmă explicit factura de 0 MDL.');
    const currency = subscription.currency || BillingCurrency.MDL;
    const lines: Prisma.SaasInvoiceLineUncheckedCreateWithoutInvoiceInput[] = [
      {
        lineType: SaasInvoiceLineType.SUBSCRIPTION_FEE,
        name: `Abonament ${subscription.plan.name}`,
        description: `Perioada ${this.dateOnly(billingPeriodStart)} - ${this.dateOnly(billingPeriodEnd)}`,
        quantity: 1,
        unitPrice: price,
        amount: price,
        currency,
        planId: subscription.planId,
        subscriptionId,
      },
    ];
    const discount = this.optionalNumber(payload.manualDiscount) || 0;
    if (discount > 0) {
      lines.push({
        lineType: SaasInvoiceLineType.DISCOUNT,
        name: 'Discount comercial',
        description: this.optionalString(payload.discountReason),
        quantity: 1,
        unitPrice: -discount,
        amount: -discount,
        currency,
        planId: subscription.planId,
        subscriptionId,
      });
    }
    const setupFee = this.optionalBoolean(payload.includeSetupFee) ? this.optionalNumber(payload.setupFeeAmount) || 0 : 0;
    if (setupFee > 0) {
      lines.push({
        lineType: SaasInvoiceLineType.SETUP_FEE,
        name: 'Taxă setup inițial',
        description: null,
        quantity: 1,
        unitPrice: setupFee,
        amount: setupFee,
        currency,
        planId: subscription.planId,
        subscriptionId,
      });
    }
    const totals = this.calculateTotals(lines, 0);
    const invoiceNumber = await this.nextInvoiceNumber(issueDate);
    const invoice = await this.prisma.saasInvoice.create({
      data: {
        associationId,
        subscriptionId,
        planId: subscription.planId,
        invoiceNumber,
        billingPeriodStart,
        billingPeriodEnd,
        billingMonth: this.monthKey(billingPeriodStart),
        issueDate,
        dueDate,
        currency,
        ...totals,
        notes: this.optionalString(payload.notes),
        internalNotes: this.optionalString(payload.internalNotes),
        source: SaasInvoiceSource.SUBSCRIPTION,
        duplicateReason: this.optionalString(payload.duplicateReason),
        createdById: this.actorId(actor),
        lines: { create: lines },
      },
      include: this.detailInclude(),
    });
    await this.event(invoice.id, invoice.associationId, this.actorId(actor), SaasInvoiceEventType.INVOICE_CREATED, 'Factură generată', 'Factura SaaS a fost generată din abonament.');
    await this.audit(this.actorId(actor), 'SAAS_INVOICE_CREATED', invoice, null);
    return this.serializeDetail(invoice, true);
  }

  async updateDraft(actor: Actor, id: string, body: unknown) {
    const existing = await this.requireInvoice(id);
    if (existing.status !== SaasInvoiceStatus.DRAFT) throw new ForbiddenException('Doar facturile draft pot fi editate.');
    const payload = this.payload(body);
    const lines = Array.isArray(payload.lines)
      ? this.normalizeLines(payload.lines, existing.currency, existing.subscriptionId || undefined, existing.planId || undefined)
      : null;
    const totals = lines ? this.calculateTotals(lines, this.optionalNumber(payload.taxAmount) ?? existing.taxAmount) : null;
    const invoice = await this.prisma.$transaction(async (tx) => {
      if (lines) {
        await tx.saasInvoiceLine.deleteMany({ where: { invoiceId: id } });
      }
      return tx.saasInvoice.update({
        where: { id },
        data: {
          billingPeriodStart: this.optionalDate(payload.billingPeriodStart) || existing.billingPeriodStart,
          billingPeriodEnd: this.optionalDate(payload.billingPeriodEnd) || existing.billingPeriodEnd,
          issueDate: this.optionalDate(payload.issueDate) || existing.issueDate,
          dueDate: this.optionalDate(payload.dueDate) || existing.dueDate,
          notes: payload.notes === undefined ? existing.notes : this.optionalString(payload.notes),
          internalNotes: payload.internalNotes === undefined ? existing.internalNotes : this.optionalString(payload.internalNotes),
          updatedById: this.actorId(actor),
          ...(totals || {}),
          ...(lines ? { lines: { create: lines } } : {}),
        },
        include: this.detailInclude(),
      });
    });
    await this.event(id, invoice.associationId, this.actorId(actor), SaasInvoiceEventType.INVOICE_UPDATED, 'Factură actualizată', 'Draftul facturii SaaS a fost actualizat.');
    await this.audit(this.actorId(actor), 'SAAS_INVOICE_UPDATED', invoice, existing.status);
    return this.serializeDetail(invoice, true);
  }

  async issue(actor: Actor, id: string) {
    const existing = await this.requireInvoice(id);
    if (existing.status !== SaasInvoiceStatus.DRAFT) throw new ForbiddenException('Doar facturile draft pot fi emise.');
    const invoice = await this.prisma.saasInvoice.update({
      where: { id },
      data: { status: SaasInvoiceStatus.ISSUED, issuedAt: new Date(), issuedById: this.actorId(actor), updatedById: this.actorId(actor) },
      include: this.detailInclude(),
    });
    await this.event(id, invoice.associationId, this.actorId(actor), SaasInvoiceEventType.INVOICE_ISSUED, 'Factură emisă', 'Factura este vizibilă pentru Adminul asociației.');
    await this.audit(this.actorId(actor), 'SAAS_INVOICE_ISSUED', invoice, existing.status);
    return this.serializeDetail(invoice, true);
  }

  async markPaid(actor: Actor, id: string, body: unknown) {
    const existing = await this.requireInvoice(id);
    if (!PAYABLE_STATUSES.includes(existing.status)) throw new ForbiddenException('Doar facturile emise sau parțial achitate pot fi marcate ca achitate.');
    const payload = this.payload(body);
    const paidAmount = this.requiredPositiveNumber(payload.paidAmount, 'Suma achitată este obligatorie.');
    if (paidAmount > existing.balanceAmount) throw new BadRequestException('Suma achitată nu poate depăși soldul facturii.');
    const paymentDate = this.optionalDate(payload.paymentDate) || new Date();
    const totalPaid = this.round(existing.paidAmount + paidAmount);
    const balance = this.round(existing.totalAmount - totalPaid);
    const status = balance > 0 ? SaasInvoiceStatus.PARTIALLY_PAID : SaasInvoiceStatus.PAID;
    const invoice = await this.prisma.saasInvoice.update({
      where: { id },
      data: {
        paidAmount: totalPaid,
        balanceAmount: balance,
        status,
        paidAt: status === SaasInvoiceStatus.PAID ? paymentDate : existing.paidAt,
        markedPaidById: status === SaasInvoiceStatus.PAID ? this.actorId(actor) : existing.markedPaidById,
        updatedById: this.actorId(actor),
      },
      include: this.detailInclude(),
    });
    await this.event(
      id,
      invoice.associationId,
      this.actorId(actor),
      status === SaasInvoiceStatus.PAID ? SaasInvoiceEventType.INVOICE_MARKED_PAID : SaasInvoiceEventType.INVOICE_MARKED_PARTIALLY_PAID,
      status === SaasInvoiceStatus.PAID ? 'Factură achitată' : 'Achitare parțială',
      `Achitare manuală ${paidAmount} ${invoice.currency}${this.optionalString(payload.referenceNumber) ? `, ref. ${this.optionalString(payload.referenceNumber)}` : ''}.`,
      { method: this.optionalString(payload.method), referenceNumber: this.optionalString(payload.referenceNumber), note: this.optionalString(payload.note) },
    );
    await this.audit(this.actorId(actor), status === SaasInvoiceStatus.PAID ? 'SAAS_INVOICE_MARKED_PAID' : 'SAAS_INVOICE_MARKED_PARTIALLY_PAID', invoice, existing.status, { paidAmount });
    return this.serializeDetail(invoice, true);
  }

  async cancel(actor: Actor, id: string, body: unknown) {
    return this.close(actor, id, body, SaasInvoiceStatus.CANCELLED);
  }

  async void(actor: Actor, id: string, body: unknown) {
    return this.close(actor, id, body, SaasInvoiceStatus.VOID);
  }

  async adminList(actor: Actor) {
    const associationId = this.adminAssociationId(actor);
    const invoices = await this.prisma.saasInvoice.findMany({
      where: { associationId, status: { not: SaasInvoiceStatus.DRAFT } },
      include: this.listInclude(),
      orderBy: { createdAt: 'desc' },
    });
    return { items: invoices.map((invoice) => this.serializeList(invoice)), meta: { total: invoices.length }, stats: this.stats(invoices) };
  }

  async adminGet(actor: Actor, id: string) {
    const associationId = this.adminAssociationId(actor);
    const invoice = await this.prisma.saasInvoice.findFirst({
      where: { id, associationId, status: { not: SaasInvoiceStatus.DRAFT } },
      include: this.detailInclude(),
    });
    if (!invoice) throw new NotFoundException('Factura SaaS nu a fost găsită.');
    return this.serializeDetail(invoice, false);
  }

  private async close(actor: Actor, id: string, body: unknown, status: typeof SaasInvoiceStatus.CANCELLED | typeof SaasInvoiceStatus.VOID) {
    const existing = await this.requireInvoice(id);
    if (FINAL_STATUSES.includes(existing.status)) throw new ForbiddenException('Factura este deja închisă.');
    const payload = this.payload(body);
    const reason = this.requiredString(status === SaasInvoiceStatus.CANCELLED ? payload.reason || payload.cancellationReason : payload.reason || payload.voidReason, 'Motivul este obligatoriu.');
    const invoice = await this.prisma.saasInvoice.update({
      where: { id },
      data: status === SaasInvoiceStatus.CANCELLED
        ? { status, cancelledAt: new Date(), cancelledById: this.actorId(actor), cancellationReason: reason, updatedById: this.actorId(actor) }
        : { status, voidedAt: new Date(), voidedById: this.actorId(actor), voidReason: reason, updatedById: this.actorId(actor) },
      include: this.detailInclude(),
    });
    await this.event(
      id,
      invoice.associationId,
      this.actorId(actor),
      status === SaasInvoiceStatus.CANCELLED ? SaasInvoiceEventType.INVOICE_CANCELLED : SaasInvoiceEventType.INVOICE_VOIDED,
      status === SaasInvoiceStatus.CANCELLED ? 'Factură anulată' : 'Factură void',
      reason,
    );
    await this.audit(this.actorId(actor), status === SaasInvoiceStatus.CANCELLED ? 'SAAS_INVOICE_CANCELLED' : 'SAAS_INVOICE_VOIDED', invoice, existing.status, { reason });
    return this.serializeDetail(invoice, true);
  }

  private where(query: Record<string, unknown>): Prisma.SaasInvoiceWhereInput {
    const status = this.optionalEnum(query.status, SaasInvoiceStatus);
    const associationId = this.optionalString(query.associationId);
    const planId = this.optionalString(query.planId);
    const billingMonth = this.optionalString(query.billingMonth);
    const dueDateFrom = this.optionalDate(query.dueDateFrom);
    const dueDateTo = this.optionalDate(query.dueDateTo);
    const search = this.optionalString(query.search);
    const overdueOnly = this.optionalBoolean(query.overdueOnly);
    const unpaidOnly = this.optionalBoolean(query.unpaidOnly);
    const today = new Date();
    return {
      ...(status ? { status } : {}),
      ...(associationId ? { associationId } : {}),
      ...(planId ? { planId } : {}),
      ...(billingMonth ? { billingMonth } : {}),
      ...(dueDateFrom || dueDateTo ? { dueDate: { ...(dueDateFrom ? { gte: dueDateFrom } : {}), ...(dueDateTo ? { lte: dueDateTo } : {}) } } : {}),
      ...(overdueOnly ? { status: { in: PAYABLE_STATUSES }, balanceAmount: { gt: 0 }, dueDate: { lt: today } } : {}),
      ...(unpaidOnly ? { balanceAmount: { gt: 0 }, status: { notIn: FINAL_STATUSES } } : {}),
      ...(search
        ? {
            OR: [
              { invoiceNumber: { contains: search, mode: 'insensitive' } },
              { association: { name: { contains: search, mode: 'insensitive' } } },
              { association: { legalName: { contains: search, mode: 'insensitive' } } },
              { association: { fiscalCode: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
  }

  private listInclude() {
    return {
      association: { select: { id: true, name: true, legalName: true, fiscalCode: true, address: true } },
      subscription: { select: { id: true, status: true, billingCycle: true } },
      plan: { select: { id: true, code: true, name: true } },
    } satisfies Prisma.SaasInvoiceInclude;
  }

  private detailInclude() {
    return {
      ...this.listInclude(),
      lines: { orderBy: { createdAt: 'asc' } },
      events: { orderBy: { createdAt: 'desc' }, include: { actor: { select: { id: true, email: true, firstName: true, lastName: true } } } },
      issuedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
      markedPaidBy: { select: { id: true, email: true, firstName: true, lastName: true } },
    } satisfies Prisma.SaasInvoiceInclude;
  }

  private async requireInvoice(id: string) {
    const invoice = await this.prisma.saasInvoice.findUnique({ where: { id } });
    if (!invoice) throw new NotFoundException('Factura SaaS nu a fost găsită.');
    return invoice;
  }

  private async assertAssociation(associationId: string) {
    const association = await this.prisma.organization.findUnique({ where: { id: associationId }, select: { id: true } });
    if (!association) throw new NotFoundException('Asociația nu a fost găsită.');
  }

  private async assertSubscription(associationId: string, subscriptionId: string) {
    const subscription = await this.prisma.saasSubscription.findFirst({ where: { id: subscriptionId, associationId }, include: { plan: true } });
    if (!subscription) throw new NotFoundException('Abonamentul nu aparține asociației selectate.');
    return subscription;
  }

  private async assertDuplicateAllowed(subscriptionId: string | null, start: Date, end: Date, payload: Payload) {
    if (!subscriptionId) return;
    const existing = await this.prisma.saasInvoice.findFirst({
      where: { subscriptionId, billingPeriodStart: start, billingPeriodEnd: end, status: { in: DUPLICATE_BLOCK_STATUSES } },
      select: { id: true, invoiceNumber: true },
    });
    if (existing && (!this.optionalBoolean(payload.confirmDuplicate) || !this.optionalString(payload.duplicateReason))) {
      throw new BadRequestException({
        code: 'SAAS_INVOICE_DUPLICATE_PERIOD',
        message: 'Există deja o factură emisă/achitată pentru acest abonament și această perioadă.',
        details: { invoiceId: existing.id, invoiceNumber: existing.invoiceNumber },
      });
    }
  }

  private normalizeLines(value: unknown, currency: BillingCurrency, subscriptionId?: string, planId?: string) {
    if (!Array.isArray(value) || !value.length) throw new BadRequestException('Factura trebuie să conțină cel puțin o linie.');
    return value.map((raw) => {
      const line = this.payload(raw);
      const lineType = this.optionalEnum(line.lineType, SaasInvoiceLineType) || SaasInvoiceLineType.OTHER;
      const quantity = this.optionalNumber(line.quantity) ?? 1;
      const unitPrice = this.optionalNumber(line.unitPrice) ?? 0;
      if (quantity <= 0) throw new BadRequestException('Cantitatea trebuie să fie pozitivă.');
      const suppliedAmount = this.optionalNumber(line.amount);
      const amount = suppliedAmount ?? this.round(quantity * unitPrice);
      if (lineType !== SaasInvoiceLineType.DISCOUNT && amount < 0) throw new BadRequestException('Doar liniile de discount pot avea valoare negativă.');
      return {
        lineType,
        name: this.requiredString(line.name, 'Numele liniei este obligatoriu.'),
        description: this.optionalString(line.description),
        quantity,
        unitPrice,
        amount,
        currency: this.optionalEnum(line.currency, BillingCurrency) || currency,
        planId: this.optionalString(line.planId) || planId || null,
        subscriptionId: this.optionalString(line.subscriptionId) || subscriptionId || null,
        metadata: this.payload(line.metadata) as Prisma.InputJsonValue,
      };
    });
  }

  private calculateTotals(lines: Array<{ amount?: number | null; lineType?: SaasInvoiceLineType }>, taxAmount: number) {
    const amounts = lines.map((line) => Number(line.amount || 0));
    const subtotalAmount = this.round(amounts.filter((amount) => amount > 0).reduce((sum, amount) => sum + amount, 0));
    const discountAmount = this.round(Math.abs(amounts.filter((amount) => amount < 0).reduce((sum, amount) => sum + amount, 0)));
    const totalAmount = this.round(amounts.reduce((sum, amount) => sum + amount, 0) + taxAmount);
    if (totalAmount < 0) throw new BadRequestException('Totalul facturii nu poate fi negativ.');
    return { subtotalAmount, discountAmount, taxAmount: this.round(taxAmount), totalAmount, paidAmount: 0, balanceAmount: totalAmount };
  }

  private stats(invoices: Array<{ status: SaasInvoiceStatus; totalAmount: number; paidAmount: number; balanceAmount: number; dueDate: Date }>) {
    const active = invoices.filter((invoice) => !FINAL_STATUSES.includes(invoice.status));
    return {
      totalInvoices: invoices.length,
      totalIssued: this.round(active.reduce((sum, invoice) => sum + invoice.totalAmount, 0)),
      totalPaid: this.round(active.reduce((sum, invoice) => sum + invoice.paidAmount, 0)),
      outstandingBalance: this.round(active.reduce((sum, invoice) => sum + invoice.balanceAmount, 0)),
      draft: invoices.filter((invoice) => invoice.status === SaasInvoiceStatus.DRAFT).length,
      issued: invoices.filter((invoice) => invoice.status === SaasInvoiceStatus.ISSUED).length,
      paid: invoices.filter((invoice) => invoice.status === SaasInvoiceStatus.PAID).length,
      partiallyPaid: invoices.filter((invoice) => invoice.status === SaasInvoiceStatus.PARTIALLY_PAID).length,
      overdue: invoices.filter((invoice) => this.isOverdue(invoice)).length,
      cancelledOrVoid: invoices.filter((invoice) => FINAL_STATUSES.includes(invoice.status)).length,
    };
  }

  private serializeDetail(invoice: any, includeInternal: boolean) {
    return {
      invoice: this.serializeList(invoice, includeInternal),
      association: this.serializeAssociation(invoice.association),
      subscription: invoice.subscription || null,
      plan: invoice.plan || null,
      lines: (invoice.lines || []).map((line: any) => ({
        id: line.id,
        lineType: line.lineType,
        name: line.name,
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        amount: line.amount,
        currency: line.currency,
      })),
      events: includeInternal ? (invoice.events || []).map((event: any) => this.serializeEvent(event)) : [],
    };
  }

  private serializeList(invoice: any, includeInternal = true) {
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      associationId: invoice.associationId,
      association: invoice.association ? this.serializeAssociation(invoice.association) : null,
      subscriptionId: invoice.subscriptionId,
      subscription: invoice.subscription || null,
      planId: invoice.planId,
      plan: invoice.plan || null,
      billingPeriodStart: invoice.billingPeriodStart,
      billingPeriodEnd: invoice.billingPeriodEnd,
      billingMonth: invoice.billingMonth,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      status: this.isOverdue(invoice) ? SaasInvoiceStatus.OVERDUE : invoice.status,
      storedStatus: invoice.status,
      currency: invoice.currency,
      subtotalAmount: invoice.subtotalAmount,
      discountAmount: invoice.discountAmount,
      taxAmount: invoice.taxAmount,
      totalAmount: invoice.totalAmount,
      paidAmount: invoice.paidAmount,
      balanceAmount: invoice.balanceAmount,
      notes: invoice.notes,
      internalNotes: includeInternal ? invoice.internalNotes : undefined,
      source: invoice.source,
      issuedAt: invoice.issuedAt,
      paidAt: invoice.paidAt,
      cancelledAt: invoice.cancelledAt,
      voidedAt: invoice.voidedAt,
      cancellationReason: includeInternal ? invoice.cancellationReason : undefined,
      voidReason: includeInternal ? invoice.voidReason : undefined,
      isOverdue: this.isOverdue(invoice),
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt,
    };
  }

  private serializeAssociation(association: any) {
    return association
      ? {
          id: association.id,
          name: association.name,
          legalName: association.legalName,
          shortName: association.legalName || association.name,
          associationCode: association.fiscalCode,
          fiscalCode: association.fiscalCode,
          address: association.address,
        }
      : null;
  }

  private serializeEvent(event: any) {
    return {
      id: event.id,
      eventType: event.eventType,
      title: event.title,
      message: event.message,
      metadata: event.metadata,
      actor: event.actor ? { id: event.actor.id, email: event.actor.email, fullName: [event.actor.firstName, event.actor.lastName].filter(Boolean).join(' ') || event.actor.email } : null,
      createdAt: event.createdAt,
    };
  }

  private isOverdue(invoice: { status: SaasInvoiceStatus; dueDate: Date; balanceAmount: number }) {
    return PAYABLE_STATUSES.includes(invoice.status) && invoice.balanceAmount > 0 && invoice.dueDate < new Date();
  }

  private async nextInvoiceNumber(issueDate: Date) {
    const ym = `${issueDate.getUTCFullYear()}${String(issueDate.getUTCMonth() + 1).padStart(2, '0')}`;
    const prefix = `ESPACE-${ym}-`;
    const existing = await this.prisma.saasInvoice.findMany({
      where: { invoiceNumber: { startsWith: prefix } },
      select: { invoiceNumber: true },
      orderBy: { invoiceNumber: 'desc' },
      take: 1,
    });
    const last = Number(existing[0]?.invoiceNumber?.split('-').pop() || 0);
    for (let next = last + 1; next < last + 1000; next += 1) {
      const invoiceNumber = `${prefix}${String(next).padStart(4, '0')}`;
      const exists = await this.prisma.saasInvoice.findUnique({ where: { invoiceNumber }, select: { id: true } });
      if (!exists) return invoiceNumber;
    }
    throw new BadRequestException('Nu s-a putut genera numărul facturii.');
  }

  private async event(invoiceId: string, associationId: string, actorUserId: string, eventType: SaasInvoiceEventType, title: string, message: string, metadata?: Record<string, unknown>) {
    await this.prisma.saasInvoiceEvent.create({
      data: { invoiceId, associationId, actorUserId, eventType, title, message, metadata: (metadata || {}) as Prisma.InputJsonValue },
    }).catch(() => undefined);
  }

  private async audit(actorUserId: string, action: string, invoice: any, oldStatus: SaasInvoiceStatus | null, extra?: Record<string, unknown>) {
    await this.prisma.auditLog.create({
      data: {
        organizationId: invoice.associationId,
        userId: actorUserId,
        action,
        entityType: 'SAAS_INVOICE',
        entityId: invoice.id,
        description: 'Eveniment factură SaaS.',
        newValuesJson: {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          associationId: invoice.associationId,
          subscriptionId: invoice.subscriptionId,
          planId: invoice.planId,
          totalAmount: invoice.totalAmount,
          paidAmount: invoice.paidAmount,
          balanceAmount: invoice.balanceAmount,
          oldStatus,
          newStatus: invoice.status,
          ...(extra || {}),
        } as Prisma.InputJsonValue,
      },
    }).catch(() => undefined);
  }

  private subscriptionPrice(subscription: { price: number; billingCycle: SaasBillingCycle; plan: { monthlyPrice: number; yearlyPrice: number | null } }) {
    if (subscription.price > 0) return subscription.price;
    if (subscription.billingCycle === SaasBillingCycle.YEARLY) return subscription.plan.yearlyPrice ?? subscription.plan.monthlyPrice * 12;
    return subscription.plan.monthlyPrice;
  }

  private adminAssociationId(actor: Actor) {
    const associationId = actor.organizationId;
    if (!associationId) throw new ForbiddenException('Nu există asociație activă în context.');
    return associationId;
  }

  private actorId(actor: Actor) {
    return actor.id || actor.sub || '';
  }

  private payload(value: unknown): Payload {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Payload) : {};
  }

  private requiredString(value: unknown, message: string) {
    const text = this.optionalString(value);
    if (!text) throw new BadRequestException(message);
    return text;
  }

  private optionalString(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private requiredDate(value: unknown, message: string) {
    const date = this.optionalDate(value);
    if (!date) throw new BadRequestException(message);
    return date;
  }

  private optionalDate(value: unknown) {
    if (!value) return null;
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private requiredPositiveNumber(value: unknown, message: string) {
    const num = this.optionalNumber(value);
    if (!num || num <= 0) throw new BadRequestException(message);
    return num;
  }

  private optionalNumber(value: unknown) {
    if (value === undefined || value === null || value === '') return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  private optionalBoolean(value: unknown) {
    return value === true || value === 'true' || value === '1' || value === 1;
  }

  private optionalEnum<T extends Record<string, string>>(value: unknown, source: T): T[keyof T] | null {
    if (!value) return null;
    const normalized = String(value).trim().toUpperCase();
    return Object.values(source).includes(normalized) ? (normalized as T[keyof T]) : null;
  }

  private monthKey(date: Date) {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  private dateOnly(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private round(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
