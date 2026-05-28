import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ClientAccountStatus,
  ClientActivityType,
  ClientChecklistStatus,
  ClientContactStatus,
  ClientDecisionImpact,
  ClientDecisionStatus,
  ClientFileStorageProvider,
  ClientFollowUpSource,
  ClientFollowUpStatus,
  ClientKnowledgeCategory,
  ClientKnowledgeItemType,
  ClientKnowledgePriority,
  ClientKnowledgeStatus,
  ClientKnowledgeVisibility,
  ClientKnownIssueSeverity,
  ClientKnownIssueStatus,
  ClientLinkStatus,
  ClientLifecycleStage,
  ClientPriority,
  ClientReminderSource,
  ClientReminderStatus,
  ClientRiskLevel,
  ClientSource,
  ClientTaskCategory,
  ClientTaskSource,
  ClientTaskStatus,
  CustomerOnboardingRequestStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ClientRiskService } from './client-risk.service';
import {
  ArchiveClientKnowledgeDto,
  CancelClientTaskDto,
  CancelClientFollowUpDto,
  ChangeClientOwnerDto,
  ChangeClientPriorityDto,
  ChangeClientRiskDto,
  ChangeClientStageDto,
  ChangeClientStatusDto,
  CloseClientDto,
  CreateClientAccountDto,
  CreateClientChecklistDto,
  CreateClientContactDto,
  CreateClientDecisionDto,
  CreateClientFileDto,
  CreateClientFollowUpDto,
  CreateClientKnowledgeItemDto,
  CreateClientKnownIssueDto,
  CreateClientLinkDto,
  CreateClientNoteDto,
  CreateClientReminderDto,
  CreateClientTaskDto,
  LinkAssociationDto,
  ResolveClientKnownIssueDto,
  RescheduleClientFollowUpDto,
  RescheduleClientTaskDto,
  SnoozeClientReminderDto,
  UpdateClientAccountDto,
  UpdateClientChecklistDto,
  UpdateClientContactDto,
  UpdateClientDecisionDto,
  UpdateClientFileDto,
  UpdateClientFollowUpDto,
  UpdateClientKnowledgeItemDto,
  UpdateClientKnownIssueDto,
  UpdateClientLinkDto,
  UpdateClientNoteDto,
  UpdateClientTaskDto,
} from './dto/superadmin-clients.dto';

const STAGES = Object.values(ClientLifecycleStage);
const REQUIRED_REASON_STAGES = new Set<ClientLifecycleStage>([
  ClientLifecycleStage.ACTIVE,
  ClientLifecycleStage.SUSPENDED,
  ClientLifecycleStage.CHURNED,
  ClientLifecycleStage.CLOSED,
]);

const ALLOWED_RELATED_ENTITY_TYPES = new Set([
  'CLIENT_ACCOUNT',
  'ASSOCIATION',
  'CUSTOMER_REQUEST',
  'SAAS_SUBSCRIPTION',
  'SAAS_INVOICE',
  'UPGRADE_REQUEST',
  'SUPPORT_SESSION',
  'PLATFORM_SERVICE',
  'BACKUP_CHECK',
  'RECOVERY_DRILL',
  'PRODUCTION_INCIDENT',
  'SYSTEM_ERROR_EVENT',
  'LEGAL_DOCUMENT',
  'DATA_REQUEST',
  'CLIENT_TASK',
  'CLIENT_FOLLOW_UP',
  'DATA_EXPORT',
  'HELP_ARTICLE',
]);

const CALENDAR_EVENT_TYPE = {
  TASK_DUE: 'TASK_DUE',
  FOLLOW_UP_DUE: 'FOLLOW_UP_DUE',
  REMINDER: 'REMINDER',
  SAAS_INVOICE_DUE: 'SAAS_INVOICE_DUE',
  PLATFORM_SERVICE_PAYMENT_DUE: 'PLATFORM_SERVICE_PAYMENT_DUE',
  RECOVERY_DRILL_PLANNED: 'RECOVERY_DRILL_PLANNED',
} as const;

@Injectable()
export class SuperadminClientsService {
  constructor(private readonly prisma: PrismaService, private readonly risk: ClientRiskService) {}

  async list(query: Record<string, string | undefined>) {
    await this.ensureDerivedClientAccounts();
    const where = this.buildWhere(query);
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 40)));
    const [items, total] = await Promise.all([
      this.prisma.clientAccount.findMany({ where, orderBy: this.orderBy(query.sort), skip: (page - 1) * limit, take: limit }),
      this.prisma.clientAccount.count({ where }),
    ]);
    return { items: await this.decorateClients(items), meta: { page, limit, total } };
  }

  async pipeline() {
    await this.ensureDerivedClientAccounts();
    const items = await this.prisma.clientAccount.findMany({ orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }] });
    const decorated = await this.decorateClients(items);
    return {
      columns: STAGES.map((stage) => ({
        stage,
        label: this.stageLabel(stage),
        items: decorated.filter((item) => item.lifecycleStage === stage),
      })),
    };
  }

  async stats() {
    await this.ensureDerivedClientAccounts();
    const now = new Date();
    const startWeek = new Date(now);
    startWeek.setDate(now.getDate() - 7);
    const values = await Promise.all([
      ...STAGES.map((stage) => this.prisma.clientAccount.count({ where: { lifecycleStage: stage } })),
      this.prisma.clientTask.count({ where: { status: { in: [ClientTaskStatus.OPEN, ClientTaskStatus.IN_PROGRESS] } } }),
      this.prisma.clientTask.count({ where: { status: { in: [ClientTaskStatus.OPEN, ClientTaskStatus.IN_PROGRESS] }, dueAt: { lt: now } } }),
      this.prisma.clientFollowUp.count({ where: { status: ClientFollowUpStatus.OPEN, dueAt: { lt: now } } }),
      this.prisma.clientAccount.count({ where: { riskLevel: { in: [ClientRiskLevel.HIGH, ClientRiskLevel.CRITICAL] } } }),
      this.prisma.clientTask.count({ where: { status: ClientTaskStatus.COMPLETED, completedAt: { gte: startWeek } } }),
    ]);
    const byStage = Object.fromEntries(STAGES.map((stage, index) => [stage, values[index] as number]));
    return {
      byStage,
      openTasks: values[STAGES.length],
      overdueTasks: values[STAGES.length + 1],
      overdueFollowUps: values[STAGES.length + 2],
      atRisk: values[STAGES.length + 3],
      completedThisWeek: values[STAGES.length + 4],
    };
  }

  async create(dto: CreateClientAccountDto, actor: any) {
    const client = await this.prisma.clientAccount.create({
      data: {
        displayName: dto.displayName.trim(),
        associationId: dto.associationId || null,
        customerRequestId: dto.customerRequestId || null,
        lifecycleStage: dto.lifecycleStage || ClientLifecycleStage.NEW_REQUEST,
        status: dto.status || ClientAccountStatus.OPEN,
        priority: dto.priority || ClientPriority.NORMAL,
        source: dto.source || ClientSource.MANUAL,
        contactName: dto.contactName || null,
        contactPhone: dto.contactPhone || null,
        contactEmail: dto.contactEmail || null,
        associationName: dto.associationName || dto.displayName,
        associationCode: dto.associationCode || null,
        apartmentsCount: dto.apartmentsCount == null ? null : Number(dto.apartmentsCount),
        address: dto.address || null,
        ownerUserId: dto.ownerUserId || null,
        nextFollowUpAt: dto.nextFollowUpAt ? new Date(dto.nextFollowUpAt) : null,
        internalNotes: dto.internalNotes || null,
        createdById: actor?.id || null,
      },
    });
    await this.activity(client.id, actor?.id, ClientActivityType.CLIENT_CREATED, 'Client creat', `${client.displayName} a fost adaugat in pipeline.`);
    return this.get(client.id);
  }

  async get(id: string) {
    const client = await this.prisma.clientAccount.findUnique({
      where: { id },
      include: {
        tasks: { orderBy: { createdAt: 'desc' }, take: 8 },
        notes: { orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }], take: 8 },
        followUps: { orderBy: { dueAt: 'asc' }, take: 8 },
        activities: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!client) throw new NotFoundException('Client account not found');
    const [association, customerRequest, subscription, invoices, risk, counts] = await Promise.all([
      client.associationId ? this.prisma.organization.findUnique({ where: { id: client.associationId }, select: { id: true, name: true, legalName: true, fiscalCode: true, status: true, onboardingStatus: true, onboardingCompleted: true, createdAt: true } }) : null,
      client.customerRequestId ? this.prisma.customerOnboardingRequest.findUnique({ where: { id: client.customerRequestId } }) : null,
      client.associationId ? this.prisma.saasSubscription.findFirst({ where: { associationId: client.associationId }, include: { plan: true }, orderBy: { updatedAt: 'desc' } }) : null,
      client.associationId ? this.prisma.saasInvoice.aggregate({ where: { associationId: client.associationId }, _sum: { totalAmount: true, paidAmount: true, balanceAmount: true }, _count: true }) : null,
      this.risk.calculateRisk(client.id),
      this.countClientEntities(client.id, client.associationId),
    ]);
    return { client, association, customerRequest, subscription, saasBilling: invoices, tasksSummary: counts.tasks, followUpsSummary: counts.followUps, riskReasons: risk.reasons, riskScore: risk.score };
  }

  async update(id: string, dto: UpdateClientAccountDto, actor: any) {
    await this.ensureClient(id);
    const client = await this.prisma.clientAccount.update({
      where: { id },
      data: {
        displayName: dto.displayName?.trim(),
        contactName: dto.contactName,
        contactPhone: dto.contactPhone,
        contactEmail: dto.contactEmail,
        associationName: dto.associationName,
        associationCode: dto.associationCode,
        apartmentsCount: dto.apartmentsCount == null ? undefined : Number(dto.apartmentsCount),
        address: dto.address,
        ownerUserId: dto.ownerUserId,
        nextFollowUpAt: dto.nextFollowUpAt ? new Date(dto.nextFollowUpAt) : undefined,
        internalNotes: dto.internalNotes,
        updatedById: actor?.id || null,
      },
    });
    return client;
  }

  async changeStage(id: string, dto: ChangeClientStageDto, actor: any) {
    if (REQUIRED_REASON_STAGES.has(dto.stage) && !dto.reason?.trim()) throw new BadRequestException('Motivul este obligatoriu pentru aceasta etapa.');
    const old = await this.ensureClient(id);
    const now = new Date();
    const client = await this.prisma.clientAccount.update({
      where: { id },
      data: {
        lifecycleStage: dto.stage,
        status: this.statusForStage(dto.stage),
        lastContactedAt: dto.stage === ClientLifecycleStage.CONTACTED ? now : undefined,
        qualifiedAt: dto.stage === ClientLifecycleStage.QUALIFIED ? now : undefined,
        onboardingStartedAt: dto.stage === ClientLifecycleStage.ONBOARDING ? now : undefined,
        activatedAt: dto.stage === ClientLifecycleStage.ACTIVE ? now : undefined,
        suspendedAt: dto.stage === ClientLifecycleStage.SUSPENDED ? now : undefined,
        churnedAt: dto.stage === ClientLifecycleStage.CHURNED ? now : undefined,
        closedAt: dto.stage === ClientLifecycleStage.CLOSED ? now : undefined,
        closeReason: dto.stage === ClientLifecycleStage.CLOSED || dto.stage === ClientLifecycleStage.CHURNED ? dto.reason : undefined,
        updatedById: actor?.id || null,
      },
    });
    await this.activity(id, actor?.id, ClientActivityType.STAGE_CHANGED, 'Etapa schimbata', `${old.lifecycleStage} -> ${dto.stage}`, { oldStage: old.lifecycleStage, newStage: dto.stage, reason: dto.reason });
    await this.syncCustomerRequest(client);
    await this.risk.updateClientRisk(id).catch(() => undefined);
    return this.get(id);
  }

  async changeStatus(id: string, dto: ChangeClientStatusDto, actor: any) {
    const old = await this.ensureClient(id);
    const client = await this.prisma.clientAccount.update({ where: { id }, data: { status: dto.status, updatedById: actor?.id || null } });
    await this.activity(id, actor?.id, ClientActivityType.STATUS_CHANGED, 'Status schimbat', `${old.status} -> ${dto.status}`, { reason: dto.reason });
    return client;
  }

  async changePriority(id: string, dto: ChangeClientPriorityDto, actor: any) {
    const old = await this.ensureClient(id);
    const client = await this.prisma.clientAccount.update({ where: { id }, data: { priority: dto.priority, updatedById: actor?.id || null } });
    await this.activity(id, actor?.id, ClientActivityType.PRIORITY_CHANGED, 'Prioritate schimbata', `${old.priority} -> ${dto.priority}`);
    return client;
  }

  async changeOwner(id: string, dto: ChangeClientOwnerDto, actor: any) {
    const old = await this.ensureClient(id);
    const client = await this.prisma.clientAccount.update({ where: { id }, data: { ownerUserId: dto.ownerUserId || null, updatedById: actor?.id || null } });
    await this.activity(id, actor?.id, ClientActivityType.OWNER_CHANGED, 'Responsabil schimbat', `${old.ownerUserId || 'neatribuit'} -> ${dto.ownerUserId || 'neatribuit'}`);
    return client;
  }

  async changeRisk(id: string, dto: ChangeClientRiskDto, actor: any) {
    if (dto.recalculate) {
      const risk = await this.risk.updateClientRisk(id);
      await this.activity(id, actor?.id, ClientActivityType.RISK_UPDATED, 'Risc recalculat', `Risk level: ${risk.level}`, { reasons: risk.reasons });
      return this.get(id);
    }
    const client = await this.prisma.clientAccount.update({ where: { id }, data: { riskLevel: dto.riskLevel || ClientRiskLevel.NONE, updatedById: actor?.id || null } });
    await this.activity(id, actor?.id, ClientActivityType.RISK_UPDATED, 'Risc actualizat', `Risk level: ${client.riskLevel}`, { reason: dto.reason });
    return client;
  }

  async close(id: string, dto: CloseClientDto, actor: any) {
    return this.changeStage(id, { stage: ClientLifecycleStage.CLOSED, reason: dto.reason }, actor);
  }

  async reopen(id: string, actor: any) {
    const client = await this.prisma.clientAccount.update({ where: { id }, data: { lifecycleStage: ClientLifecycleStage.AT_RISK, status: ClientAccountStatus.OPEN, closedAt: null, closeReason: null, updatedById: actor?.id || null } });
    await this.activity(id, actor?.id, ClientActivityType.CLIENT_REOPENED, 'Client redeschis', `${client.displayName} a fost redeschis.`);
    return this.get(id);
  }

  async fromCustomerRequest(requestId: string, actor: any) {
    const existing = await this.prisma.clientAccount.findFirst({ where: { customerRequestId: requestId } });
    if (existing) return this.get(existing.id);
    const request = await this.prisma.customerOnboardingRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Customer request not found');
    return this.create({
      displayName: request.associationName,
      customerRequestId: request.id,
      lifecycleStage: this.stageFromRequestStatus(request.status),
      source: request.source === 'ACCESS_REQUEST' ? ClientSource.ACCESS_REQUEST : request.source === 'REFERRAL' ? ClientSource.REFERRAL : ClientSource.PUBLIC_WEBSITE,
      priority: request.priority === 'HIGH' ? ClientPriority.HIGH : request.priority === 'LOW' ? ClientPriority.LOW : ClientPriority.NORMAL,
      contactName: request.fullName,
      contactPhone: request.phone,
      contactEmail: request.email || undefined,
      associationName: request.associationName,
      associationCode: request.associationCode || undefined,
      apartmentsCount: request.apartmentsCount || undefined,
      address: request.address || undefined,
      ownerUserId: request.assignedToId || undefined,
    }, actor);
  }

  async linkAssociation(id: string, dto: LinkAssociationDto, actor: any) {
    const association = await this.prisma.organization.findUnique({ where: { id: dto.associationId } });
    if (!association) throw new NotFoundException('Association not found');
    const client = await this.prisma.clientAccount.update({ where: { id }, data: { associationId: association.id, associationName: association.name, associationCode: association.fiscalCode, updatedById: actor?.id || null } });
    if (client.customerRequestId) {
      await this.prisma.customerOnboardingRequest.update({ where: { id: client.customerRequestId }, data: { convertedAssociationId: association.id } }).catch(() => undefined);
    }
    await this.activity(id, actor?.id, ClientActivityType.ASSOCIATION_LINKED, 'Asociatie legata', `Clientul a fost legat de ${association.name}.`, { associationId: association.id });
    return this.get(id);
  }

  createAssociationPlaceholder() {
    return { ok: false, message: 'Conversia automata va fi disponibila ulterior. Creeaza asociatia explicit si leag-o de client.' };
  }

  async listTasks(query: Record<string, string | undefined>) {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const search = query.search?.trim();
    const where: Prisma.ClientTaskWhereInput = {
      ...(query.status ? { status: query.status as ClientTaskStatus } : {}),
      ...(query.priority ? { priority: query.priority as ClientPriority } : {}),
      ...(query.category ? { category: query.category as ClientTaskCategory } : {}),
      ...(query.source ? { source: query.source as ClientTaskSource } : {}),
      ...(query.assignedToId ? { assignedToId: query.assignedToId } : {}),
      ...(query.clientAccountId ? { clientAccountId: query.clientAccountId } : {}),
      ...(query.overdue === 'true' || query.overdueOnly === 'true' ? { status: { in: [ClientTaskStatus.OPEN, ClientTaskStatus.IN_PROGRESS] }, dueAt: { lt: now } } : {}),
      ...(query.dueToday === 'true' ? { dueAt: { gte: todayStart, lt: tomorrow } } : {}),
      ...(search ? { OR: [{ title: { contains: search, mode: 'insensitive' } }, { description: { contains: search, mode: 'insensitive' } }] } : {}),
    };
    return { items: await this.prisma.clientTask.findMany({ where, include: { clientAccount: { select: { id: true, displayName: true, associationName: true, contactName: true } } }, orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }], take: 200 }) };
  }

  async clientTasks(id: string) {
    await this.ensureClient(id);
    return { items: await this.prisma.clientTask.findMany({ where: { clientAccountId: id }, orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }] }) };
  }

  async createTaskGlobal(dto: CreateClientTaskDto, actor: any) {
    if (!dto.clientAccountId) throw new BadRequestException('clientAccountId este obligatoriu.');
    return this.createTask(dto.clientAccountId, dto, actor);
  }

  async createTask(id: string, dto: CreateClientTaskDto, actor: any) {
    this.assertRelatedEntity(dto.relatedEntityType);
    this.assertReminderBeforeDue(dto.reminderAt, dto.dueAt);
    const client = await this.ensureClient(id);
    const task = await this.prisma.clientTask.create({ data: {
      clientAccountId: id,
      associationId: client.associationId,
      title: this.sanitizeText(dto.title),
      description: dto.description ? this.sanitizeText(dto.description) : null,
      priority: dto.priority || ClientPriority.NORMAL,
      category: dto.category || ClientTaskCategory.GENERAL,
      dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
      reminderAt: dto.reminderAt ? new Date(dto.reminderAt) : null,
      assignedToId: dto.assignedToId || null,
      createdById: actor?.id || null,
      source: dto.source || ClientTaskSource.MANUAL,
      relatedEntityType: dto.relatedEntityType || null,
      relatedEntityId: dto.relatedEntityId || null,
    } });
    await this.createReminderForTask(task, actor);
    await this.activity(id, actor?.id, ClientActivityType.TASK_CREATED, 'Task creat', task.title, { taskId: task.id });
    return task;
  }

  async getTask(taskId: string) {
    const task = await this.prisma.clientTask.findUnique({ where: { id: taskId }, include: { clientAccount: true } });
    if (!task) throw new NotFoundException('Client task not found');
    return task;
  }

  async updateTask(taskId: string, dto: UpdateClientTaskDto, actor: any) {
    this.assertRelatedEntity(dto.relatedEntityType);
    this.assertReminderBeforeDue(dto.reminderAt, dto.dueAt);
    const task = await this.prisma.clientTask.update({ where: { id: taskId }, data: {
      title: dto.title ? this.sanitizeText(dto.title) : undefined,
      description: dto.description ? this.sanitizeText(dto.description) : dto.description,
      status: dto.status,
      priority: dto.priority,
      category: dto.category,
      dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
      reminderAt: dto.reminderAt ? new Date(dto.reminderAt) : undefined,
      assignedToId: dto.assignedToId,
      source: dto.source,
      relatedEntityType: dto.relatedEntityType,
      relatedEntityId: dto.relatedEntityId,
    } });
    await this.createReminderForTask(task, actor);
    await this.activity(task.clientAccountId, actor?.id, ClientActivityType.TASK_CREATED, 'Task actualizat', task.title, { taskId });
    return task;
  }

  async startTask(taskId: string, actor: any) {
    const task = await this.prisma.clientTask.update({ where: { id: taskId }, data: { status: ClientTaskStatus.IN_PROGRESS } });
    await this.activity(task.clientAccountId, actor?.id, ClientActivityType.TASK_CREATED, 'Task pornit', task.title, { taskId });
    return task;
  }

  async completeTask(taskId: string, actor: any) {
    const task = await this.prisma.clientTask.update({ where: { id: taskId }, data: { status: ClientTaskStatus.COMPLETED, completedAt: new Date(), completedById: actor?.id || null } });
    await this.prisma.clientReminder.updateMany({ where: { taskId, status: { in: [ClientReminderStatus.SCHEDULED, ClientReminderStatus.DUE, ClientReminderStatus.SNOOZED] } }, data: { status: ClientReminderStatus.COMPLETED, completedAt: new Date(), completedById: actor?.id || null } });
    await this.activity(task.clientAccountId, actor?.id, ClientActivityType.TASK_COMPLETED, 'Task finalizat', task.title, { taskId });
    return task;
  }

  async cancelTask(taskId: string, dto: CancelClientTaskDto, actor: any) {
    const task = await this.prisma.clientTask.update({ where: { id: taskId }, data: { status: ClientTaskStatus.CANCELLED, cancelledAt: new Date(), cancelledById: actor?.id || null, cancellationReason: dto.reason } });
    await this.prisma.clientReminder.updateMany({ where: { taskId, status: { in: [ClientReminderStatus.SCHEDULED, ClientReminderStatus.DUE, ClientReminderStatus.SNOOZED] } }, data: { status: ClientReminderStatus.CANCELLED } });
    return task;
  }

  async rescheduleTask(taskId: string, dto: RescheduleClientTaskDto, actor: any) {
    this.assertReminderBeforeDue(dto.reminderAt, dto.dueAt);
    const task = await this.prisma.clientTask.update({ where: { id: taskId }, data: { dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined, reminderAt: dto.reminderAt ? new Date(dto.reminderAt) : undefined } });
    await this.createReminderForTask(task, actor);
    await this.activity(task.clientAccountId, actor?.id, ClientActivityType.TASK_CREATED, 'Task reprogramat', task.title, { taskId, dueAt: task.dueAt, reminderAt: task.reminderAt });
    return task;
  }

  async followUps(query: Record<string, string | undefined>) {
    const now = new Date();
    const week = new Date(now);
    week.setDate(now.getDate() + 7);
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const search = query.search?.trim();
    const where: Prisma.ClientFollowUpWhereInput = {
      ...(query.status ? { status: query.status as ClientFollowUpStatus } : {}),
      ...(query.priority ? { priority: query.priority as ClientPriority } : {}),
      ...(query.source ? { source: query.source as ClientFollowUpSource } : {}),
      ...(query.assignedToId ? { assignedToId: query.assignedToId } : {}),
      ...(query.clientAccountId ? { clientAccountId: query.clientAccountId } : {}),
      ...(query.overdue === 'true' ? { status: ClientFollowUpStatus.OPEN, dueAt: { lt: now } } : {}),
      ...(query.upcoming === 'true' ? { status: ClientFollowUpStatus.OPEN, dueAt: { gte: now, lte: week } } : {}),
      ...(query.dueToday === 'true' ? { dueAt: { gte: todayStart, lt: tomorrow } } : {}),
      ...(search ? { OR: [{ title: { contains: search, mode: 'insensitive' } }, { description: { contains: search, mode: 'insensitive' } }] } : {}),
    };
    return { items: await this.prisma.clientFollowUp.findMany({ where, include: { clientAccount: { select: { id: true, displayName: true, contactName: true, contactPhone: true, contactEmail: true } } }, orderBy: { dueAt: 'asc' }, take: 200 }) };
  }

  async createFollowUpGlobal(dto: CreateClientFollowUpDto, actor: any) {
    if (!dto.clientAccountId) throw new BadRequestException('clientAccountId este obligatoriu.');
    return this.createFollowUp(dto.clientAccountId, dto, actor);
  }

  async clientFollowUps(id: string) {
    await this.ensureClient(id);
    return { items: await this.prisma.clientFollowUp.findMany({ where: { clientAccountId: id }, orderBy: { dueAt: 'asc' } }) };
  }

  async createFollowUp(id: string, dto: CreateClientFollowUpDto, actor: any) {
    this.assertRelatedEntity(dto.relatedEntityType);
    this.assertReminderBeforeDue(dto.reminderAt, dto.dueAt);
    const client = await this.ensureClient(id);
    const dueAt = new Date(dto.dueAt);
    const followUp = await this.prisma.clientFollowUp.create({ data: {
      clientAccountId: id,
      associationId: client.associationId,
      title: this.sanitizeText(dto.title),
      description: dto.description ? this.sanitizeText(dto.description) : null,
      dueAt,
      reminderAt: dto.reminderAt ? new Date(dto.reminderAt) : null,
      priority: dto.priority || ClientPriority.NORMAL,
      assignedToId: dto.assignedToId || null,
      createdById: actor?.id || null,
      source: dto.source || ClientFollowUpSource.MANUAL,
      relatedEntityType: dto.relatedEntityType || null,
      relatedEntityId: dto.relatedEntityId || null,
    } });
    await this.prisma.clientAccount.update({ where: { id }, data: { nextFollowUpAt: dueAt } });
    await this.createReminderForFollowUp(followUp, actor);
    await this.activity(id, actor?.id, ClientActivityType.FOLLOW_UP_SET, 'Follow-up setat', `${dto.title} - ${dueAt.toISOString().slice(0, 10)}`, { followUpId: followUp.id });
    return followUp;
  }

  async updateFollowUp(followUpId: string, dto: UpdateClientFollowUpDto) {
    this.assertRelatedEntity(dto.relatedEntityType);
    this.assertReminderBeforeDue(dto.reminderAt, dto.dueAt);
    const followUp = await this.prisma.clientFollowUp.update({ where: { id: followUpId }, data: {
      title: dto.title ? this.sanitizeText(dto.title) : undefined,
      description: dto.description ? this.sanitizeText(dto.description) : dto.description,
      dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
      reminderAt: dto.reminderAt ? new Date(dto.reminderAt) : undefined,
      status: dto.status,
      priority: dto.priority,
      assignedToId: dto.assignedToId,
      source: dto.source,
      relatedEntityType: dto.relatedEntityType,
      relatedEntityId: dto.relatedEntityId,
    } });
    await this.createReminderForFollowUp(followUp, null);
    return followUp;
  }

  async getFollowUp(followUpId: string) {
    const followUp = await this.prisma.clientFollowUp.findUnique({ where: { id: followUpId }, include: { clientAccount: true } });
    if (!followUp) throw new NotFoundException('Client follow-up not found');
    return followUp;
  }

  async doneFollowUp(followUpId: string, actor: any) {
    const followUp = await this.prisma.clientFollowUp.update({ where: { id: followUpId }, data: { status: ClientFollowUpStatus.DONE, completedAt: new Date(), completedById: actor?.id || null } });
    await this.prisma.clientReminder.updateMany({ where: { followUpId, status: { in: [ClientReminderStatus.SCHEDULED, ClientReminderStatus.DUE, ClientReminderStatus.SNOOZED] } }, data: { status: ClientReminderStatus.COMPLETED, completedAt: new Date(), completedById: actor?.id || null } });
    await this.activity(followUp.clientAccountId, actor?.id, ClientActivityType.TASK_COMPLETED, 'Follow-up finalizat', followUp.title, { followUpId });
    return followUp;
  }

  async cancelFollowUp(followUpId: string, dto?: CancelClientFollowUpDto, actor?: any) {
    const followUp = await this.prisma.clientFollowUp.update({ where: { id: followUpId }, data: { status: ClientFollowUpStatus.CANCELLED, cancelledAt: new Date(), cancelledById: actor?.id || null, cancellationReason: dto?.reason || null } });
    await this.prisma.clientReminder.updateMany({ where: { followUpId, status: { in: [ClientReminderStatus.SCHEDULED, ClientReminderStatus.DUE, ClientReminderStatus.SNOOZED] } }, data: { status: ClientReminderStatus.CANCELLED } });
    return followUp;
  }

  async rescheduleFollowUp(followUpId: string, dto: RescheduleClientFollowUpDto, actor: any) {
    this.assertReminderBeforeDue(dto.reminderAt, dto.dueAt);
    const followUp = await this.prisma.clientFollowUp.update({ where: { id: followUpId }, data: { dueAt: new Date(dto.dueAt), reminderAt: dto.reminderAt ? new Date(dto.reminderAt) : undefined } });
    await this.prisma.clientAccount.update({ where: { id: followUp.clientAccountId }, data: { nextFollowUpAt: followUp.dueAt } }).catch(() => undefined);
    await this.createReminderForFollowUp(followUp, actor);
    await this.activity(followUp.clientAccountId, actor?.id, ClientActivityType.FOLLOW_UP_SET, 'Follow-up reprogramat', followUp.title, { followUpId, dueAt: followUp.dueAt, reminderAt: followUp.reminderAt });
    return followUp;
  }

  async listReminders(query: Record<string, string | undefined>) {
    const now = new Date();
    const search = query.search?.trim();
    const activeStatuses = [ClientReminderStatus.SCHEDULED, ClientReminderStatus.DUE, ClientReminderStatus.SNOOZED];
    const where: Prisma.ClientReminderWhereInput = {
      ...(query.status ? { status: query.status as ClientReminderStatus } : {}),
      ...(query.priority ? { priority: query.priority as ClientPriority } : {}),
      ...(query.source ? { source: query.source as ClientReminderSource } : {}),
      ...(query.assignedToId ? { assignedToId: query.assignedToId } : {}),
      ...(query.clientAccountId ? { clientAccountId: query.clientAccountId } : {}),
      ...(query.due === 'true' ? { status: { in: activeStatuses }, OR: [{ remindAt: { lte: now } }, { snoozedUntil: { lte: now } }] } : {}),
      ...(search ? { OR: [{ title: { contains: search, mode: 'insensitive' } }, { message: { contains: search, mode: 'insensitive' } }] } : {}),
    };
    const items = await this.prisma.clientReminder.findMany({ where, include: { clientAccount: { select: { id: true, displayName: true, associationName: true } } }, orderBy: [{ remindAt: 'asc' }, { createdAt: 'desc' }], take: 200 });
    return { items: items.map((item) => this.decorateReminderStatus(item, now)) };
  }

  async createReminder(dto: CreateClientReminderDto, actor: any) {
    this.assertRelatedEntity(dto.relatedEntityType);
    let client: any = null;
    if (dto.clientAccountId) client = await this.ensureClient(dto.clientAccountId);
    const reminder = await this.prisma.clientReminder.create({ data: {
      clientAccountId: dto.clientAccountId || null,
      associationId: dto.associationId || client?.associationId || null,
      taskId: dto.taskId || null,
      followUpId: dto.followUpId || null,
      title: this.sanitizeText(dto.title),
      message: dto.message ? this.sanitizeText(dto.message) : null,
      priority: dto.priority || ClientPriority.NORMAL,
      remindAt: new Date(dto.remindAt),
      assignedToId: dto.assignedToId || null,
      createdById: actor?.id || null,
      source: dto.source || ClientReminderSource.MANUAL,
      relatedEntityType: dto.relatedEntityType || null,
      relatedEntityId: dto.relatedEntityId || null,
    } });
    if (reminder.clientAccountId) await this.activity(reminder.clientAccountId, actor?.id, ClientActivityType.FOLLOW_UP_SET, 'Reminder creat', reminder.title, { reminderId: reminder.id });
    return reminder;
  }

  async getReminder(reminderId: string) {
    const reminder = await this.prisma.clientReminder.findUnique({ where: { id: reminderId }, include: { clientAccount: true } });
    if (!reminder) throw new NotFoundException('Client reminder not found');
    return this.decorateReminderStatus(reminder, new Date());
  }

  async completeReminder(reminderId: string, actor: any) {
    return this.prisma.clientReminder.update({ where: { id: reminderId }, data: { status: ClientReminderStatus.COMPLETED, completedAt: new Date(), completedById: actor?.id || null } });
  }

  async snoozeReminder(reminderId: string, dto: SnoozeClientReminderDto) {
    return this.prisma.clientReminder.update({ where: { id: reminderId }, data: { status: ClientReminderStatus.SNOOZED, snoozedUntil: new Date(dto.snoozedUntil) } });
  }

  async dismissReminder(reminderId: string, actor: any) {
    return this.prisma.clientReminder.update({ where: { id: reminderId }, data: { status: ClientReminderStatus.DISMISSED, dismissedAt: new Date(), dismissedById: actor?.id || null } });
  }

  async cancelReminder(reminderId: string) {
    return this.prisma.clientReminder.update({ where: { id: reminderId }, data: { status: ClientReminderStatus.CANCELLED } });
  }

  async knowledgeOverview(id: string) {
    const client = await this.ensureClient(id);
    const active = ClientKnowledgeStatus.ACTIVE;
    const [notes, pinnedNotesCount, files, contacts, decisions, openIssues, checklists, pinnedNotes, primaryContacts, recentDecisions, recentFiles, recentLinks, issues, last] = await Promise.all([
      this.prisma.clientKnowledgeItem.count({ where: { clientAccountId: id, type: ClientKnowledgeItemType.NOTE, status: active } }),
      this.prisma.clientKnowledgeItem.count({ where: { clientAccountId: id, isPinned: true, status: active } }),
      this.prisma.clientFile.count({ where: { clientAccountId: id, status: active } }),
      this.prisma.clientContact.count({ where: { clientAccountId: id, status: ClientContactStatus.ACTIVE } }),
      this.prisma.clientDecision.count({ where: { clientAccountId: id, status: ClientDecisionStatus.ACTIVE } }),
      this.prisma.clientKnownIssue.count({ where: { clientAccountId: id, status: { in: [ClientKnownIssueStatus.OPEN, ClientKnownIssueStatus.IN_PROGRESS] } } }),
      this.prisma.clientChecklist.count({ where: { clientAccountId: id, status: { in: [ClientChecklistStatus.ACTIVE, ClientChecklistStatus.COMPLETED] } } }),
      this.prisma.clientKnowledgeItem.findMany({ where: { clientAccountId: id, isPinned: true, status: active }, orderBy: { updatedAt: 'desc' }, take: 5 }),
      this.prisma.clientContact.findMany({ where: { clientAccountId: id, isPrimary: true, status: ClientContactStatus.ACTIVE }, orderBy: { updatedAt: 'desc' }, take: 5 }),
      this.prisma.clientDecision.findMany({ where: { clientAccountId: id, status: ClientDecisionStatus.ACTIVE }, orderBy: { decisionDate: 'desc' }, take: 5 }),
      this.prisma.clientFile.findMany({ where: { clientAccountId: id, status: active }, orderBy: { uploadedAt: 'desc' }, take: 5 }),
      this.prisma.clientLink.findMany({ where: { clientAccountId: id, status: ClientLinkStatus.ACTIVE }, orderBy: { updatedAt: 'desc' }, take: 5 }),
      this.prisma.clientKnownIssue.findMany({ where: { clientAccountId: id, status: { in: [ClientKnownIssueStatus.OPEN, ClientKnownIssueStatus.IN_PROGRESS] } }, orderBy: [{ severity: 'desc' }, { updatedAt: 'desc' }], take: 5 }),
      this.prisma.clientKnowledgeItem.findFirst({ where: { clientAccountId: id }, orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
    ]);
    return {
      client,
      summary: { notes, pinnedNotes: pinnedNotesCount, files, contacts, decisions, openIssues, checklists, lastUpdatedAt: last?.updatedAt || null },
      pinnedNotes,
      primaryContacts,
      openIssues: issues,
      recentDecisions,
      recentFiles,
      recentLinks,
      storage: { directUploadEnabled: false, message: 'Upload direct va fi disponibil dupa configurarea storage-ului. Poti salva linkuri/document references.' },
    };
  }

  async clientKnowledgeSearch(id: string, query: Record<string, string | undefined>) {
    await this.ensureClient(id);
    return this.listKnowledge({ ...query, clientAccountId: id });
  }

  async listKnowledge(query: Record<string, string | undefined>) {
    const search = query.search || query.q;
    const where: Prisma.ClientKnowledgeItemWhereInput = {
      ...(query.clientAccountId ? { clientAccountId: query.clientAccountId } : {}),
      ...(query.associationId ? { associationId: query.associationId } : {}),
      ...(query.type ? { type: query.type as ClientKnowledgeItemType } : {}),
      ...(query.category ? { category: query.category as ClientKnowledgeCategory } : {}),
      ...(query.priority ? { priority: query.priority as ClientKnowledgePriority } : {}),
      ...(query.status ? { status: query.status as ClientKnowledgeStatus } : { status: ClientKnowledgeStatus.ACTIVE }),
      ...(search ? { OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
        { summary: { contains: search, mode: 'insensitive' } },
      ] } : {}),
    };
    const items = await this.prisma.clientKnowledgeItem.findMany({ where, include: { clientAccount: { select: { id: true, displayName: true, associationName: true } } }, orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }], take: 200 });
    return { items };
  }

  async globalFiles(query: Record<string, string | undefined>) {
    const search = query.search || query.q;
    const items = await this.prisma.clientFile.findMany({
      where: {
        ...(query.clientAccountId ? { clientAccountId: query.clientAccountId } : {}),
        ...(query.category ? { category: query.category as ClientKnowledgeCategory } : {}),
        ...(query.status ? { status: query.status as ClientKnowledgeStatus } : { status: ClientKnowledgeStatus.ACTIVE }),
        ...(search ? { OR: [{ fileName: { contains: search, mode: 'insensitive' } }, { originalFileName: { contains: search, mode: 'insensitive' } }, { description: { contains: search, mode: 'insensitive' } }] } : {}),
      },
      include: { clientAccount: { select: { id: true, displayName: true, associationName: true } } },
      orderBy: { uploadedAt: 'desc' },
      take: 200,
    });
    return { items, uploadEnabled: false };
  }

  async globalDecisions(query: Record<string, string | undefined>) {
    const search = query.search || query.q;
    const items = await this.prisma.clientDecision.findMany({
      where: {
        ...(query.clientAccountId ? { clientAccountId: query.clientAccountId } : {}),
        ...(query.status ? { status: query.status as ClientDecisionStatus } : { status: { not: ClientDecisionStatus.ARCHIVED } }),
        ...(query.category ? { category: query.category as ClientKnowledgeCategory } : {}),
        ...(search ? { OR: [{ title: { contains: search, mode: 'insensitive' } }, { description: { contains: search, mode: 'insensitive' } }, { decidedBy: { contains: search, mode: 'insensitive' } }] } : {}),
      },
      include: { clientAccount: { select: { id: true, displayName: true, associationName: true } } },
      orderBy: { decisionDate: 'desc' },
      take: 200,
    });
    return { items };
  }

  async globalKnownIssues(query: Record<string, string | undefined>) {
    const search = query.search || query.q;
    const items = await this.prisma.clientKnownIssue.findMany({
      where: {
        ...(query.clientAccountId ? { clientAccountId: query.clientAccountId } : {}),
        ...(query.status ? { status: query.status as ClientKnownIssueStatus } : { status: { not: ClientKnownIssueStatus.ARCHIVED } }),
        ...(query.severity ? { severity: query.severity as ClientKnownIssueSeverity } : {}),
        ...(query.category ? { category: query.category as ClientKnowledgeCategory } : {}),
        ...(search ? { OR: [{ title: { contains: search, mode: 'insensitive' } }, { description: { contains: search, mode: 'insensitive' } }, { workaround: { contains: search, mode: 'insensitive' } }] } : {}),
      },
      include: { clientAccount: { select: { id: true, displayName: true, associationName: true } } },
      orderBy: [{ severity: 'desc' }, { updatedAt: 'desc' }],
      take: 200,
    });
    return { items };
  }

  async createKnowledgeItem(id: string, dto: CreateClientKnowledgeItemDto, actor: any, forcedType?: ClientKnowledgeItemType) {
    this.assertRelatedEntity(dto.relatedEntityType);
    this.assertNoSecrets([dto.title, dto.content, dto.summary, dto.tags].filter(Boolean).join(' '));
    const client = await this.ensureClient(id);
    const item = await this.prisma.clientKnowledgeItem.create({ data: {
      clientAccountId: id,
      associationId: client.associationId,
      type: forcedType || dto.type || ClientKnowledgeItemType.NOTE,
      category: dto.category || ClientKnowledgeCategory.GENERAL,
      visibility: dto.visibility || ClientKnowledgeVisibility.INTERNAL_SUPERADMIN,
      priority: dto.priority || ClientKnowledgePriority.NORMAL,
      title: this.sanitizeText(dto.title),
      content: dto.content ? this.sanitizeText(dto.content) : null,
      summary: dto.summary ? this.sanitizeText(dto.summary) : null,
      isPinned: !!dto.isPinned,
      tags: this.tagsJson(dto.tags),
      relatedEntityType: dto.relatedEntityType || null,
      relatedEntityId: dto.relatedEntityId || null,
      createdById: actor?.id || 'system',
    } });
    await this.activity(id, actor?.id, ClientActivityType.NOTE_ADDED, 'Knowledge item creat', item.title, { itemId: item.id, itemType: item.type });
    return item;
  }

  async getKnowledgeItem(id: string, itemId: string) {
    await this.ensureClient(id);
    const item = await this.prisma.clientKnowledgeItem.findFirst({ where: { id: itemId, clientAccountId: id } });
    if (!item) throw new NotFoundException('Knowledge item not found');
    return item;
  }

  async updateKnowledgeItem(id: string, itemId: string, dto: UpdateClientKnowledgeItemDto, actor: any) {
    await this.getKnowledgeItem(id, itemId);
    this.assertRelatedEntity(dto.relatedEntityType);
    this.assertNoSecrets([dto.title, dto.content, dto.summary, dto.tags].filter(Boolean).join(' '));
    return this.prisma.clientKnowledgeItem.update({ where: { id: itemId }, data: {
      title: dto.title ? this.sanitizeText(dto.title) : undefined,
      content: dto.content ? this.sanitizeText(dto.content) : dto.content,
      summary: dto.summary ? this.sanitizeText(dto.summary) : dto.summary,
      type: dto.type,
      category: dto.category,
      visibility: dto.visibility,
      priority: dto.priority,
      isPinned: dto.isPinned,
      tags: dto.tags ? this.tagsJson(dto.tags) : undefined,
      relatedEntityType: dto.relatedEntityType,
      relatedEntityId: dto.relatedEntityId,
      updatedById: actor?.id || null,
    } });
  }

  async archiveKnowledgeItem(id: string, itemId: string, dto: ArchiveClientKnowledgeDto, actor: any) {
    await this.getKnowledgeItem(id, itemId);
    return this.prisma.clientKnowledgeItem.update({ where: { id: itemId }, data: { status: ClientKnowledgeStatus.ARCHIVED, archivedAt: new Date(), archivedById: actor?.id || null, archiveReason: dto.reason || null } });
  }

  async notes(id: string) {
    await this.ensureClient(id);
    return { items: await this.prisma.clientKnowledgeItem.findMany({ where: { clientAccountId: id, type: ClientKnowledgeItemType.NOTE, status: ClientKnowledgeStatus.ACTIVE }, orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }] }) };
  }

  async createNote(id: string, dto: CreateClientNoteDto | CreateClientKnowledgeItemDto | any, actor: any) {
    const content = dto.content || dto.note;
    const title = dto.title || (content ? String(content).slice(0, 80) : 'Nota interna');
    return this.createKnowledgeItem(id, { ...dto, title, content, type: ClientKnowledgeItemType.NOTE, isPinned: dto.isPinned }, actor, ClientKnowledgeItemType.NOTE);
  }

  async updateNote(noteId: string, dto: UpdateClientNoteDto | UpdateClientKnowledgeItemDto | any, actor?: any) {
    const existing = await this.prisma.clientKnowledgeItem.findUnique({ where: { id: noteId } });
    if (!existing) throw new NotFoundException('Note not found');
    return this.updateKnowledgeItem(existing.clientAccountId, noteId, { ...dto, title: dto.title || existing.title, content: dto.content || dto.note }, actor);
  }

  async pinNote(noteId: string, pinned: boolean) {
    return this.prisma.clientKnowledgeItem.update({ where: { id: noteId }, data: { isPinned: pinned } });
  }

  async clientFiles(id: string, query: Record<string, string | undefined>) {
    await this.ensureClient(id);
    const items = await this.prisma.clientFile.findMany({ where: { clientAccountId: id, ...(query.status ? { status: query.status as ClientKnowledgeStatus } : { status: ClientKnowledgeStatus.ACTIVE }), ...(query.category ? { category: query.category as ClientKnowledgeCategory } : {}) }, orderBy: { uploadedAt: 'desc' } });
    return { items, uploadEnabled: false };
  }

  async createClientFile(id: string, dto: CreateClientFileDto, actor: any) {
    this.assertNoSecrets([dto.fileName, dto.originalFileName, dto.description, dto.externalUrl].filter(Boolean).join(' '));
    this.validateExternalUrl(dto.externalUrl);
    const client = await this.ensureClient(id);
    const file = await this.prisma.clientFile.create({ data: {
      clientAccountId: id,
      associationId: client.associationId,
      fileName: this.sanitizeText(dto.fileName),
      originalFileName: dto.originalFileName || dto.fileName,
      mimeType: dto.mimeType || null,
      fileSize: dto.fileSize == null ? null : Number(dto.fileSize),
      storageProvider: dto.storageProvider || ClientFileStorageProvider.EXTERNAL_LINK,
      storagePath: dto.storagePath || null,
      externalUrl: dto.externalUrl || null,
      description: dto.description ? this.sanitizeText(dto.description) : null,
      category: dto.category || ClientKnowledgeCategory.DOCUMENTS,
      uploadedById: actor?.id || 'system',
    } });
    await this.createKnowledgeItem(id, { title: file.fileName, content: file.description || undefined, type: ClientKnowledgeItemType.FILE, category: file.category }, actor, ClientKnowledgeItemType.FILE).catch(() => undefined);
    return file;
  }

  async updateClientFile(id: string, fileId: string, dto: UpdateClientFileDto, actor: any) {
    await this.assertClientScoped('clientFile', id, fileId);
    this.assertNoSecrets([dto.fileName, dto.originalFileName, dto.description, dto.externalUrl].filter(Boolean).join(' '));
    this.validateExternalUrl(dto.externalUrl);
    return this.prisma.clientFile.update({ where: { id: fileId }, data: { ...this.cleanUndefined({ fileName: dto.fileName, originalFileName: dto.originalFileName, mimeType: dto.mimeType, fileSize: dto.fileSize == null ? undefined : Number(dto.fileSize), storageProvider: dto.storageProvider, storagePath: dto.storagePath, externalUrl: dto.externalUrl, description: dto.description, category: dto.category, updatedAt: new Date(), archivedById: undefined }), metadata: undefined } });
  }

  async archiveClientFile(id: string, fileId: string, dto: ArchiveClientKnowledgeDto, actor: any) {
    await this.assertClientScoped('clientFile', id, fileId);
    return this.prisma.clientFile.update({ where: { id: fileId }, data: { status: ClientKnowledgeStatus.ARCHIVED, archivedAt: new Date(), archivedById: actor?.id || null, archiveReason: dto.reason || null } });
  }

  async clientContacts(id: string) {
    await this.ensureClient(id);
    return { items: await this.prisma.clientContact.findMany({ where: { clientAccountId: id, status: { not: ClientContactStatus.ARCHIVED } }, orderBy: [{ isPrimary: 'desc' }, { updatedAt: 'desc' }] }) };
  }

  async createClientContact(id: string, dto: CreateClientContactDto, actor: any) {
    this.assertNoSecrets([dto.fullName, dto.role, dto.phone, dto.email, dto.notes].filter(Boolean).join(' '));
    const client = await this.ensureClient(id);
    if (dto.isPrimary) await this.prisma.clientContact.updateMany({ where: { clientAccountId: id }, data: { isPrimary: false } });
    return this.prisma.clientContact.create({ data: { clientAccountId: id, associationId: client.associationId, fullName: this.sanitizeText(dto.fullName), role: dto.role || null, phone: dto.phone || null, email: dto.email || null, preferredContactMethod: dto.preferredContactMethod || null, notes: dto.notes ? this.sanitizeText(dto.notes) : null, isPrimary: !!dto.isPrimary, status: dto.status || ClientContactStatus.ACTIVE, createdById: actor?.id || 'system' } });
  }

  async updateClientContact(id: string, contactId: string, dto: UpdateClientContactDto, actor: any) {
    await this.assertClientScoped('clientContact', id, contactId);
    this.assertNoSecrets([dto.fullName, dto.role, dto.phone, dto.email, dto.notes].filter(Boolean).join(' '));
    if (dto.isPrimary) await this.prisma.clientContact.updateMany({ where: { clientAccountId: id, id: { not: contactId } }, data: { isPrimary: false } });
    return this.prisma.clientContact.update({ where: { id: contactId }, data: { fullName: dto.fullName, role: dto.role, phone: dto.phone, email: dto.email, preferredContactMethod: dto.preferredContactMethod, notes: dto.notes, isPrimary: dto.isPrimary, status: dto.status, updatedById: actor?.id || null } });
  }

  async primaryClientContact(id: string, contactId: string) {
    await this.assertClientScoped('clientContact', id, contactId);
    await this.prisma.clientContact.updateMany({ where: { clientAccountId: id }, data: { isPrimary: false } });
    return this.prisma.clientContact.update({ where: { id: contactId }, data: { isPrimary: true, status: ClientContactStatus.ACTIVE } });
  }

  async archiveClientContact(id: string, contactId: string) {
    await this.assertClientScoped('clientContact', id, contactId);
    return this.prisma.clientContact.update({ where: { id: contactId }, data: { status: ClientContactStatus.ARCHIVED, isPrimary: false } });
  }

  async clientDecisions(id: string) {
    await this.ensureClient(id);
    return { items: await this.prisma.clientDecision.findMany({ where: { clientAccountId: id, status: { not: ClientDecisionStatus.ARCHIVED } }, orderBy: { decisionDate: 'desc' } }) };
  }

  async createClientDecision(id: string, dto: CreateClientDecisionDto, actor: any) {
    this.assertRelatedEntity(dto.relatedEntityType);
    this.assertNoSecrets([dto.title, dto.description, dto.decidedBy].filter(Boolean).join(' '));
    const client = await this.ensureClient(id);
    const decision = await this.prisma.clientDecision.create({ data: { clientAccountId: id, associationId: client.associationId, title: this.sanitizeText(dto.title), description: this.sanitizeText(dto.description), decisionDate: dto.decisionDate ? new Date(dto.decisionDate) : new Date(), decidedBy: dto.decidedBy || null, impact: dto.impact || ClientDecisionImpact.MEDIUM, category: dto.category || ClientKnowledgeCategory.DECISIONS, status: dto.status || ClientDecisionStatus.ACTIVE, relatedEntityType: dto.relatedEntityType || null, relatedEntityId: dto.relatedEntityId || null, createdById: actor?.id || 'system' } });
    await this.createKnowledgeItem(id, { title: decision.title, content: decision.description, type: ClientKnowledgeItemType.DECISION, category: decision.category, priority: this.priorityFromImpact(decision.impact) }, actor, ClientKnowledgeItemType.DECISION).catch(() => undefined);
    return decision;
  }

  async updateClientDecision(id: string, decisionId: string, dto: UpdateClientDecisionDto, actor: any) {
    await this.assertClientScoped('clientDecision', id, decisionId);
    this.assertRelatedEntity(dto.relatedEntityType);
    this.assertNoSecrets([dto.title, dto.description, dto.decidedBy].filter(Boolean).join(' '));
    return this.prisma.clientDecision.update({ where: { id: decisionId }, data: { title: dto.title, description: dto.description, decisionDate: dto.decisionDate ? new Date(dto.decisionDate) : undefined, decidedBy: dto.decidedBy, impact: dto.impact, category: dto.category, status: dto.status, relatedEntityType: dto.relatedEntityType, relatedEntityId: dto.relatedEntityId, updatedById: actor?.id || null } });
  }

  async supersedeClientDecision(id: string, decisionId: string) {
    await this.assertClientScoped('clientDecision', id, decisionId);
    return this.prisma.clientDecision.update({ where: { id: decisionId }, data: { status: ClientDecisionStatus.SUPERSEDED } });
  }

  async archiveClientDecision(id: string, decisionId: string) {
    await this.assertClientScoped('clientDecision', id, decisionId);
    return this.prisma.clientDecision.update({ where: { id: decisionId }, data: { status: ClientDecisionStatus.ARCHIVED } });
  }

  async clientKnownIssues(id: string) {
    await this.ensureClient(id);
    return { items: await this.prisma.clientKnownIssue.findMany({ where: { clientAccountId: id, status: { not: ClientKnownIssueStatus.ARCHIVED } }, orderBy: [{ severity: 'desc' }, { updatedAt: 'desc' }] }) };
  }

  async createClientKnownIssue(id: string, dto: CreateClientKnownIssueDto, actor: any) {
    this.assertRelatedEntity(dto.relatedEntityType);
    this.assertNoSecrets([dto.title, dto.description, dto.workaround, dto.resolution].filter(Boolean).join(' '));
    const client = await this.ensureClient(id);
    const issue = await this.prisma.clientKnownIssue.create({ data: { clientAccountId: id, associationId: client.associationId, title: this.sanitizeText(dto.title), description: this.sanitizeText(dto.description), severity: dto.severity || ClientKnownIssueSeverity.MEDIUM, status: dto.status || ClientKnownIssueStatus.OPEN, category: dto.category || ClientKnowledgeCategory.RISKS, workaround: dto.workaround ? this.sanitizeText(dto.workaround) : null, resolution: dto.resolution ? this.sanitizeText(dto.resolution) : null, assignedToId: dto.assignedToId || null, relatedEntityType: dto.relatedEntityType || null, relatedEntityId: dto.relatedEntityId || null, createdById: actor?.id || 'system' } });
    await this.createKnowledgeItem(id, { title: issue.title, content: issue.description, type: ClientKnowledgeItemType.KNOWN_ISSUE, category: issue.category, priority: this.priorityFromSeverity(issue.severity) }, actor, ClientKnowledgeItemType.KNOWN_ISSUE).catch(() => undefined);
    return issue;
  }

  async updateClientKnownIssue(id: string, issueId: string, dto: UpdateClientKnownIssueDto, actor: any) {
    await this.assertClientScoped('clientKnownIssue', id, issueId);
    this.assertRelatedEntity(dto.relatedEntityType);
    this.assertNoSecrets([dto.title, dto.description, dto.workaround, dto.resolution].filter(Boolean).join(' '));
    return this.prisma.clientKnownIssue.update({ where: { id: issueId }, data: { title: dto.title, description: dto.description, status: dto.status, severity: dto.severity, category: dto.category, workaround: dto.workaround, resolution: dto.resolution, assignedToId: dto.assignedToId, relatedEntityType: dto.relatedEntityType, relatedEntityId: dto.relatedEntityId, updatedById: actor?.id || null } });
  }

  async resolveClientKnownIssue(id: string, issueId: string, dto: ResolveClientKnownIssueDto) {
    await this.assertClientScoped('clientKnownIssue', id, issueId);
    return this.prisma.clientKnownIssue.update({ where: { id: issueId }, data: { status: ClientKnownIssueStatus.RESOLVED, resolvedAt: new Date(), resolution: dto.resolution || undefined } });
  }

  async archiveClientKnownIssue(id: string, issueId: string) {
    await this.assertClientScoped('clientKnownIssue', id, issueId);
    return this.prisma.clientKnownIssue.update({ where: { id: issueId }, data: { status: ClientKnownIssueStatus.ARCHIVED } });
  }

  async clientLinks(id: string) {
    await this.ensureClient(id);
    return { items: await this.prisma.clientLink.findMany({ where: { clientAccountId: id, status: ClientLinkStatus.ACTIVE }, orderBy: { updatedAt: 'desc' } }) };
  }

  async createClientLink(id: string, dto: CreateClientLinkDto, actor: any) {
    this.assertNoSecrets([dto.title, dto.url, dto.description].filter(Boolean).join(' '));
    this.validateExternalUrl(dto.url);
    const client = await this.ensureClient(id);
    const link = await this.prisma.clientLink.create({ data: { clientAccountId: id, associationId: client.associationId, title: this.sanitizeText(dto.title), url: dto.url, description: dto.description ? this.sanitizeText(dto.description) : null, category: dto.category || ClientKnowledgeCategory.GENERAL, status: dto.status || ClientLinkStatus.ACTIVE, createdById: actor?.id || 'system' } });
    await this.createKnowledgeItem(id, { title: link.title, content: link.description || link.url, type: ClientKnowledgeItemType.LINK, category: link.category }, actor, ClientKnowledgeItemType.LINK).catch(() => undefined);
    return link;
  }

  async updateClientLink(id: string, linkId: string, dto: UpdateClientLinkDto, actor: any) {
    await this.assertClientScoped('clientLink', id, linkId);
    this.assertNoSecrets([dto.title, dto.url, dto.description].filter(Boolean).join(' '));
    this.validateExternalUrl(dto.url);
    return this.prisma.clientLink.update({ where: { id: linkId }, data: { title: dto.title, url: dto.url, description: dto.description, category: dto.category, status: dto.status, updatedById: actor?.id || null } });
  }

  async archiveClientLink(id: string, linkId: string) {
    await this.assertClientScoped('clientLink', id, linkId);
    return this.prisma.clientLink.update({ where: { id: linkId }, data: { status: ClientLinkStatus.ARCHIVED } });
  }

  async clientChecklists(id: string) {
    await this.ensureClient(id);
    return { items: await this.prisma.clientChecklist.findMany({ where: { clientAccountId: id, status: { not: ClientChecklistStatus.ARCHIVED } }, orderBy: { updatedAt: 'desc' } }) };
  }

  async createClientChecklist(id: string, dto: CreateClientChecklistDto, actor: any) {
    this.assertNoSecrets([dto.title, dto.description, JSON.stringify(dto.items || '')].filter(Boolean).join(' '));
    const client = await this.ensureClient(id);
    const items = Array.isArray(dto.items) ? dto.items : [];
    return this.prisma.clientChecklist.create({ data: { clientAccountId: id, associationId: client.associationId, title: this.sanitizeText(dto.title), description: dto.description ? this.sanitizeText(dto.description) : null, category: dto.category || ClientKnowledgeCategory.ONBOARDING, status: dto.status || ClientChecklistStatus.ACTIVE, items: items as Prisma.InputJsonValue, createdById: actor?.id || 'system' } });
  }

  async updateClientChecklist(id: string, checklistId: string, dto: UpdateClientChecklistDto, actor: any) {
    await this.assertClientScoped('clientChecklist', id, checklistId);
    this.assertNoSecrets([dto.title, dto.description, JSON.stringify(dto.items || '')].filter(Boolean).join(' '));
    return this.prisma.clientChecklist.update({ where: { id: checklistId }, data: { title: dto.title, description: dto.description, category: dto.category, status: dto.status, items: Array.isArray(dto.items) ? dto.items as Prisma.InputJsonValue : undefined, completedAt: dto.status === ClientChecklistStatus.COMPLETED ? new Date() : undefined, updatedById: actor?.id || null } });
  }

  async myWork(actor: any) {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const tomorrow = new Date(todayStart);
    tomorrow.setDate(todayStart.getDate() + 1);
    const nextWeek = new Date(now);
    nextWeek.setDate(now.getDate() + 7);
    const userId = actor?.id;
    const assignment = userId ? [{ assignedToId: userId }, { assignedToId: null }] : [{ assignedToId: null }];
    const activeTask = { status: { in: [ClientTaskStatus.OPEN, ClientTaskStatus.IN_PROGRESS] } };
    const activeFollowUp = { status: ClientFollowUpStatus.OPEN };
    const activeReminder = { status: { in: [ClientReminderStatus.SCHEDULED, ClientReminderStatus.DUE, ClientReminderStatus.SNOOZED] } };
    const [openTasks, overdueTasks, followUpsToday, overdueFollowUps, dueReminders, urgentItems, overdue, today, upcoming, completedRecently] = await Promise.all([
      this.prisma.clientTask.count({ where: { ...activeTask, OR: assignment } }),
      this.prisma.clientTask.count({ where: { ...activeTask, OR: assignment, dueAt: { lt: now } } }),
      this.prisma.clientFollowUp.count({ where: { ...activeFollowUp, OR: assignment, dueAt: { gte: todayStart, lt: tomorrow } } }),
      this.prisma.clientFollowUp.count({ where: { ...activeFollowUp, OR: assignment, dueAt: { lt: now } } }),
      this.prisma.clientReminder.count({ where: { ...activeReminder, OR: assignment, remindAt: { lte: now } } }),
      this.prisma.clientTask.count({ where: { ...activeTask, OR: assignment, priority: ClientPriority.URGENT } }),
      this.calendar({ from: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 30).toISOString(), to: now.toISOString(), status: 'active' }),
      this.calendar({ from: todayStart.toISOString(), to: tomorrow.toISOString(), status: 'active' }),
      this.calendar({ from: tomorrow.toISOString(), to: nextWeek.toISOString(), status: 'active' }),
      this.prisma.clientTask.findMany({ where: { status: ClientTaskStatus.COMPLETED, completedAt: { gte: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 7) }, OR: assignment }, include: { clientAccount: { select: { id: true, displayName: true } } }, orderBy: { completedAt: 'desc' }, take: 10 }),
    ]);
    return {
      summary: { openTasks, overdueTasks, followUpsToday, overdueFollowUps, dueReminders, urgentItems, completedThisWeek: completedRecently.length },
      overdue: overdue.items,
      today: today.items,
      upcoming: upcoming.items,
      completedRecently,
    };
  }

  async calendar(query: Record<string, string | undefined>) {
    const { from, to } = this.calendarRange(query);
    const clientAccountId = query.clientAccountId;
    const assignedToId = query.assignedToId;
    const [tasks, followUps, reminders, saasInvoices, services, drills] = await Promise.all([
      this.prisma.clientTask.findMany({ where: { ...(clientAccountId ? { clientAccountId } : {}), ...(assignedToId ? { assignedToId } : {}), dueAt: { gte: from, lte: to }, status: { not: ClientTaskStatus.CANCELLED } }, include: { clientAccount: { select: { id: true, displayName: true } } }, take: 300 }),
      this.prisma.clientFollowUp.findMany({ where: { ...(clientAccountId ? { clientAccountId } : {}), ...(assignedToId ? { assignedToId } : {}), dueAt: { gte: from, lte: to }, status: { not: ClientFollowUpStatus.CANCELLED } }, include: { clientAccount: { select: { id: true, displayName: true, contactName: true } } }, take: 300 }),
      this.prisma.clientReminder.findMany({ where: { ...(clientAccountId ? { clientAccountId } : {}), ...(assignedToId ? { assignedToId } : {}), OR: [{ remindAt: { gte: from, lte: to } }, { snoozedUntil: { gte: from, lte: to } }], status: { notIn: [ClientReminderStatus.CANCELLED, ClientReminderStatus.DISMISSED] } }, include: { clientAccount: { select: { id: true, displayName: true } } }, take: 300 }),
      clientAccountId ? Promise.resolve([]) : this.prisma.saasInvoice.findMany({ where: { dueDate: { gte: from, lte: to } }, include: { association: { select: { id: true, name: true } } }, take: 80 }).catch(() => []),
      clientAccountId ? Promise.resolve([]) : this.prisma.platformService.findMany({ where: { nextPaymentDate: { gte: from, lte: to } }, take: 80 }).catch(() => []),
      clientAccountId ? Promise.resolve([]) : this.prisma.recoveryDrill.findMany({ where: { plannedAt: { gte: from, lte: to } }, take: 80 }).catch(() => []),
    ]);
    const items = [
      ...tasks.map((task) => this.taskEvent(task)),
      ...followUps.map((followUp) => this.followUpEvent(followUp)),
      ...reminders.map((reminder) => this.reminderEvent(reminder)),
      ...saasInvoices.map((invoice: any) => ({ id: `saas_invoice_${invoice.id}`, type: CALENDAR_EVENT_TYPE.SAAS_INVOICE_DUE, title: `Factura SaaS scadenta ${invoice.invoiceNumber || ''}`.trim(), startAt: invoice.dueDate, status: invoice.status, priority: invoice.status === 'OVERDUE' ? ClientPriority.HIGH : ClientPriority.NORMAL, client: invoice.association ? { id: invoice.association.id, displayName: invoice.association.name } : null, url: `/superadmin/saas-invoices/${invoice.id}` })),
      ...services.map((service: any) => ({ id: `platform_service_${service.id}`, type: CALENDAR_EVENT_TYPE.PLATFORM_SERVICE_PAYMENT_DUE, title: `Plata serviciu: ${service.name}`, startAt: service.nextPaymentDate, status: service.status, priority: service.criticality === 'CRITICAL' ? ClientPriority.HIGH : ClientPriority.NORMAL, client: null, url: `/superadmin/launch/services/${service.id}` })),
      ...drills.map((drill: any) => ({ id: `recovery_drill_${drill.id}`, type: CALENDAR_EVENT_TYPE.RECOVERY_DRILL_PLANNED, title: drill.title, startAt: drill.plannedAt, status: drill.status, priority: ClientPriority.NORMAL, client: null, url: `/superadmin/backup/recovery-drills/${drill.id}` })),
    ].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
    return { items, meta: { from, to, total: items.length, view: query.view || 'agenda' } };
  }

  async clientCalendar(id: string, query: Record<string, string | undefined>) {
    await this.ensureClient(id);
    return this.calendar({ ...query, clientAccountId: id });
  }

  async activityTimeline(id: string) {
    await this.ensureClient(id);
    return { items: await this.prisma.clientActivity.findMany({ where: { clientAccountId: id }, orderBy: { createdAt: 'desc' }, take: 200 }) };
  }

  async onboarding(id: string) {
    const { client, association, subscription } = await this.get(id);
    const associationId = client.associationId;
    const counts = associationId ? await this.countAssociationUsage(associationId) : null;
    const steps = [
      ['ASSOCIATION_PROFILE', 'Profil asociatie creat', !!association, associationId ? `/superadmin/associations/${associationId}` : null],
      ['ADMIN_OWNER', 'Admin responsabil creat', !!client.ownerUserId || !!association, associationId ? `/superadmin/associations/${associationId}` : null],
      ['APARTMENTS', 'Apartamente importate/create', !!counts?.apartments, associationId ? `/superadmin/organizations/${associationId}` : null],
      ['RESIDENTS', 'Locatari importati/creati', !!counts?.residents, associationId ? `/superadmin/organizations/${associationId}` : null],
      ['TARIFFS', 'Tarife configurate', !!counts?.tariffs, associationId ? `/superadmin/organizations/${associationId}` : null],
      ['METERS', 'Contoare configurate, daca este cazul', !!counts?.meters, associationId ? `/superadmin/organizations/${associationId}` : null],
      ['DATA_QUALITY', 'Data Quality rulat', !!counts?.dataQuality, associationId ? `/superadmin/organizations/${associationId}` : null],
      ['SUBSCRIPTION', 'Abonament asignat', !!subscription, associationId ? `/superadmin/organizations/${associationId}/subscription` : null],
      ['GO_LIVE', 'Activare confirmata', client.lifecycleStage === ClientLifecycleStage.ACTIVE, `/superadmin/clients/${id}`],
    ];
    return { client, steps: steps.map(([key, title, completed, url]) => ({ key, title, completed, url })) };
  }

  async riskTab(id: string) {
    const data = await this.get(id);
    return { ...data, calculatedRisk: await this.risk.calculateRisk(id) };
  }

  private buildWhere(query: Record<string, string | undefined>): Prisma.ClientAccountWhereInput {
    const search = query.search?.trim();
    return {
      ...(query.stage ? { lifecycleStage: query.stage as ClientLifecycleStage } : {}),
      ...(query.status ? { status: query.status as ClientAccountStatus } : {}),
      ...(query.priority ? { priority: query.priority as ClientPriority } : {}),
      ...(query.riskLevel ? { riskLevel: query.riskLevel as ClientRiskLevel } : {}),
      ...(query.ownerUserId ? { ownerUserId: query.ownerUserId } : {}),
      ...(query.source ? { source: query.source as ClientSource } : {}),
      ...(query.hasAssociation === 'true' ? { associationId: { not: null } } : {}),
      ...(query.noFollowUp === 'true' ? { nextFollowUpAt: null } : {}),
      ...(query.followUpDue === 'true' ? { nextFollowUpAt: { lt: new Date() } } : {}),
      ...(search ? { OR: [
        { displayName: { contains: search, mode: 'insensitive' } },
        { contactName: { contains: search, mode: 'insensitive' } },
        { contactPhone: { contains: search, mode: 'insensitive' } },
        { contactEmail: { contains: search, mode: 'insensitive' } },
        { associationName: { contains: search, mode: 'insensitive' } },
        { associationCode: { contains: search, mode: 'insensitive' } },
      ] } : {}),
    };
  }

  private orderBy(sort?: string): Prisma.ClientAccountOrderByWithRelationInput[] {
    if (sort === 'nextFollowUpAt') return [{ nextFollowUpAt: 'asc' }, { updatedAt: 'desc' }];
    if (sort === 'risk') return [{ riskLevel: 'desc' }, { updatedAt: 'desc' }];
    if (sort === 'priority') return [{ priority: 'desc' }, { updatedAt: 'desc' }];
    if (sort === 'stage') return [{ lifecycleStage: 'asc' }, { updatedAt: 'desc' }];
    return [{ createdAt: 'desc' }];
  }

  private async decorateClients(items: any[]) {
    const userIds = Array.from(new Set(items.map((item) => item.ownerUserId).filter(Boolean)));
    const owners = userIds.length ? await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, fullName: true, email: true } }) : [];
    const ownerMap = new Map(owners.map((owner) => [owner.id, owner]));
    const ids = items.map((item) => item.id);
    const [tasks, followUps] = await Promise.all([
      this.prisma.clientTask.groupBy({ by: ['clientAccountId'], where: { clientAccountId: { in: ids }, status: { in: [ClientTaskStatus.OPEN, ClientTaskStatus.IN_PROGRESS] } }, _count: true }),
      this.prisma.clientFollowUp.findMany({ where: { clientAccountId: { in: ids }, status: ClientFollowUpStatus.OPEN }, orderBy: { dueAt: 'asc' } }),
    ]);
    const taskMap = new Map(tasks.map((row) => [row.clientAccountId, row._count]));
    const followMap = new Map<string, any>();
    followUps.forEach((row) => { if (!followMap.has(row.clientAccountId)) followMap.set(row.clientAccountId, row); });
    return items.map((item) => ({ ...item, owner: item.ownerUserId ? ownerMap.get(item.ownerUserId) || null : null, openTasks: taskMap.get(item.id) || 0, nextFollowUp: followMap.get(item.id) || null }));
  }

  private async ensureDerivedClientAccounts() {
    const [requests, associations] = await Promise.all([
      this.prisma.customerOnboardingRequest.findMany({ where: { NOT: { status: CustomerOnboardingRequestStatus.SPAM } }, take: 200, orderBy: { createdAt: 'desc' } }),
      this.prisma.organization.findMany({ where: { isDemo: false }, take: 200, orderBy: { createdAt: 'desc' } }),
    ]);
    for (const request of requests) {
      const exists = await this.prisma.clientAccount.findFirst({ where: { customerRequestId: request.id }, select: { id: true } });
      if (!exists) {
        await this.prisma.clientAccount.create({ data: {
          customerRequestId: request.id,
          associationId: request.convertedAssociationId || null,
          displayName: request.associationName,
          contactName: request.fullName,
          contactPhone: request.phone,
          contactEmail: request.email,
          associationName: request.associationName,
          associationCode: request.associationCode,
          address: request.address,
          apartmentsCount: request.apartmentsCount,
          ownerUserId: request.assignedToId,
          priority: request.priority === 'HIGH' ? ClientPriority.HIGH : request.priority === 'LOW' ? ClientPriority.LOW : ClientPriority.NORMAL,
          source: request.source === 'REFERRAL' ? ClientSource.REFERRAL : request.source === 'ACCESS_REQUEST' ? ClientSource.ACCESS_REQUEST : ClientSource.PUBLIC_WEBSITE,
          lifecycleStage: this.stageFromRequestStatus(request.status),
        } });
      }
    }
    for (const association of associations) {
      const exists = await this.prisma.clientAccount.findFirst({ where: { associationId: association.id }, select: { id: true } });
      if (!exists) {
        await this.prisma.clientAccount.create({ data: {
          associationId: association.id,
          displayName: association.name || association.legalName || 'Client Espace',
          associationName: association.legalName || association.name,
          associationCode: association.fiscalCode,
          contactName: association.administratorName,
          contactPhone: association.phone,
          contactEmail: association.email,
          address: association.address,
          lifecycleStage: association.status === 'ACTIVE' ? ClientLifecycleStage.ACTIVE : ClientLifecycleStage.ONBOARDING,
          status: association.status === 'ACTIVE' ? ClientAccountStatus.ACTIVE : ClientAccountStatus.OPEN,
          source: ClientSource.EXISTING_RELATIONSHIP,
          activatedAt: association.status === 'ACTIVE' ? association.createdAt : null,
        } });
      }
    }
  }

  private async ensureClient(id: string) {
    const client = await this.prisma.clientAccount.findUnique({ where: { id } });
    if (!client) throw new NotFoundException('Client account not found');
    return client;
  }

  private async activity(clientAccountId: string, actorUserId: string | undefined, type: ClientActivityType, title: string, message: string, metadata?: Record<string, unknown>) {
    const client = await this.prisma.clientAccount.findUnique({ where: { id: clientAccountId }, select: { associationId: true } });
    return this.prisma.clientActivity.create({ data: { clientAccountId, associationId: client?.associationId || null, actorUserId: actorUserId || null, type, title, message, metadata: metadata as Prisma.InputJsonValue } });
  }

  private stageFromRequestStatus(status: CustomerOnboardingRequestStatus) {
    if (status === CustomerOnboardingRequestStatus.CONTACTED) return ClientLifecycleStage.CONTACTED;
    if (status === CustomerOnboardingRequestStatus.QUALIFIED) return ClientLifecycleStage.QUALIFIED;
    if (status === CustomerOnboardingRequestStatus.IN_ONBOARDING || status === CustomerOnboardingRequestStatus.ONBOARDING) return ClientLifecycleStage.ONBOARDING;
    if (status === CustomerOnboardingRequestStatus.CONVERTED) return ClientLifecycleStage.ACTIVE;
    if (status === CustomerOnboardingRequestStatus.CLOSED || status === CustomerOnboardingRequestStatus.REJECTED) return ClientLifecycleStage.CLOSED;
    return ClientLifecycleStage.NEW_REQUEST;
  }

  private async syncCustomerRequest(client: any) {
    if (!client.customerRequestId) return;
    const status = client.lifecycleStage === ClientLifecycleStage.CONTACTED ? CustomerOnboardingRequestStatus.CONTACTED
      : client.lifecycleStage === ClientLifecycleStage.QUALIFIED ? CustomerOnboardingRequestStatus.QUALIFIED
      : client.lifecycleStage === ClientLifecycleStage.ONBOARDING ? CustomerOnboardingRequestStatus.ONBOARDING
      : client.lifecycleStage === ClientLifecycleStage.ACTIVE ? CustomerOnboardingRequestStatus.CONVERTED
      : client.lifecycleStage === ClientLifecycleStage.CLOSED ? CustomerOnboardingRequestStatus.REJECTED
      : null;
    if (status) await this.prisma.customerOnboardingRequest.update({ where: { id: client.customerRequestId }, data: { status } }).catch(() => undefined);
  }

  private statusForStage(stage: ClientLifecycleStage) {
    if (stage === ClientLifecycleStage.ACTIVE) return ClientAccountStatus.ACTIVE;
    if (stage === ClientLifecycleStage.SUSPENDED) return ClientAccountStatus.SUSPENDED;
    if (stage === ClientLifecycleStage.CLOSED || stage === ClientLifecycleStage.CHURNED) return ClientAccountStatus.CLOSED;
    return ClientAccountStatus.OPEN;
  }

  private stageLabel(stage: ClientLifecycleStage) {
    return ({
      NEW_REQUEST: 'Cerere noua',
      CONTACTED: 'Contactat',
      QUALIFIED: 'Calificat',
      PREPARING_ONBOARDING: 'Pregatire onboarding',
      ONBOARDING: 'In onboarding',
      READY_TO_ACTIVATE: 'Gata de activare',
      ACTIVE: 'Activ',
      AT_RISK: 'In risc',
      SUSPENDED: 'Suspendat',
      CHURNED: 'Churn',
      CLOSED: 'Inchis',
    } as Record<ClientLifecycleStage, string>)[stage];
  }

  private async countClientEntities(clientId: string, associationId: string | null) {
    const [tasksOpen, tasksOverdue, followOpen, followOverdue] = await Promise.all([
      this.prisma.clientTask.count({ where: { clientAccountId: clientId, status: { in: [ClientTaskStatus.OPEN, ClientTaskStatus.IN_PROGRESS] } } }),
      this.prisma.clientTask.count({ where: { clientAccountId: clientId, status: { in: [ClientTaskStatus.OPEN, ClientTaskStatus.IN_PROGRESS] }, dueAt: { lt: new Date() } } }),
      this.prisma.clientFollowUp.count({ where: { clientAccountId: clientId, status: ClientFollowUpStatus.OPEN } }),
      this.prisma.clientFollowUp.count({ where: { clientAccountId: clientId, status: ClientFollowUpStatus.OPEN, dueAt: { lt: new Date() } } }),
    ]);
    return { tasks: { open: tasksOpen, overdue: tasksOverdue }, followUps: { open: followOpen, overdue: followOverdue } };
  }

  private async countAssociationUsage(associationId: string) {
    const [apartments, residents, tariffs, meters, dataQuality] = await Promise.all([
      this.prisma.apartment.count({ where: { organizationId: associationId } }),
      this.prisma.residentProfile.count({ where: { organizationId: associationId } }),
      Promise.resolve(0),
      this.prisma.meter.count({ where: { organizationId: associationId } }),
      this.prisma.dataQualityRun.count({ where: { associationId } }).catch(() => 0),
    ]);
    return { apartments, residents, tariffs, meters, dataQuality };
  }

  private async createReminderForTask(task: any, actor: any) {
    if (!task.reminderAt) return null;
    return this.prisma.clientReminder.upsert({
      where: { id: `task_${task.id}` },
      update: {
        title: `Reminder task: ${task.title}`,
        message: task.description || null,
        status: ClientReminderStatus.SCHEDULED,
        priority: task.priority,
        remindAt: task.reminderAt,
        assignedToId: task.assignedToId || null,
        relatedEntityType: 'CLIENT_ACCOUNT',
        relatedEntityId: task.clientAccountId,
      },
      create: {
        id: `task_${task.id}`,
        clientAccountId: task.clientAccountId,
        associationId: task.associationId,
        taskId: task.id,
        title: `Reminder task: ${task.title}`,
        message: task.description || null,
        priority: task.priority,
        remindAt: task.reminderAt,
        assignedToId: task.assignedToId || null,
        createdById: actor?.id || null,
        source: ClientReminderSource.TASK,
        relatedEntityType: 'CLIENT_ACCOUNT',
        relatedEntityId: task.clientAccountId,
      },
    }).catch(() => null);
  }

  private async createReminderForFollowUp(followUp: any, actor: any) {
    if (!followUp.reminderAt) return null;
    return this.prisma.clientReminder.upsert({
      where: { id: `follow_up_${followUp.id}` },
      update: {
        title: `Reminder follow-up: ${followUp.title}`,
        message: followUp.description || null,
        status: ClientReminderStatus.SCHEDULED,
        priority: followUp.priority,
        remindAt: followUp.reminderAt,
        assignedToId: followUp.assignedToId || null,
        relatedEntityType: 'CLIENT_ACCOUNT',
        relatedEntityId: followUp.clientAccountId,
      },
      create: {
        id: `follow_up_${followUp.id}`,
        clientAccountId: followUp.clientAccountId,
        associationId: followUp.associationId,
        followUpId: followUp.id,
        title: `Reminder follow-up: ${followUp.title}`,
        message: followUp.description || null,
        priority: followUp.priority,
        remindAt: followUp.reminderAt,
        assignedToId: followUp.assignedToId || null,
        createdById: actor?.id || null,
        source: ClientReminderSource.FOLLOW_UP,
        relatedEntityType: 'CLIENT_ACCOUNT',
        relatedEntityId: followUp.clientAccountId,
      },
    }).catch(() => null);
  }

  private decorateReminderStatus<T extends { status: ClientReminderStatus; remindAt: Date; snoozedUntil?: Date | null }>(item: T, now: Date) {
    const effectiveDue = item.status === ClientReminderStatus.SNOOZED ? item.snoozedUntil : item.remindAt;
    if ((item.status === ClientReminderStatus.SCHEDULED || item.status === ClientReminderStatus.SNOOZED) && effectiveDue && effectiveDue <= now) {
      return { ...item, status: ClientReminderStatus.DUE };
    }
    return item;
  }

  private calendarRange(query: Record<string, string | undefined>) {
    const base = query.date ? new Date(query.date) : new Date();
    let from = query.from ? new Date(query.from) : new Date(base);
    let to = query.to ? new Date(query.to) : new Date(base);
    if (!query.from && !query.to) {
      if (query.view === 'day') {
        from.setHours(0, 0, 0, 0);
        to = new Date(from);
        to.setDate(to.getDate() + 1);
      } else if (query.view === 'month') {
        from = new Date(base.getFullYear(), base.getMonth(), 1);
        to = new Date(base.getFullYear(), base.getMonth() + 1, 1);
      } else {
        from.setHours(0, 0, 0, 0);
        to = new Date(from);
        to.setDate(to.getDate() + 7);
      }
    }
    return { from, to };
  }

  private taskEvent(task: any) {
    return {
      id: `task_${task.id}`,
      type: CALENDAR_EVENT_TYPE.TASK_DUE,
      title: task.title,
      startAt: task.dueAt,
      status: task.status,
      priority: task.priority,
      client: task.clientAccount ? { id: task.clientAccount.id, displayName: task.clientAccount.displayName } : null,
      assignedTo: task.assignedToId ? { id: task.assignedToId } : null,
      url: `/superadmin/clients/tasks/${task.id}`,
    };
  }

  private followUpEvent(followUp: any) {
    return {
      id: `follow_up_${followUp.id}`,
      type: CALENDAR_EVENT_TYPE.FOLLOW_UP_DUE,
      title: followUp.title,
      startAt: followUp.dueAt,
      status: followUp.status,
      priority: followUp.priority,
      client: followUp.clientAccount ? { id: followUp.clientAccount.id, displayName: followUp.clientAccount.displayName } : null,
      assignedTo: followUp.assignedToId ? { id: followUp.assignedToId } : null,
      url: `/superadmin/clients/follow-ups/${followUp.id}`,
    };
  }

  private reminderEvent(reminder: any) {
    return {
      id: `reminder_${reminder.id}`,
      type: CALENDAR_EVENT_TYPE.REMINDER,
      title: reminder.title,
      startAt: reminder.snoozedUntil || reminder.remindAt,
      status: reminder.status,
      priority: reminder.priority,
      client: reminder.clientAccount ? { id: reminder.clientAccount.id, displayName: reminder.clientAccount.displayName } : null,
      assignedTo: reminder.assignedToId ? { id: reminder.assignedToId } : null,
      url: `/superadmin/clients/reminders/${reminder.id}`,
    };
  }

  private assertRelatedEntity(type?: string) {
    if (type && !ALLOWED_RELATED_ENTITY_TYPES.has(type)) throw new BadRequestException('relatedEntityType nu este permis.');
  }

  private assertReminderBeforeDue(reminderAt?: string, dueAt?: string) {
    if (reminderAt && dueAt && new Date(reminderAt) > new Date(dueAt)) {
      throw new BadRequestException('Reminder-ul trebuie sa fie inainte de due date.');
    }
  }

  private assertNoSecrets(text: string) {
    if (!text) return;
    const patterns = [
      /password\s*[:=]/i,
      /parola\s*[:=]/i,
      /api[_-]?key/i,
      /token\s*[:=]/i,
      /access_token/i,
      /refresh_token/i,
      /secret\s*[:=]/i,
      /\bJWT\b/i,
      /Bearer\s+[A-Za-z0-9._-]+/i,
      /\bsk-[A-Za-z0-9_-]{12,}/i,
      /supabase\s+service\s+role/i,
      /private\s+key/i,
    ];
    if (patterns.some((pattern) => pattern.test(text))) {
      throw new BadRequestException('Nu salva parole, tokenuri sau chei API in notele interne.');
    }
  }

  private validateExternalUrl(url?: string) {
    if (!url) return;
    this.assertNoSecrets(url);
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Invalid protocol');
    } catch {
      throw new BadRequestException('URL invalid.');
    }
  }

  private tagsJson(tags?: string) {
    if (!tags) return undefined;
    return tags.split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 20) as Prisma.InputJsonValue;
  }

  private priorityFromImpact(impact: ClientDecisionImpact): ClientKnowledgePriority {
    if (impact === ClientDecisionImpact.CRITICAL) return ClientKnowledgePriority.CRITICAL;
    if (impact === ClientDecisionImpact.HIGH) return ClientKnowledgePriority.HIGH;
    if (impact === ClientDecisionImpact.LOW) return ClientKnowledgePriority.LOW;
    return ClientKnowledgePriority.NORMAL;
  }

  private priorityFromSeverity(severity: ClientKnownIssueSeverity): ClientKnowledgePriority {
    if (severity === ClientKnownIssueSeverity.CRITICAL) return ClientKnowledgePriority.CRITICAL;
    if (severity === ClientKnownIssueSeverity.HIGH) return ClientKnowledgePriority.HIGH;
    if (severity === ClientKnownIssueSeverity.LOW) return ClientKnowledgePriority.LOW;
    return ClientKnowledgePriority.NORMAL;
  }

  private async assertClientScoped(model: 'clientFile' | 'clientContact' | 'clientDecision' | 'clientKnownIssue' | 'clientLink' | 'clientChecklist', clientAccountId: string, id: string) {
    const delegate = this.prisma[model] as any;
    const item = await delegate.findFirst({ where: { id, clientAccountId }, select: { id: true } });
    if (!item) throw new NotFoundException('Resource not found');
  }

  private cleanUndefined<T extends Record<string, unknown>>(value: T) {
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
  }

  private sanitizeText(value: string) {
    return value.replace(/(password|token|jwt|secret|apiKey|authorization|cookie)\s*[:=]\s*\S+/gi, '$1: [redacted]').slice(0, 5000);
  }
}
