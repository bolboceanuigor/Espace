import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ClientAccountStatus,
  ClientActivityType,
  ClientCalendarEventType,
  ClientFollowUpSource,
  ClientFollowUpStatus,
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
  CancelClientTaskDto,
  CancelClientFollowUpDto,
  ChangeClientOwnerDto,
  ChangeClientPriorityDto,
  ChangeClientRiskDto,
  ChangeClientStageDto,
  ChangeClientStatusDto,
  CloseClientDto,
  CreateClientAccountDto,
  CreateClientFollowUpDto,
  CreateClientNoteDto,
  CreateClientReminderDto,
  CreateClientTaskDto,
  LinkAssociationDto,
  RescheduleClientFollowUpDto,
  RescheduleClientTaskDto,
  SnoozeClientReminderDto,
  UpdateClientAccountDto,
  UpdateClientFollowUpDto,
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
]);

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
    const where: Prisma.ClientTaskWhereInput = {
      ...(query.status ? { status: query.status as ClientTaskStatus } : {}),
      ...(query.assignedToId ? { assignedToId: query.assignedToId } : {}),
      ...(query.clientAccountId ? { clientAccountId: query.clientAccountId } : {}),
      ...(query.overdue === 'true' ? { status: { in: [ClientTaskStatus.OPEN, ClientTaskStatus.IN_PROGRESS] }, dueAt: { lt: new Date() } } : {}),
    };
    return { items: await this.prisma.clientTask.findMany({ where, orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }], take: 200 }) };
  }

  async clientTasks(id: string) {
    await this.ensureClient(id);
    return { items: await this.prisma.clientTask.findMany({ where: { clientAccountId: id }, orderBy: { createdAt: 'desc' } }) };
  }

  async createTask(id: string, dto: CreateClientTaskDto, actor: any) {
    const client = await this.ensureClient(id);
    const task = await this.prisma.clientTask.create({ data: { clientAccountId: id, associationId: client.associationId, title: dto.title, description: dto.description || null, priority: dto.priority || ClientPriority.NORMAL, dueAt: dto.dueAt ? new Date(dto.dueAt) : null, assignedToId: dto.assignedToId || null, createdById: actor?.id || null } });
    await this.activity(id, actor?.id, ClientActivityType.TASK_CREATED, 'Task creat', task.title, { taskId: task.id });
    return task;
  }

  async updateTask(taskId: string, dto: UpdateClientTaskDto, actor: any) {
    const task = await this.prisma.clientTask.update({ where: { id: taskId }, data: { title: dto.title, description: dto.description, status: dto.status, priority: dto.priority, dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined, assignedToId: dto.assignedToId } });
    await this.activity(task.clientAccountId, actor?.id, ClientActivityType.TASK_CREATED, 'Task actualizat', task.title, { taskId });
    return task;
  }

  async completeTask(taskId: string, actor: any) {
    const task = await this.prisma.clientTask.update({ where: { id: taskId }, data: { status: ClientTaskStatus.COMPLETED, completedAt: new Date(), completedById: actor?.id || null } });
    await this.activity(task.clientAccountId, actor?.id, ClientActivityType.TASK_COMPLETED, 'Task finalizat', task.title, { taskId });
    return task;
  }

  async cancelTask(taskId: string, dto: CancelClientTaskDto, actor: any) {
    const task = await this.prisma.clientTask.update({ where: { id: taskId }, data: { status: ClientTaskStatus.CANCELLED, cancelledAt: new Date(), cancelledById: actor?.id || null, cancellationReason: dto.reason } });
    return task;
  }

  async notes(id: string) {
    await this.ensureClient(id);
    return { items: await this.prisma.clientAccountNote.findMany({ where: { clientAccountId: id }, orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }] }) };
  }

  async createNote(id: string, dto: CreateClientNoteDto, actor: any) {
    const client = await this.ensureClient(id);
    const note = await this.prisma.clientAccountNote.create({ data: { clientAccountId: id, associationId: client.associationId, authorUserId: actor?.id, note: this.sanitizeText(dto.note), isPinned: !!dto.isPinned } });
    await this.activity(id, actor?.id, ClientActivityType.NOTE_ADDED, 'Nota adaugata', note.note.slice(0, 160), { noteId: note.id });
    return note;
  }

  async updateNote(noteId: string, dto: UpdateClientNoteDto) {
    return this.prisma.clientAccountNote.update({ where: { id: noteId }, data: { note: dto.note ? this.sanitizeText(dto.note) : undefined, isPinned: dto.isPinned } });
  }

  async pinNote(noteId: string, pinned: boolean) {
    return this.prisma.clientAccountNote.update({ where: { id: noteId }, data: { isPinned: pinned } });
  }

  async followUps(query: Record<string, string | undefined>) {
    const now = new Date();
    const week = new Date(now);
    week.setDate(now.getDate() + 7);
    const where: Prisma.ClientFollowUpWhereInput = {
      ...(query.status ? { status: query.status as ClientFollowUpStatus } : {}),
      ...(query.assignedToId ? { assignedToId: query.assignedToId } : {}),
      ...(query.overdue === 'true' ? { status: ClientFollowUpStatus.OPEN, dueAt: { lt: now } } : {}),
      ...(query.upcoming === 'true' ? { status: ClientFollowUpStatus.OPEN, dueAt: { gte: now, lte: week } } : {}),
    };
    return { items: await this.prisma.clientFollowUp.findMany({ where, orderBy: { dueAt: 'asc' }, take: 200 }) };
  }

  async createFollowUp(id: string, dto: CreateClientFollowUpDto, actor: any) {
    const client = await this.ensureClient(id);
    const dueAt = new Date(dto.dueAt);
    const followUp = await this.prisma.clientFollowUp.create({ data: { clientAccountId: id, associationId: client.associationId, title: dto.title, description: dto.description || null, dueAt, assignedToId: dto.assignedToId || null, createdById: actor?.id || null } });
    await this.prisma.clientAccount.update({ where: { id }, data: { nextFollowUpAt: dueAt } });
    await this.activity(id, actor?.id, ClientActivityType.FOLLOW_UP_SET, 'Follow-up setat', `${dto.title} - ${dueAt.toISOString().slice(0, 10)}`, { followUpId: followUp.id });
    return followUp;
  }

  async updateFollowUp(followUpId: string, dto: UpdateClientFollowUpDto) {
    return this.prisma.clientFollowUp.update({ where: { id: followUpId }, data: { title: dto.title, description: dto.description, dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined, status: dto.status, assignedToId: dto.assignedToId } });
  }

  async doneFollowUp(followUpId: string, actor: any) {
    return this.prisma.clientFollowUp.update({ where: { id: followUpId }, data: { status: ClientFollowUpStatus.DONE, completedAt: new Date(), completedById: actor?.id || null } });
  }

  async cancelFollowUp(followUpId: string) {
    return this.prisma.clientFollowUp.update({ where: { id: followUpId }, data: { status: ClientFollowUpStatus.CANCELLED } });
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
    if (status === CustomerOnboardingRequestStatus.IN_ONBOARDING) return ClientLifecycleStage.ONBOARDING;
    if (status === CustomerOnboardingRequestStatus.CONVERTED) return ClientLifecycleStage.ACTIVE;
    if (status === CustomerOnboardingRequestStatus.CLOSED) return ClientLifecycleStage.CLOSED;
    return ClientLifecycleStage.NEW_REQUEST;
  }

  private async syncCustomerRequest(client: any) {
    if (!client.customerRequestId) return;
    const status = client.lifecycleStage === ClientLifecycleStage.CONTACTED ? CustomerOnboardingRequestStatus.CONTACTED
      : client.lifecycleStage === ClientLifecycleStage.QUALIFIED ? CustomerOnboardingRequestStatus.QUALIFIED
      : client.lifecycleStage === ClientLifecycleStage.ONBOARDING ? CustomerOnboardingRequestStatus.IN_ONBOARDING
      : client.lifecycleStage === ClientLifecycleStage.ACTIVE ? CustomerOnboardingRequestStatus.CONVERTED
      : client.lifecycleStage === ClientLifecycleStage.CLOSED ? CustomerOnboardingRequestStatus.CLOSED
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

  private sanitizeText(value: string) {
    return value.replace(/(password|token|jwt|secret|apiKey|authorization|cookie)\s*[:=]\s*\S+/gi, '$1: [redacted]').slice(0, 5000);
  }
}
