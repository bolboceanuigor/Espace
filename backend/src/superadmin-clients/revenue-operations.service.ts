import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BillingCurrency,
  ClientFollowUpSource,
  ClientFollowUpStatus,
  ClientPriority,
  ClientTaskCategory,
  ClientTaskSource,
  ClientTaskStatus,
  PaymentPromiseStatus,
  Prisma,
  RevenueAgingBucket,
  RevenueCollectionEventType,
  RevenueCollectionPriority,
  RevenueCollectionReason,
  RevenueCollectionStatus,
  SaasInvoiceStatus,
  SaasSubscriptionStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  AssignCollectionCaseDto,
  CancelPaymentPromiseDto,
  CloseCollectionCaseDto,
  CollectionNoteDto,
  CreateCollectionCaseDto,
  CreateCollectionTaskDto,
  CreatePaymentPromiseDto,
  RecordCollectionContactDto,
  ScheduleCollectionFollowUpDto,
  UpdateCollectionPriorityDto,
  UpdateCollectionStatusDto,
} from './dto/revenue-operations.dto';

type Query = Record<string, string | undefined>;

const OPEN_CASE_STATUSES: RevenueCollectionStatus[] = [
  RevenueCollectionStatus.NOT_STARTED,
  RevenueCollectionStatus.NEEDS_FOLLOW_UP,
  RevenueCollectionStatus.CONTACTED,
  RevenueCollectionStatus.PROMISE_TO_PAY,
  RevenueCollectionStatus.PARTIALLY_PAID,
  RevenueCollectionStatus.DISPUTED,
  RevenueCollectionStatus.ESCALATED,
  RevenueCollectionStatus.SUSPENSION_RECOMMENDED,
];

const COLLECTIBLE_INVOICE_STATUSES: SaasInvoiceStatus[] = [SaasInvoiceStatus.ISSUED, SaasInvoiceStatus.PARTIALLY_PAID, SaasInvoiceStatus.OVERDUE];

@Injectable()
export class RevenueOperationsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(query: Query = {}) {
    const now = new Date();
    const [subscriptions, invoices, cases, promises, aging, overdueInvoices, dueSoonInvoices, followUps] = await Promise.all([
      this.prisma.saasSubscription.findMany({ where: { status: { in: [SaasSubscriptionStatus.ACTIVE, SaasSubscriptionStatus.TRIALING, SaasSubscriptionStatus.PAST_DUE] } }, include: { plan: true }, take: 1000 }) as Promise<any[]>,
      this.prisma.saasInvoice.findMany({ where: { status: { not: SaasInvoiceStatus.DRAFT } }, take: 1000 }),
      this.prisma.revenueCollectionCase.findMany({ where: { status: { in: OPEN_CASE_STATUSES } }, include: { promises: true }, orderBy: [{ priority: 'desc' }, { nextFollowUpAt: 'asc' }], take: 100 }),
      this.prisma.paymentPromise.findMany({ where: { status: { in: [PaymentPromiseStatus.OPEN, PaymentPromiseStatus.MISSED] } }, include: { collectionCase: true }, orderBy: { promisedDate: 'asc' }, take: 100 }),
      this.agingReport(query),
      this.overdueInvoices({ limit: '10' }),
      this.dueSoonInvoices(),
      this.prisma.clientFollowUp.count({ where: { status: ClientFollowUpStatus.OPEN, dueAt: { lte: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) }, relatedEntityType: 'REVENUE_COLLECTION_CASE' } }),
    ]);
    const active = subscriptions.filter((item) => item.status === SaasSubscriptionStatus.ACTIVE);
    const estimatedMrr = Math.round(active.reduce((sum, item) => sum + this.monthlyEquivalent(item.price, String(item.billingCycle)), 0));
    const totalIssued = invoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0);
    const totalPaid = invoices.reduce((sum, invoice) => sum + invoice.paidAmount, 0);
    const openInvoices = invoices.filter((invoice) => invoice.balanceAmount > 0 && COLLECTIBLE_INVOICE_STATUSES.includes(invoice.status));
    const overdue = openInvoices.filter((invoice) => invoice.dueDate < now);
    return {
      summary: {
        estimatedMrr,
        estimatedArr: estimatedMrr * 12,
        totalIssued: Math.round(totalIssued),
        totalPaid: Math.round(totalPaid),
        outstandingBalance: Math.round(openInvoices.reduce((sum, invoice) => sum + invoice.balanceAmount, 0)),
        overdueBalance: Math.round(overdue.reduce((sum, invoice) => sum + invoice.balanceAmount, 0)),
        overdueInvoices: overdue.length,
        openCollectionCases: cases.length,
        openPromises: promises.filter((item) => item.status === PaymentPromiseStatus.OPEN).length,
        missedPromises: promises.filter((item) => item.status === PaymentPromiseStatus.MISSED).length,
        followUpsDueToday: followUps,
        currency: 'MDL',
      },
      aging: aging.summary,
      overdueInvoices: overdueInvoices.items,
      dueSoonInvoices,
      casesNeedingFollowUp: cases.filter((item) => !item.nextFollowUpAt || item.nextFollowUpAt <= now).slice(0, 10),
      promisesDueSoon: promises.filter((item) => item.status === PaymentPromiseStatus.OPEN).slice(0, 10),
      missedPromises: promises.filter((item) => item.status === PaymentPromiseStatus.MISSED).slice(0, 10),
      recentActivity: await this.prisma.revenueCollectionEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 12 }),
    };
  }

  async overdueInvoices(query: Query = {}) {
    const take = Math.min(200, Number(query.limit || 100));
    const invoices = await this.prisma.saasInvoice.findMany({
      where: {
        balanceAmount: { gt: 0 },
        dueDate: { lt: new Date() },
        status: { in: COLLECTIBLE_INVOICE_STATUSES },
        ...(query.associationId ? { associationId: query.associationId } : {}),
      },
      include: { association: { select: { id: true, name: true } }, plan: { select: { id: true, name: true, code: true } } },
      orderBy: { dueDate: 'asc' },
      take,
    });
    const cases = await this.prisma.revenueCollectionCase.findMany({ where: { saasInvoiceId: { in: invoices.map((invoice) => invoice.id) } }, include: { promises: true } });
    const caseByInvoice = new Map(cases.map((item) => [item.saasInvoiceId, item]));
    const items = invoices.map((invoice) => {
      const collectionCase = caseByInvoice.get(invoice.id);
      return { ...invoice, daysOverdue: this.daysOverdue(invoice.dueDate, invoice.balanceAmount), agingBucket: this.calculateAgingBucket(invoice.dueDate, invoice.balanceAmount), collectionCase, collectionStatus: collectionCase?.status || RevenueCollectionStatus.NOT_STARTED };
    }).filter((item) => !query.agingBucket || item.agingBucket === query.agingBucket);
    return { items, meta: { total: items.length } };
  }

  async agingReport(query: Query = {}) {
    const invoices = await this.prisma.saasInvoice.findMany({
      where: { balanceAmount: { gt: 0 }, status: { in: COLLECTIBLE_INVOICE_STATUSES }, ...(query.associationId ? { associationId: query.associationId } : {}) },
      include: { association: { select: { id: true, name: true } } },
      take: 2000,
    });
    const buckets = Object.values(RevenueAgingBucket).map((bucket) => ({ bucket, amount: 0, count: 0, clients: new Set<string>() }));
    const rows = new Map<string, any>();
    for (const invoice of invoices) {
      const bucket = this.calculateAgingBucket(invoice.dueDate, invoice.balanceAmount);
      const summary = buckets.find((item) => item.bucket === bucket)!;
      summary.amount += invoice.balanceAmount;
      summary.count++;
      summary.clients.add(invoice.associationId);
      const row = rows.get(invoice.associationId) || { associationId: invoice.associationId, client: invoice.association?.name || invoice.associationId, totalOutstanding: 0 };
      row[bucket] = (row[bucket] || 0) + invoice.balanceAmount;
      row.totalOutstanding += invoice.balanceAmount;
      rows.set(invoice.associationId, row);
    }
    return {
      summary: buckets.map((item) => ({ bucket: item.bucket, amount: Math.round(item.amount), count: item.count, clients: item.clients.size })),
      items: Array.from(rows.values()).sort((a, b) => b.totalOutstanding - a.totalOutstanding),
    };
  }

  async cases(query: Query = {}) {
    const search = query.search?.trim();
    const items = await this.prisma.revenueCollectionCase.findMany({
      where: {
        ...(query.status ? { status: query.status as RevenueCollectionStatus } : {}),
        ...(query.priority ? { priority: query.priority as RevenueCollectionPriority } : {}),
        ...(query.reason ? { reason: query.reason as RevenueCollectionReason } : {}),
        ...(query.agingBucket ? { agingBucket: query.agingBucket as RevenueAgingBucket } : {}),
        ...(query.assignedToId ? { assignedToId: query.assignedToId } : {}),
        ...(query.associationId ? { associationId: query.associationId } : {}),
        ...(query.saasInvoiceId ? { saasInvoiceId: query.saasInvoiceId } : {}),
        ...(query.clientAccountId ? { clientAccountId: query.clientAccountId } : {}),
        ...(query.overdueOnly === 'true' ? { daysOverdue: { gt: 0 } } : {}),
        ...(query.followUpDue === 'true' ? { nextFollowUpAt: { lte: new Date() }, status: { in: OPEN_CASE_STATUSES } } : {}),
        ...(search ? { OR: [{ title: { contains: search, mode: 'insensitive' } }, { description: { contains: search, mode: 'insensitive' } }] } : {}),
      },
      include: { promises: { where: { status: PaymentPromiseStatus.OPEN }, orderBy: { promisedDate: 'asc' }, take: 1 } },
      orderBy: [{ priority: 'desc' }, { daysOverdue: 'desc' }],
      take: 200,
    });
    return { items, meta: { total: items.length } };
  }

  async caseDetail(id: string) {
    const collectionCase = await this.ensureCase(id);
    const [client, association, invoice, subscription, promises, notes, events, tasks, followUps] = await Promise.all([
      collectionCase.clientAccountId ? this.prisma.clientAccount.findUnique({ where: { id: collectionCase.clientAccountId } }) : null,
      this.prisma.organization.findUnique({ where: { id: collectionCase.associationId }, select: { id: true, name: true, legalName: true, status: true } }),
      collectionCase.saasInvoiceId ? this.prisma.saasInvoice.findUnique({ where: { id: collectionCase.saasInvoiceId }, include: { plan: true } }) : null,
      collectionCase.saasSubscriptionId ? this.prisma.saasSubscription.findUnique({ where: { id: collectionCase.saasSubscriptionId }, include: { plan: true } }) : null,
      this.prisma.paymentPromise.findMany({ where: { collectionCaseId: id }, orderBy: { promisedDate: 'desc' } }),
      this.prisma.revenueCollectionNote.findMany({ where: { collectionCaseId: id }, orderBy: { createdAt: 'desc' } }),
      this.prisma.revenueCollectionEvent.findMany({ where: { collectionCaseId: id }, orderBy: { createdAt: 'desc' } }),
      this.prisma.clientTask.findMany({ where: { relatedEntityType: 'REVENUE_COLLECTION_CASE', relatedEntityId: id }, orderBy: { createdAt: 'desc' } }),
      this.prisma.clientFollowUp.findMany({ where: { relatedEntityType: 'REVENUE_COLLECTION_CASE', relatedEntityId: id }, orderBy: { dueAt: 'asc' } }),
    ]);
    return { case: collectionCase, client, association, invoice, subscription, promises, notes, events, tasks, followUps };
  }

  async createCase(dto: CreateCollectionCaseDto, actor: any) {
    return this.ensureCaseForInvoice(dto.saasInvoiceId, actor, dto);
  }

  async ensureCaseForInvoice(invoiceId: string, actor: any, options?: Partial<CreateCollectionCaseDto>) {
    const invoice = await this.prisma.saasInvoice.findUnique({ where: { id: invoiceId }, include: { association: true, subscription: true, plan: true } });
    if (!invoice) throw new NotFoundException('Factura SaaS nu a fost gasita.');
    if (invoice.balanceAmount <= 0 || !COLLECTIBLE_INVOICE_STATUSES.includes(invoice.status)) throw new BadRequestException('Doar facturile SaaS emise, partial achitate sau overdue cu sold pot avea collection case.');
    const existing = await this.prisma.revenueCollectionCase.findFirst({ where: { saasInvoiceId: invoice.id, status: { in: OPEN_CASE_STATUSES } } });
    if (existing) return existing;
    const client = await this.prisma.clientAccount.findFirst({ where: { associationId: invoice.associationId }, orderBy: { updatedAt: 'desc' } });
    const daysOverdue = this.daysOverdue(invoice.dueDate, invoice.balanceAmount);
    const reason = invoice.dueDate > new Date() ? RevenueCollectionReason.INVOICE_DUE_SOON : invoice.status === SaasInvoiceStatus.PARTIALLY_PAID ? RevenueCollectionReason.PARTIAL_PAYMENT : RevenueCollectionReason.INVOICE_OVERDUE;
    const created = await this.prisma.revenueCollectionCase.create({
      data: {
        associationId: invoice.associationId,
        clientAccountId: client?.id || null,
        saasInvoiceId: invoice.id,
        saasSubscriptionId: invoice.subscriptionId || null,
        status: RevenueCollectionStatus.NEEDS_FOLLOW_UP,
        priority: options?.priority || this.priorityForDays(daysOverdue),
        reason,
        agingBucket: this.calculateAgingBucket(invoice.dueDate, invoice.balanceAmount),
        title: `Urmarire incasare ${invoice.invoiceNumber}`,
        description: options?.description || null,
        amountDue: invoice.balanceAmount,
        currency: invoice.currency,
        dueDate: invoice.dueDate,
        daysOverdue,
        assignedToId: options?.assignedToId || null,
        createdById: actor?.id || null,
      },
    });
    await this.event(created, actor, RevenueCollectionEventType.COLLECTION_CASE_CREATED, 'Collection case creat', created.title);
    return created;
  }

  async updateStatus(id: string, dto: UpdateCollectionStatusDto, actor: any) {
    const current = await this.ensureCase(id);
    if (dto.status === RevenueCollectionStatus.PAID || dto.status === RevenueCollectionStatus.PARTIALLY_PAID) {
      const invoice = current.saasInvoiceId ? await this.prisma.saasInvoice.findUnique({ where: { id: current.saasInvoiceId } }) : null;
      if (dto.status === RevenueCollectionStatus.PAID && invoice?.status !== SaasInvoiceStatus.PAID) throw new BadRequestException('Statusul PAID se seteaza doar daca factura SaaS este PAID.');
      if (dto.status === RevenueCollectionStatus.PARTIALLY_PAID && invoice?.status !== SaasInvoiceStatus.PARTIALLY_PAID) throw new BadRequestException('Statusul PARTIALLY_PAID se seteaza doar daca factura SaaS este PARTIALLY_PAID.');
    }
    const updated = await this.prisma.revenueCollectionCase.update({ where: { id }, data: { status: dto.status, updatedById: actor?.id || null } });
    await this.event(updated, actor, RevenueCollectionEventType.COLLECTION_STATUS_CHANGED, 'Status collection schimbat', `${current.status} -> ${updated.status}`, { oldStatus: current.status, newStatus: updated.status, reason: dto.reason });
    return updated;
  }

  async updatePriority(id: string, dto: UpdateCollectionPriorityDto, actor: any) {
    const current = await this.ensureCase(id);
    const updated = await this.prisma.revenueCollectionCase.update({ where: { id }, data: { priority: dto.priority, updatedById: actor?.id || null } });
    await this.event(updated, actor, RevenueCollectionEventType.COLLECTION_PRIORITY_CHANGED, 'Prioritate schimbata', `${current.priority} -> ${updated.priority}`);
    return updated;
  }

  async assign(id: string, dto: AssignCollectionCaseDto, actor: any) {
    const updated = await this.prisma.revenueCollectionCase.update({ where: { id }, data: { assignedToId: dto.assignedToId || null, updatedById: actor?.id || null } });
    await this.event(updated, actor, RevenueCollectionEventType.COLLECTION_ASSIGNED, 'Collection case asignat', dto.assignedToId || 'Neasignat');
    return updated;
  }

  async addNote(id: string, dto: CollectionNoteDto, actor: any) {
    const collectionCase = await this.ensureCase(id);
    const note = await this.prisma.revenueCollectionNote.create({ data: { collectionCaseId: id, associationId: collectionCase.associationId, clientAccountId: collectionCase.clientAccountId, saasInvoiceId: collectionCase.saasInvoiceId, authorUserId: actor?.id || 'system', note: dto.note, contactMethod: dto.contactMethod || null, contactedPerson: dto.contactedPerson || null, nextStep: dto.nextStep || null } });
    await this.event(collectionCase, actor, RevenueCollectionEventType.COLLECTION_NOTE_ADDED, 'Nota collections adaugata', dto.note, { noteId: note.id });
    return note;
  }

  async recordContact(id: string, dto: RecordCollectionContactDto, actor: any) {
    const note = await this.addNote(id, dto, actor);
    const updated = await this.prisma.revenueCollectionCase.update({ where: { id }, data: { status: RevenueCollectionStatus.CONTACTED, lastContactedAt: new Date(), nextFollowUpAt: dto.nextFollowUpAt ? new Date(dto.nextFollowUpAt) : undefined, updatedById: actor?.id || null } });
    if (dto.nextFollowUpAt) await this.scheduleFollowUp(id, { dueAt: dto.nextFollowUpAt, title: dto.nextStep || 'Follow-up plata', assignedToId: updated.assignedToId || undefined }, actor);
    await this.event(updated, actor, RevenueCollectionEventType.CLIENT_CONTACTED, 'Client contactat', dto.note, { noteId: note.id, contactMethod: dto.contactMethod });
    return { note, case: updated };
  }

  async createPromise(id: string, dto: CreatePaymentPromiseDto, actor: any) {
    const collectionCase = await this.ensureCase(id);
    if (dto.promisedAmount <= 0) throw new BadRequestException('Suma promisa trebuie sa fie mai mare ca 0.');
    const promise = await this.prisma.paymentPromise.create({ data: { collectionCaseId: id, associationId: collectionCase.associationId, clientAccountId: collectionCase.clientAccountId, saasInvoiceId: collectionCase.saasInvoiceId, promisedAmount: dto.promisedAmount, currency: dto.currency || collectionCase.currency, promisedDate: new Date(dto.promisedDate), promisedByName: dto.promisedByName || null, promisedByContact: dto.promisedByContact || null, note: dto.note || null, createdById: actor?.id || 'system' } });
    const nextFollowUpAt = new Date(promise.promisedDate.getTime() + 24 * 60 * 60 * 1000);
    const updated = await this.prisma.revenueCollectionCase.update({ where: { id }, data: { status: RevenueCollectionStatus.PROMISE_TO_PAY, nextFollowUpAt, updatedById: actor?.id || null } });
    await this.event(updated, actor, RevenueCollectionEventType.PAYMENT_PROMISE_CREATED, 'Promisiune de plata creata', `${promise.promisedAmount} ${promise.currency} pana la ${promise.promisedDate.toISOString().slice(0, 10)}`, { promiseId: promise.id });
    return promise;
  }

  async promises(query: Query = {}) {
    const items = await this.prisma.paymentPromise.findMany({ where: { ...(query.status ? { status: query.status as PaymentPromiseStatus } : {}), ...(query.associationId ? { associationId: query.associationId } : {}), ...(query.clientAccountId ? { clientAccountId: query.clientAccountId } : {}) }, include: { collectionCase: true }, orderBy: { promisedDate: 'asc' }, take: 200 });
    return { items, meta: { total: items.length } };
  }

  async promiseDetail(id: string) {
    const promise = await this.prisma.paymentPromise.findUnique({ where: { id }, include: { collectionCase: true } });
    if (!promise) throw new NotFoundException('Promisiunea de plata nu a fost gasita.');
    const events = await this.prisma.revenueCollectionEvent.findMany({ where: { collectionCaseId: promise.collectionCaseId }, orderBy: { createdAt: 'desc' }, take: 50 });
    return { promise, events };
  }

  async markPromiseKept(id: string, actor: any) {
    const promise = await this.ensurePromise(id);
    const updated = await this.prisma.paymentPromise.update({ where: { id }, data: { status: PaymentPromiseStatus.KEPT, keptAt: new Date(), updatedById: actor?.id || null } });
    const collectionCase = await this.ensureCase(promise.collectionCaseId);
    await this.event(collectionCase, actor, RevenueCollectionEventType.PAYMENT_PROMISE_KEPT, 'Promisiune respectata', `${promise.promisedAmount} ${promise.currency}`, { promiseId: id });
    return updated;
  }

  async markPromiseMissed(id: string, actor: any) {
    const promise = await this.ensurePromise(id);
    const updated = await this.prisma.paymentPromise.update({ where: { id }, data: { status: PaymentPromiseStatus.MISSED, missedAt: new Date(), updatedById: actor?.id || null } });
    const collectionCase = await this.prisma.revenueCollectionCase.update({ where: { id: promise.collectionCaseId }, data: { status: RevenueCollectionStatus.NEEDS_FOLLOW_UP, updatedById: actor?.id || null } });
    await this.event(collectionCase, actor, RevenueCollectionEventType.PAYMENT_PROMISE_MISSED, 'Promisiune ratata', `${promise.promisedAmount} ${promise.currency}`, { promiseId: id });
    return updated;
  }

  async cancelPromise(id: string, dto: CancelPaymentPromiseDto, actor: any) {
    const promise = await this.ensurePromise(id);
    const updated = await this.prisma.paymentPromise.update({ where: { id }, data: { status: PaymentPromiseStatus.CANCELLED, cancelledAt: new Date(), cancelledById: actor?.id || null, cancellationReason: dto.reason, updatedById: actor?.id || null } });
    const collectionCase = await this.ensureCase(promise.collectionCaseId);
    await this.event(collectionCase, actor, RevenueCollectionEventType.PAYMENT_PROMISE_CANCELLED, 'Promisiune anulata', dto.reason, { promiseId: id });
    return updated;
  }

  async scheduleFollowUp(id: string, dto: ScheduleCollectionFollowUpDto, actor: any) {
    const collectionCase = await this.ensureCase(id);
    if (!collectionCase.clientAccountId) throw new BadRequestException('Collection case fara clientAccount nu poate crea follow-up CRM.');
    const dueAt = new Date(dto.dueAt);
    const followUp = await this.prisma.clientFollowUp.create({ data: { clientAccountId: collectionCase.clientAccountId, associationId: collectionCase.associationId, title: dto.title || `Follow-up plata ${collectionCase.title}`, dueAt, status: ClientFollowUpStatus.OPEN, priority: this.clientPriority(collectionCase.priority), assignedToId: dto.assignedToId || collectionCase.assignedToId || null, createdById: actor?.id || null, source: ClientFollowUpSource.SAAS_INVOICE, relatedEntityType: 'REVENUE_COLLECTION_CASE', relatedEntityId: id } });
    const updated = await this.prisma.revenueCollectionCase.update({ where: { id }, data: { nextFollowUpAt: dueAt, updatedById: actor?.id || null } });
    await this.event(updated, actor, RevenueCollectionEventType.FOLLOW_UP_SCHEDULED, 'Follow-up plata programat', dueAt.toISOString(), { followUpId: followUp.id });
    return followUp;
  }

  async createTask(id: string, dto: CreateCollectionTaskDto, actor: any) {
    const collectionCase = await this.ensureCase(id);
    if (!collectionCase.clientAccountId) throw new BadRequestException('Collection case fara clientAccount nu poate crea task CRM.');
    const task = await this.prisma.clientTask.create({ data: { clientAccountId: collectionCase.clientAccountId, associationId: collectionCase.associationId, title: dto.title || `Verifica plata: ${collectionCase.title}`, status: ClientTaskStatus.OPEN, priority: this.clientPriority(collectionCase.priority), category: ClientTaskCategory.SAAS_INVOICE, dueAt: dto.dueAt ? new Date(dto.dueAt) : new Date(Date.now() + 24 * 60 * 60 * 1000), assignedToId: dto.assignedToId || collectionCase.assignedToId || null, createdById: actor?.id || null, source: ClientTaskSource.SAAS_INVOICE, relatedEntityType: 'REVENUE_COLLECTION_CASE', relatedEntityId: id } });
    await this.event(collectionCase, actor, RevenueCollectionEventType.TASK_CREATED, 'Task collections creat', task.title, { taskId: task.id });
    return task;
  }

  async escalate(id: string, actor: any) {
    const updated = await this.prisma.revenueCollectionCase.update({ where: { id }, data: { status: RevenueCollectionStatus.ESCALATED, priority: RevenueCollectionPriority.URGENT, updatedById: actor?.id || null } });
    await this.event(updated, actor, RevenueCollectionEventType.CASE_ESCALATED, 'Collection case escaladat', updated.title);
    return updated;
  }

  async recommendSuspension(id: string, actor: any) {
    const updated = await this.prisma.revenueCollectionCase.update({ where: { id }, data: { status: RevenueCollectionStatus.SUSPENSION_RECOMMENDED, priority: RevenueCollectionPriority.URGENT, updatedById: actor?.id || null } });
    await this.event(updated, actor, RevenueCollectionEventType.SUSPENSION_RECOMMENDED, 'Suspendare recomandata', 'Recomandare interna, fara suspendare automata.');
    if (updated.clientAccountId) await this.createTask(id, { title: 'Analizeaza suspendarea abonamentului', assignedToId: updated.assignedToId || undefined }, actor).catch(() => undefined);
    return updated;
  }

  async closeCase(id: string, dto: CloseCollectionCaseDto, actor: any) {
    const status = dto.status || RevenueCollectionStatus.CLOSED;
    const finalStatuses: RevenueCollectionStatus[] = [RevenueCollectionStatus.PAID, RevenueCollectionStatus.CLOSED, RevenueCollectionStatus.WRITTEN_OFF, RevenueCollectionStatus.DISPUTED];
    if (!finalStatuses.includes(status)) throw new BadRequestException('Status final invalid pentru inchidere.');
    const updated = await this.prisma.revenueCollectionCase.update({ where: { id }, data: { status, closedAt: new Date(), closedById: actor?.id || null, closeReason: dto.reason, updatedById: actor?.id || null } });
    await this.event(updated, actor, RevenueCollectionEventType.CASE_CLOSED, 'Collection case inchis', dto.reason);
    return updated;
  }

  async syncCases(actor: any) {
    const invoices = await this.prisma.saasInvoice.findMany({ where: { balanceAmount: { gt: 0 }, status: { in: COLLECTIBLE_INVOICE_STATUSES }, OR: [{ dueDate: { lt: new Date() } }, { dueDate: { lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } }] }, take: 500 });
    let created = 0;
    let updated = 0;
    for (const invoice of invoices) {
      const existing = await this.prisma.revenueCollectionCase.findFirst({ where: { saasInvoiceId: invoice.id, status: { in: OPEN_CASE_STATUSES } } });
      if (!existing && invoice.dueDate < new Date()) {
        await this.ensureCaseForInvoice(invoice.id, actor);
        created++;
      } else if (existing) {
        await this.prisma.revenueCollectionCase.update({ where: { id: existing.id }, data: { amountDue: invoice.balanceAmount, daysOverdue: this.daysOverdue(invoice.dueDate, invoice.balanceAmount), agingBucket: this.calculateAgingBucket(invoice.dueDate, invoice.balanceAmount) } });
        updated++;
      }
    }
    const paidCases = await this.prisma.revenueCollectionCase.findMany({ where: { status: { in: OPEN_CASE_STATUSES }, saasInvoiceId: { not: null } }, take: 500 });
    let closedPaid = 0;
    for (const item of paidCases) {
      const invoice = item.saasInvoiceId ? await this.prisma.saasInvoice.findUnique({ where: { id: item.saasInvoiceId } }) : null;
      if (invoice?.status === SaasInvoiceStatus.PAID) {
        const updatedCase = await this.prisma.revenueCollectionCase.update({ where: { id: item.id }, data: { status: RevenueCollectionStatus.PAID, closedAt: new Date(), closedById: actor?.id || null, closeReason: 'Factura SaaS este PAID.' } });
        await this.event(updatedCase, actor, RevenueCollectionEventType.INVOICE_MARKED_PAID_LINKED, 'Factura PAID legata', invoice.invoiceNumber);
        closedPaid++;
      }
    }
    return { created, updated, closedPaid };
  }

  async clientProfile(clientId: string) {
    const client = await this.prisma.clientAccount.findUnique({ where: { id: clientId } });
    if (!client) throw new NotFoundException('Client not found');
    return this.profile({ clientAccountId: clientId, associationId: client.associationId || undefined }, client);
  }

  async associationProfile(associationId: string) {
    const client = await this.prisma.clientAccount.findFirst({ where: { associationId }, orderBy: { updatedAt: 'desc' } });
    return this.profile({ associationId, clientAccountId: client?.id }, client);
  }

  async reports(query: Query = {}) {
    const [dashboard, aging] = await Promise.all([this.dashboard(query), this.agingReport(query)]);
    return { dashboard: dashboard.summary, aging: aging.summary };
  }

  private async profile(scope: { associationId?: string; clientAccountId?: string }, client: any) {
    const [subscription, invoices, cases, promises, notes] = await Promise.all([
      scope.associationId ? this.prisma.saasSubscription.findFirst({ where: { associationId: scope.associationId }, include: { plan: true }, orderBy: { updatedAt: 'desc' } }) : null,
      scope.associationId ? this.prisma.saasInvoice.findMany({ where: { associationId: scope.associationId }, orderBy: { dueDate: 'desc' }, take: 100 }) : [],
      this.prisma.revenueCollectionCase.findMany({ where: { ...(scope.associationId ? { associationId: scope.associationId } : {}), ...(scope.clientAccountId ? { clientAccountId: scope.clientAccountId } : {}) }, orderBy: { updatedAt: 'desc' }, take: 100 }),
      this.prisma.paymentPromise.findMany({ where: { ...(scope.associationId ? { associationId: scope.associationId } : {}), ...(scope.clientAccountId ? { clientAccountId: scope.clientAccountId } : {}) }, orderBy: { promisedDate: 'desc' }, take: 100 }),
      this.prisma.revenueCollectionNote.findMany({ where: { ...(scope.associationId ? { associationId: scope.associationId } : {}), ...(scope.clientAccountId ? { clientAccountId: scope.clientAccountId } : {}) }, orderBy: { createdAt: 'desc' }, take: 50 }),
    ]);
    const invoiceRows = invoices as any[];
    return {
      client,
      subscription,
      summary: {
        totalIssued: invoiceRows.reduce((sum, invoice) => sum + invoice.totalAmount, 0),
        totalPaid: invoiceRows.reduce((sum, invoice) => sum + invoice.paidAmount, 0),
        outstandingBalance: invoiceRows.reduce((sum, invoice) => sum + invoice.balanceAmount, 0),
        overdueBalance: invoiceRows.filter((invoice) => invoice.balanceAmount > 0 && invoice.dueDate < new Date()).reduce((sum, invoice) => sum + invoice.balanceAmount, 0),
        estimatedMrr: subscription ? this.monthlyEquivalent(subscription.price, String(subscription.billingCycle)) : 0,
      },
      invoices: invoiceRows,
      cases,
      promises,
      notes,
    };
  }

  private async dueSoonInvoices() {
    return this.prisma.saasInvoice.findMany({ where: { balanceAmount: { gt: 0 }, status: { in: [SaasInvoiceStatus.ISSUED, SaasInvoiceStatus.PARTIALLY_PAID] }, dueDate: { gte: new Date(), lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } }, include: { association: { select: { id: true, name: true } } }, orderBy: { dueDate: 'asc' }, take: 10 });
  }

  private async ensureCase(id: string) {
    const collectionCase = await this.prisma.revenueCollectionCase.findUnique({ where: { id } });
    if (!collectionCase) throw new NotFoundException('Collection case not found');
    return collectionCase;
  }

  private async ensurePromise(id: string) {
    const promise = await this.prisma.paymentPromise.findUnique({ where: { id } });
    if (!promise) throw new NotFoundException('Promisiunea de plata nu a fost gasita.');
    return promise;
  }

  calculateAgingBucket(dueDate: Date | null, balanceAmount: number) {
    const days = this.daysOverdue(dueDate, balanceAmount);
    if (days <= 0) return RevenueAgingBucket.CURRENT;
    if (days <= 7) return RevenueAgingBucket.DAYS_1_7;
    if (days <= 15) return RevenueAgingBucket.DAYS_8_15;
    if (days <= 30) return RevenueAgingBucket.DAYS_16_30;
    if (days <= 60) return RevenueAgingBucket.DAYS_31_60;
    if (days <= 90) return RevenueAgingBucket.DAYS_61_90;
    return RevenueAgingBucket.DAYS_90_PLUS;
  }

  private daysOverdue(dueDate: Date | null, balanceAmount: number) {
    if (!dueDate || balanceAmount <= 0 || dueDate >= new Date()) return 0;
    return Math.floor((Date.now() - dueDate.getTime()) / (24 * 60 * 60 * 1000));
  }

  private priorityForDays(days: number) {
    if (days > 30) return RevenueCollectionPriority.URGENT;
    if (days > 15) return RevenueCollectionPriority.HIGH;
    return RevenueCollectionPriority.NORMAL;
  }

  private clientPriority(priority: RevenueCollectionPriority) {
    if (priority === RevenueCollectionPriority.URGENT) return ClientPriority.URGENT;
    if (priority === RevenueCollectionPriority.HIGH) return ClientPriority.HIGH;
    if (priority === RevenueCollectionPriority.LOW) return ClientPriority.LOW;
    return ClientPriority.NORMAL;
  }

  private monthlyEquivalent(price: number, billingCycle: string) {
    if (billingCycle === 'YEARLY') return Number(price || 0) / 12;
    return Number(price || 0);
  }

  private async event(collectionCase: any, actor: any, eventType: RevenueCollectionEventType, title: string, message: string, metadata?: unknown) {
    return this.prisma.revenueCollectionEvent.create({ data: { collectionCaseId: collectionCase.id, associationId: collectionCase.associationId, clientAccountId: collectionCase.clientAccountId || null, saasInvoiceId: collectionCase.saasInvoiceId || null, actorUserId: actor?.id || null, eventType, title, message, metadata: metadata as Prisma.InputJsonValue } });
  }
}
