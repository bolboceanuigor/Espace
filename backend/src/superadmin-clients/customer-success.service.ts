import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ClientHealthActionStatus,
  ClientHealthRiskReason,
  ClientInterventionEventType,
  ClientInterventionOutcome,
  ClientInterventionStatus,
  ClientKnowledgeCategory,
  ClientKnowledgeItemType,
  ClientKnowledgePriority,
  ClientKnowledgeStatus,
  ClientKnowledgeVisibility,
  ClientPriority,
  ClientTaskCategory,
  ClientTaskSource,
  ClientTaskStatus,
  CustomerSuccessPlaybookCategory,
  CustomerSuccessPlaybookStatus,
  CustomerSuccessTriggerType,
  PlaybookStepStatus,
  PlaybookStepType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CancelInterventionDto,
  CompleteInterventionDto,
  CreateCustomerSuccessPlaybookDto,
  CreateInterventionDto,
  RecordContactDto,
  StartInterventionDto,
  StepAddNoteDto,
  StepCreateFollowUpDto,
  StepCreateTaskDto,
  StepReasonDto,
  UpdateCustomerSuccessPlaybookDto,
  UpdateInterventionDto,
} from './dto/customer-success.dto';

const SYSTEM_PLAYBOOKS = [
  {
    key: 'ONBOARDING_STUCK_PLAYBOOK',
    name: 'Onboarding blocat',
    description: 'Interventie ghidata pentru clienti blocati in onboarding.',
    category: CustomerSuccessPlaybookCategory.ONBOARDING,
    triggerType: CustomerSuccessTriggerType.RISK_REASON,
    defaultPriority: ClientPriority.HIGH,
    recommendedFor: [ClientHealthRiskReason.ONBOARDING_STUCK],
    steps: [
      ['Verifica etapa curenta de onboarding', 'Confirma unde este blocat clientul.', PlaybookStepType.CHECK],
      ['Verifica asociatia legata', 'Confirma ca exista associationId si profilul APC.', PlaybookStepType.REVIEW_DATA],
      ['Verifica import apartamente/locatari', 'Identifica daca datele initiale lipsesc.', PlaybookStepType.REVIEW_DATA],
      ['Verifica tarife si Data Quality', 'Deschide Data Quality si onboarding checklist.', PlaybookStepType.REVIEW_DATA_QUALITY],
      ['Creeaza task pentru pasul blocat', 'Task intern cu urmatorul pas clar.', PlaybookStepType.CREATE_TASK],
      ['Seteaza follow-up cu clientul', 'Programeaza contactarea clientului.', PlaybookStepType.CREATE_FOLLOW_UP],
      ['Adauga nota interna', 'Documenteaza cauza blocajului.', PlaybookStepType.ADD_NOTE],
      ['Inchide interventia cu outcome', 'Seteaza outcome si urmatorul pas.', PlaybookStepType.COMPLETE_INTERVENTION],
    ],
  },
  {
    key: 'TRIAL_ENDING_SOON_PLAYBOOK',
    name: 'Trial aproape de expirare',
    description: 'Pregateste activarea abonamentului inainte de expirarea trialului.',
    category: CustomerSuccessPlaybookCategory.ACTIVATION,
    triggerType: CustomerSuccessTriggerType.RISK_REASON,
    defaultPriority: ClientPriority.HIGH,
    recommendedFor: [ClientHealthRiskReason.TRIAL_ENDING_SOON],
    steps: [
      ['Verifica statusul trialului', 'Confirma trialEndsAt si statusul abonamentului.', PlaybookStepType.REVIEW_SUBSCRIPTION],
      ['Verifica usage-ul clientului', 'Uita-te la facturi, plati, request-uri si activitate.', PlaybookStepType.REVIEW_DATA],
      ['Verifica onboarding complet', 'Confirma ca clientul poate trece la activare.', PlaybookStepType.CHECK],
      ['Contacteaza clientul pentru activare', 'Inregistreaza discutia cu clientul.', PlaybookStepType.CONTACT_CLIENT],
      ['Creeaza follow-up inainte de expirare', 'Follow-up operational in CRM.', PlaybookStepType.CREATE_FOLLOW_UP],
      ['Creeaza task pentru plan/subscription', 'Task intern daca trebuie ajustat abonamentul.', PlaybookStepType.CREATE_TASK],
      ['Inchide interventia cu outcome', 'Seteaza concluzia.', PlaybookStepType.COMPLETE_INTERVENTION],
    ],
  },
  {
    key: 'SAAS_INVOICE_OVERDUE_PLAYBOOK',
    name: 'Factura SaaS restanta',
    description: 'Urmareste factura SaaS restanta fara a marca plata automat.',
    category: CustomerSuccessPlaybookCategory.BILLING,
    triggerType: CustomerSuccessTriggerType.RISK_REASON,
    defaultPriority: ClientPriority.HIGH,
    recommendedFor: [ClientHealthRiskReason.SAAS_INVOICE_OVERDUE],
    steps: [
      ['Verifica factura SaaS restanta', 'Deschide factura si soldul.', PlaybookStepType.REVIEW_SAAS_INVOICE],
      ['Verifica istoricul facturilor', 'Confirma daca exista restante multiple.', PlaybookStepType.REVIEW_SAAS_INVOICE],
      ['Contacteaza clientul', 'Inregistreaza metoda si concluzia.', PlaybookStepType.CONTACT_CLIENT],
      ['Creeaza follow-up pentru plata', 'Nu marcheaza factura ca platita.', PlaybookStepType.CREATE_FOLLOW_UP],
      ['Adauga nota interna', 'Documenteaza promisiunea/plata asteptata.', PlaybookStepType.ADD_NOTE],
      ['Actualizeaza risc client daca e cazul', 'Doar cu confirmare manuala.', PlaybookStepType.UPDATE_CLIENT_RISK],
      ['Inchide interventia', 'Seteaza outcome.', PlaybookStepType.COMPLETE_INTERVENTION],
    ],
  },
  {
    key: 'DATA_QUALITY_CRITICAL_PLAYBOOK',
    name: 'Probleme critice Data Quality',
    description: 'Ghideaza remedierea problemelor critice care pot bloca facturarea.',
    category: CustomerSuccessPlaybookCategory.DATA_QUALITY,
    triggerType: CustomerSuccessTriggerType.RISK_REASON,
    defaultPriority: ClientPriority.URGENT,
    recommendedFor: [ClientHealthRiskReason.CRITICAL_DATA_QUALITY_ISSUES],
    steps: [
      ['Deschide Data Quality Center', 'Identifica problemele deschise.', PlaybookStepType.REVIEW_DATA_QUALITY],
      ['Identifica problemele care blocheaza facturarea', 'Prioritizeaza blockers.', PlaybookStepType.REVIEW_DATA_QUALITY],
      ['Creeaza task pentru remediere', 'Task intern cu owner.', PlaybookStepType.CREATE_TASK],
      ['Porneste suport read-only daca este nevoie', 'Navigheaza catre support access, nu porni automat.', PlaybookStepType.START_SUPPORT_SESSION],
      ['Seteaza follow-up', 'Verifica remedierea.', PlaybookStepType.CREATE_FOLLOW_UP],
      ['Inchide cand problemele sunt rezolvate', 'Outcome obligatoriu.', PlaybookStepType.COMPLETE_INTERVENTION],
    ],
  },
  {
    key: 'LOW_USAGE_PLAYBOOK',
    name: 'Utilizare scazuta',
    description: 'Ajuta clientii care nu folosesc activ platforma.',
    category: CustomerSuccessPlaybookCategory.PRODUCT_USAGE,
    triggerType: CustomerSuccessTriggerType.RISK_REASON,
    defaultPriority: ClientPriority.NORMAL,
    recommendedFor: [ClientHealthRiskReason.LOW_ADMIN_ACTIVITY, ClientHealthRiskReason.NO_RECENT_LOGIN, ClientHealthRiskReason.NO_RECENT_INVOICES],
    steps: [
      ['Verifica ultima activitate Admin', 'Cauta semne de blocaj operational.', PlaybookStepType.CHECK],
      ['Verifica ultima facturare', 'Confirma daca au fost generate facturi recent.', PlaybookStepType.REVIEW_DATA],
      ['Verifica invitatii locatari', 'Portal access poate indica engagement.', PlaybookStepType.REVIEW_DATA],
      ['Contacteaza administratorul', 'Ofera ajutor de folosire.', PlaybookStepType.CONTACT_CLIENT],
      ['Creeaza follow-up', 'Revino dupa sesiunea de ajutor.', PlaybookStepType.CREATE_FOLLOW_UP],
      ['Actualizeaza risk status', 'Doar manual, daca e cazul.', PlaybookStepType.UPDATE_CLIENT_RISK],
    ],
  },
  {
    key: 'SUPPORT_ISSUE_PLAYBOOK',
    name: 'Problema suport client',
    description: 'Coordoneaza rezolvarea problemelor de suport deschise.',
    category: CustomerSuccessPlaybookCategory.SUPPORT,
    triggerType: CustomerSuccessTriggerType.RISK_REASON,
    defaultPriority: ClientPriority.HIGH,
    recommendedFor: [ClientHealthRiskReason.OPEN_SUPPORT_ISSUES],
    steps: [
      ['Verifica problema cunoscuta', 'Deschide known issues si contextul clientului.', PlaybookStepType.REVIEW_SUPPORT_SESSION],
      ['Verifica sesiunile de suport recente', 'Cauta istoric si note.', PlaybookStepType.REVIEW_SUPPORT_SESSION],
      ['Creeaza task intern', 'Definește owner si termen.', PlaybookStepType.CREATE_TASK],
      ['Adauga nota cu pasii urmatori', 'Documenteaza decizia operationala.', PlaybookStepType.ADD_NOTE],
      ['Seteaza follow-up', 'Revino la client.', PlaybookStepType.CREATE_FOLLOW_UP],
      ['Inchide cand problema este rezolvata', 'Outcome si note.', PlaybookStepType.COMPLETE_INTERVENTION],
    ],
  },
  {
    key: 'SUBSCRIPTION_SUSPENDED_PLAYBOOK',
    name: 'Abonament suspendat',
    description: 'Clarifica suspendarea si urmatorii pasi comerciali.',
    category: CustomerSuccessPlaybookCategory.SUBSCRIPTION,
    triggerType: CustomerSuccessTriggerType.RISK_REASON,
    defaultPriority: ClientPriority.URGENT,
    recommendedFor: [ClientHealthRiskReason.SUBSCRIPTION_SUSPENDED],
    steps: [
      ['Verifica motivul suspendarii', 'Deschide abonamentul SaaS.', PlaybookStepType.REVIEW_SUBSCRIPTION],
      ['Verifica facturi SaaS restante', 'Nu modifica facturile.', PlaybookStepType.REVIEW_SAAS_INVOICE],
      ['Contacteaza clientul', 'Inregistreaza discutia.', PlaybookStepType.CONTACT_CLIENT],
      ['Creeaza task pentru reactivare sau inchidere', 'Task intern, fara schimbare automata.', PlaybookStepType.CREATE_TASK],
      ['Marcheaza outcome', 'Seteaza concluzia interventiei.', PlaybookStepType.COMPLETE_INTERVENTION],
    ],
  },
  {
    key: 'NO_OWNER_ASSIGNED_PLAYBOOK',
    name: 'Client fara responsabil',
    description: 'Asigneaza ownership intern si urmatorul follow-up.',
    category: CustomerSuccessPlaybookCategory.RETENTION,
    triggerType: CustomerSuccessTriggerType.RISK_REASON,
    defaultPriority: ClientPriority.NORMAL,
    recommendedFor: [ClientHealthRiskReason.NO_OWNER_ASSIGNED],
    steps: [
      ['Asigneaza owner intern', 'Seteaza responsabilul in Client Lifecycle.', PlaybookStepType.CHECK],
      ['Creeaza follow-up initial', 'Stabileste urmatoarea verificare.', PlaybookStepType.CREATE_FOLLOW_UP],
      ['Adauga nota interna', 'Documenteaza ownership-ul.', PlaybookStepType.ADD_NOTE],
      ['Actualizeaza pipeline client', 'Confirma etapa curenta.', PlaybookStepType.UPDATE_CLIENT_STAGE],
    ],
  },
];

@Injectable()
export class CustomerSuccessService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard() {
    await this.ensureSystemPlaybooks();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [open, inProgress, overdue, atRisk, playbooks, actions, completed, recommendations, interventions] = await Promise.all([
      this.prisma.clientIntervention.count({ where: { status: ClientInterventionStatus.OPEN } }),
      this.prisma.clientIntervention.count({ where: { status: ClientInterventionStatus.IN_PROGRESS } }),
      this.prisma.clientIntervention.count({ where: { status: { in: [ClientInterventionStatus.OPEN, ClientInterventionStatus.IN_PROGRESS, ClientInterventionStatus.WAITING_CLIENT, ClientInterventionStatus.WAITING_INTERNAL] }, dueAt: { lt: now } } }),
      this.prisma.clientHealthSnapshot.count({ where: { status: { in: ['AT_RISK', 'CRITICAL'] as any } } }).catch(() => 0),
      this.prisma.customerSuccessPlaybook.count({ where: { status: CustomerSuccessPlaybookStatus.ACTIVE } }),
      this.prisma.clientHealthAction.count({ where: { status: { in: [ClientHealthActionStatus.SUGGESTED, ClientHealthActionStatus.ACCEPTED] } } }).catch(() => 0),
      this.prisma.clientIntervention.count({ where: { status: ClientInterventionStatus.COMPLETED, completedAt: { gte: monthStart } } }),
      this.recommendations(),
      this.prisma.clientIntervention.findMany({ where: { status: { in: [ClientInterventionStatus.OPEN, ClientInterventionStatus.IN_PROGRESS, ClientInterventionStatus.WAITING_CLIENT, ClientInterventionStatus.WAITING_INTERNAL] } }, include: { clientAccount: true, playbook: true }, orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }], take: 10 }),
    ]);
    return { summary: { open, inProgress, overdue, atRisk, playbooks, actions, completedThisMonth: completed }, recommendedInterventions: recommendations.items.slice(0, 8), activeInterventions: interventions };
  }

  async playbooks(query: Record<string, string | undefined>) {
    await this.ensureSystemPlaybooks();
    const search = query.search?.trim();
    const items = await this.prisma.customerSuccessPlaybook.findMany({
      where: {
        ...(query.status ? { status: query.status as CustomerSuccessPlaybookStatus } : {}),
        ...(query.category ? { category: query.category as CustomerSuccessPlaybookCategory } : {}),
        ...(query.triggerType ? { triggerType: query.triggerType as CustomerSuccessTriggerType } : {}),
        ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { key: { contains: search, mode: 'insensitive' } }, { description: { contains: search, mode: 'insensitive' } }] } : {}),
      },
      include: { steps: { orderBy: { sortOrder: 'asc' } }, _count: { select: { interventions: true } } },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      take: 200,
    });
    return { items };
  }

  async createPlaybook(dto: CreateCustomerSuccessPlaybookDto, actor: any) {
    this.assertSteps(dto.steps || []);
    const playbook = await this.prisma.customerSuccessPlaybook.create({
      data: {
        key: dto.key.trim().toUpperCase(),
        name: dto.name,
        description: dto.description,
        category: dto.category,
        status: dto.status || CustomerSuccessPlaybookStatus.DRAFT,
        triggerType: dto.triggerType || CustomerSuccessTriggerType.MANUAL,
        triggerConfig: this.json(dto.triggerConfig),
        recommendedFor: this.json(dto.recommendedFor),
        defaultPriority: dto.defaultPriority || ClientPriority.NORMAL,
        estimatedDurationMinutes: dto.estimatedDurationMinutes || null,
        createdById: actor?.id || null,
      },
    });
    await this.replaceSteps(playbook.id, dto.steps || []);
    return this.playbook(playbook.id);
  }

  async playbook(id: string) {
    await this.ensureSystemPlaybooks();
    const playbook = await this.prisma.customerSuccessPlaybook.findUnique({
      where: { id },
      include: { steps: { orderBy: { sortOrder: 'asc' } }, interventions: { include: { clientAccount: true }, orderBy: { createdAt: 'desc' }, take: 10 } },
    });
    if (!playbook) throw new NotFoundException('Playbook not found');
    return playbook;
  }

  async updatePlaybook(id: string, dto: UpdateCustomerSuccessPlaybookDto, actor: any) {
    const existing = await this.prisma.customerSuccessPlaybook.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Playbook not found');
    const playbook = await this.prisma.customerSuccessPlaybook.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        category: dto.category,
        status: dto.status,
        triggerType: dto.triggerType,
        triggerConfig: dto.triggerConfig === undefined ? undefined : this.json(dto.triggerConfig),
        recommendedFor: dto.recommendedFor === undefined ? undefined : this.json(dto.recommendedFor),
        defaultPriority: dto.defaultPriority,
        estimatedDurationMinutes: dto.estimatedDurationMinutes,
        updatedById: actor?.id || null,
      },
    });
    if (dto.steps?.length) await this.replaceSteps(id, dto.steps);
    return this.playbook(playbook.id);
  }

  async archivePlaybook(id: string) {
    return this.prisma.customerSuccessPlaybook.update({ where: { id }, data: { status: CustomerSuccessPlaybookStatus.ARCHIVED } });
  }

  async duplicatePlaybook(id: string, actor: any) {
    const source = await this.playbook(id);
    const copy = await this.prisma.customerSuccessPlaybook.create({ data: {
      key: `${source.key}_COPY_${Date.now()}`,
      name: `${source.name} copy`,
      description: source.description,
      category: source.category,
      status: CustomerSuccessPlaybookStatus.DRAFT,
      triggerType: source.triggerType,
      triggerConfig: source.triggerConfig as Prisma.InputJsonValue,
      recommendedFor: source.recommendedFor as Prisma.InputJsonValue,
      defaultPriority: source.defaultPriority,
      estimatedDurationMinutes: source.estimatedDurationMinutes,
      createdById: actor?.id || null,
    } });
    await this.prisma.customerSuccessPlaybookStep.createMany({ data: source.steps.map((step) => ({ playbookId: copy.id, sortOrder: step.sortOrder, title: step.title, description: step.description, stepType: step.stepType, required: step.required, actionConfig: step.actionConfig as Prisma.InputJsonValue, expectedOutcome: step.expectedOutcome })) });
    return this.playbook(copy.id);
  }

  async startFromPlaybook(id: string, dto: StartInterventionDto, actor: any) {
    return this.createIntervention({ ...dto, playbookId: id }, actor);
  }

  async interventions(query: Record<string, string | undefined>) {
    const search = query.search?.trim();
    const now = new Date();
    const items = await this.prisma.clientIntervention.findMany({
      where: {
        ...(query.status ? { status: query.status as ClientInterventionStatus } : {}),
        ...(query.priority ? { priority: query.priority as ClientPriority } : {}),
        ...(query.playbookId ? { playbookId: query.playbookId } : {}),
        ...(query.clientAccountId ? { clientAccountId: query.clientAccountId } : {}),
        ...(query.triggerReason ? { triggerReason: query.triggerReason } : {}),
        ...(query.overdueOnly === 'true' ? { dueAt: { lt: now }, status: { in: [ClientInterventionStatus.OPEN, ClientInterventionStatus.IN_PROGRESS, ClientInterventionStatus.WAITING_CLIENT, ClientInterventionStatus.WAITING_INTERNAL] } } : {}),
        ...(search ? { OR: [{ title: { contains: search, mode: 'insensitive' } }, { description: { contains: search, mode: 'insensitive' } }, { clientAccount: { displayName: { contains: search, mode: 'insensitive' } } }] } : {}),
      },
      include: { clientAccount: true, playbook: true, steps: true },
      orderBy: [{ status: 'asc' }, { priority: 'desc' }, { updatedAt: 'desc' }],
      take: 200,
    });
    return { items: items.map((item) => ({ ...item, progress: this.progress(item.steps) })) };
  }

  async createIntervention(dto: CreateInterventionDto, actor: any) {
    const [client, playbook] = await Promise.all([
      this.prisma.clientAccount.findUnique({ where: { id: dto.clientAccountId } }),
      this.prisma.customerSuccessPlaybook.findUnique({ where: { id: dto.playbookId }, include: { steps: { orderBy: { sortOrder: 'asc' } } } }),
    ]);
    if (!client) throw new NotFoundException('Client not found');
    if (!playbook || playbook.status === CustomerSuccessPlaybookStatus.ARCHIVED) throw new NotFoundException('Active playbook not found');
    const duplicate = await this.prisma.clientIntervention.findFirst({ where: { clientAccountId: client.id, playbookId: playbook.id, triggerReason: dto.triggerReason || null, status: { in: [ClientInterventionStatus.OPEN, ClientInterventionStatus.IN_PROGRESS, ClientInterventionStatus.WAITING_CLIENT, ClientInterventionStatus.WAITING_INTERNAL] } } });
    if (duplicate) return this.intervention(duplicate.id);
    const intervention = await this.prisma.clientIntervention.create({ data: {
      clientAccountId: client.id,
      associationId: client.associationId,
      playbookId: playbook.id,
      status: ClientInterventionStatus.OPEN,
      priority: dto.priority || playbook.defaultPriority,
      title: playbook.name,
      description: dto.description || playbook.description,
      triggerType: dto.triggerReason ? CustomerSuccessTriggerType.RISK_REASON : playbook.triggerType,
      triggerReason: dto.triggerReason || null,
      healthSnapshotId: dto.healthSnapshotId || null,
      assignedToId: dto.assignedToId || null,
      startedById: actor?.id || 'system',
      dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
    } });
    await this.prisma.clientInterventionStep.createMany({ data: playbook.steps.map((step) => ({ interventionId: intervention.id, playbookStepId: step.id, sortOrder: step.sortOrder, title: step.title, description: step.description, stepType: step.stepType, required: step.required, actionConfig: step.actionConfig as Prisma.InputJsonValue })) });
    await this.event(intervention.id, client.id, actor?.id, ClientInterventionEventType.INTERVENTION_STARTED, 'Interventie pornita', playbook.name, { triggerReason: dto.triggerReason });
    return this.intervention(intervention.id);
  }

  async intervention(id: string) {
    const intervention = await this.prisma.clientIntervention.findUnique({ where: { id }, include: { clientAccount: true, playbook: true, steps: { orderBy: { sortOrder: 'asc' } }, events: { orderBy: { createdAt: 'desc' }, take: 50 } } });
    if (!intervention) throw new NotFoundException('Intervention not found');
    return { intervention, client: intervention.clientAccount, playbook: intervention.playbook, steps: intervention.steps, events: intervention.events, progress: this.progress(intervention.steps) };
  }

  async updateIntervention(id: string, dto: UpdateInterventionDto, actor: any) {
    const intervention = await this.prisma.clientIntervention.update({ where: { id }, data: { status: dto.status, priority: dto.priority, assignedToId: dto.assignedToId, dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined } });
    await this.event(id, intervention.clientAccountId, actor?.id, ClientInterventionEventType.INTERVENTION_STATUS_CHANGED, 'Interventie actualizata', intervention.status);
    return this.intervention(id);
  }

  async completeIntervention(id: string, dto: CompleteInterventionDto, actor: any) {
    const current = await this.prisma.clientIntervention.findUnique({ where: { id }, include: { steps: true } });
    if (!current) throw new NotFoundException('Intervention not found');
    const doneStatuses: PlaybookStepStatus[] = [PlaybookStepStatus.COMPLETED, PlaybookStepStatus.SKIPPED];
    const missing = current.steps.filter((step) => step.required && !doneStatuses.includes(step.status));
    if (missing.length) throw new BadRequestException('Required steps must be completed or skipped with reason.');
    const intervention = await this.prisma.clientIntervention.update({ where: { id }, data: { status: ClientInterventionStatus.COMPLETED, outcome: dto.outcome, outcomeNotes: dto.outcomeNotes || null, completedAt: new Date(), completedById: actor?.id || null } });
    await this.event(id, intervention.clientAccountId, actor?.id, ClientInterventionEventType.INTERVENTION_COMPLETED, 'Interventie finalizata', dto.outcome, { outcomeNotes: dto.outcomeNotes });
    return this.intervention(id);
  }

  async cancelIntervention(id: string, dto: CancelInterventionDto, actor: any) {
    const intervention = await this.prisma.clientIntervention.update({ where: { id }, data: { status: ClientInterventionStatus.CANCELLED, cancelledAt: new Date(), cancelledById: actor?.id || null, cancellationReason: dto.reason } });
    await this.event(id, intervention.clientAccountId, actor?.id, ClientInterventionEventType.INTERVENTION_CANCELLED, 'Interventie anulata', dto.reason);
    return intervention;
  }

  async events(id: string) {
    return { items: await this.prisma.clientInterventionEvent.findMany({ where: { interventionId: id }, orderBy: { createdAt: 'desc' } }) };
  }

  async stepStatus(interventionId: string, stepId: string, status: PlaybookStepStatus, dto: StepReasonDto, actor: any) {
    const step = await this.ensureStep(interventionId, stepId);
    const data: Prisma.ClientInterventionStepUpdateInput = { status };
    if (status === PlaybookStepStatus.COMPLETED) Object.assign(data, { completedAt: new Date(), completedById: actor?.id || null, result: this.json(dto.result) });
    if (status === PlaybookStepStatus.SKIPPED) {
      if (!dto.reason) throw new BadRequestException('Motivul este obligatoriu pentru skip.');
      Object.assign(data, { skippedAt: new Date(), skippedById: actor?.id || null, skipReason: dto.reason });
    }
    if (status === PlaybookStepStatus.BLOCKED) Object.assign(data, { blockedReason: dto.reason || 'Blocked' });
    const updated = await this.prisma.clientInterventionStep.update({ where: { id: step.id }, data });
    const eventType = status === PlaybookStepStatus.COMPLETED ? ClientInterventionEventType.STEP_COMPLETED : status === PlaybookStepStatus.SKIPPED ? ClientInterventionEventType.STEP_SKIPPED : status === PlaybookStepStatus.BLOCKED ? ClientInterventionEventType.STEP_BLOCKED : ClientInterventionEventType.STEP_STARTED;
    const intervention = await this.prisma.clientIntervention.findUnique({ where: { id: interventionId } });
    await this.event(interventionId, intervention!.clientAccountId, actor?.id, eventType, updated.title, status, { reason: dto.reason });
    if (status === PlaybookStepStatus.IN_PROGRESS) await this.prisma.clientIntervention.update({ where: { id: interventionId }, data: { status: ClientInterventionStatus.IN_PROGRESS } });
    return updated;
  }

  async stepCreateTask(interventionId: string, stepId: string, dto: StepCreateTaskDto, actor: any) {
    const { step, intervention } = await this.stepAndIntervention(interventionId, stepId);
    const dueAt = dto.dueAt ? new Date(dto.dueAt) : this.dueFromConfig(step.actionConfig, 1);
    const task = await this.prisma.clientTask.create({ data: { clientAccountId: intervention.clientAccountId, associationId: intervention.associationId, title: dto.title || step.title, description: step.description, priority: intervention.priority, category: this.taskCategory(step), status: ClientTaskStatus.OPEN, dueAt, createdById: actor?.id || null, source: ClientTaskSource.SYSTEM, relatedEntityType: 'CLIENT_INTERVENTION', relatedEntityId: intervention.id } });
    await this.prisma.clientInterventionStep.update({ where: { id: stepId }, data: { relatedTaskId: task.id, status: PlaybookStepStatus.COMPLETED, completedAt: new Date(), completedById: actor?.id || null } });
    await this.event(interventionId, intervention.clientAccountId, actor?.id, ClientInterventionEventType.TASK_CREATED, 'Task creat', task.title, { taskId: task.id, stepId });
    return task;
  }

  async stepCreateFollowUp(interventionId: string, stepId: string, dto: StepCreateFollowUpDto, actor: any) {
    const { step, intervention } = await this.stepAndIntervention(interventionId, stepId);
    const dueAt = dto.dueAt ? new Date(dto.dueAt) : this.dueFromConfig(step.actionConfig, 1);
    const followUp = await this.prisma.clientFollowUp.create({ data: { clientAccountId: intervention.clientAccountId, associationId: intervention.associationId, title: dto.title || step.title, description: step.description, dueAt, priority: intervention.priority, createdById: actor?.id || null, source: 'SYSTEM' as any, relatedEntityType: 'CLIENT_INTERVENTION', relatedEntityId: intervention.id } });
    await this.prisma.clientAccount.update({ where: { id: intervention.clientAccountId }, data: { nextFollowUpAt: dueAt } }).catch(() => undefined);
    await this.prisma.clientInterventionStep.update({ where: { id: stepId }, data: { relatedFollowUpId: followUp.id, status: PlaybookStepStatus.COMPLETED, completedAt: new Date(), completedById: actor?.id || null } });
    await this.event(interventionId, intervention.clientAccountId, actor?.id, ClientInterventionEventType.FOLLOW_UP_CREATED, 'Follow-up creat', followUp.title, { followUpId: followUp.id, stepId });
    return followUp;
  }

  async stepAddNote(interventionId: string, stepId: string, dto: StepAddNoteDto, actor: any) {
    const { step, intervention } = await this.stepAndIntervention(interventionId, stepId);
    const note = await this.prisma.clientKnowledgeItem.create({ data: { clientAccountId: intervention.clientAccountId, associationId: intervention.associationId, type: ClientKnowledgeItemType.NOTE, category: ClientKnowledgeCategory.SUPPORT, status: ClientKnowledgeStatus.ACTIVE, visibility: ClientKnowledgeVisibility.INTERNAL_SUPERADMIN, priority: this.knowledgePriority(intervention.priority), title: dto.title || step.title, content: dto.content, isPinned: false, relatedEntityType: 'CLIENT_INTERVENTION', relatedEntityId: intervention.id, createdById: actor?.id || 'system' } });
    await this.prisma.clientInterventionStep.update({ where: { id: stepId }, data: { relatedNoteId: note.id, status: PlaybookStepStatus.COMPLETED, completedAt: new Date(), completedById: actor?.id || null } });
    await this.event(interventionId, intervention.clientAccountId, actor?.id, ClientInterventionEventType.NOTE_ADDED, 'Nota adaugata', note.title, { noteId: note.id, stepId });
    return note;
  }

  async recordContact(interventionId: string, stepId: string, dto: RecordContactDto, actor: any) {
    const { intervention } = await this.stepAndIntervention(interventionId, stepId);
    if (dto.nextFollowUpAt) {
      await this.prisma.clientFollowUp.create({ data: { clientAccountId: intervention.clientAccountId, associationId: intervention.associationId, title: 'Follow-up dupa contact client', description: dto.summary, dueAt: new Date(dto.nextFollowUpAt), priority: intervention.priority, createdById: actor?.id || null, source: 'SYSTEM' as any, relatedEntityType: 'CLIENT_INTERVENTION', relatedEntityId: intervention.id } });
    }
    await this.prisma.clientInterventionStep.update({ where: { id: stepId }, data: { status: PlaybookStepStatus.COMPLETED, completedAt: new Date(), completedById: actor?.id || null, result: this.json(dto) } });
    await this.event(interventionId, intervention.clientAccountId, actor?.id, ClientInterventionEventType.CLIENT_CONTACT_RECORDED, 'Contact client inregistrat', dto.summary, { method: dto.method, contactedAt: dto.contactedAt });
    return { success: true };
  }

  async recommendations() {
    await this.ensureSystemPlaybooks();
    const actions = await this.prisma.clientHealthAction.findMany({ where: { status: { in: [ClientHealthActionStatus.SUGGESTED, ClientHealthActionStatus.ACCEPTED] } }, include: { clientAccount: true }, orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }], take: 100 });
    const playbooks = await this.prisma.customerSuccessPlaybook.findMany({ where: { status: CustomerSuccessPlaybookStatus.ACTIVE } });
    const items = [];
    for (const action of actions) {
      const playbook = this.findPlaybookForRisk(playbooks, action.riskReason);
      if (!playbook) continue;
      const active = await this.prisma.clientIntervention.findFirst({ where: { clientAccountId: action.clientAccountId, playbookId: playbook.id, triggerReason: action.riskReason, status: { in: [ClientInterventionStatus.OPEN, ClientInterventionStatus.IN_PROGRESS, ClientInterventionStatus.WAITING_CLIENT, ClientInterventionStatus.WAITING_INTERNAL] } } });
      items.push({ id: action.id, client: action.clientAccount, riskReason: action.riskReason, priority: action.priority, recommendedPlaybook: playbook, message: action.description, alreadyHasActiveIntervention: Boolean(active) });
    }
    return { items };
  }

  async startRecommendation(actionId: string, actor: any) {
    const action = await this.prisma.clientHealthAction.findUnique({ where: { id: actionId } });
    if (!action) throw new NotFoundException('Recommendation not found');
    const playbooks = await this.prisma.customerSuccessPlaybook.findMany({ where: { status: CustomerSuccessPlaybookStatus.ACTIVE } });
    const playbook = this.findPlaybookForRisk(playbooks, action.riskReason);
    if (!playbook) throw new NotFoundException('Recommended playbook not found');
    const intervention = await this.createIntervention({ clientAccountId: action.clientAccountId, playbookId: playbook.id, priority: action.priority, triggerReason: action.riskReason }, actor);
    await this.prisma.clientHealthAction.update({ where: { id: action.id }, data: { status: ClientHealthActionStatus.ACCEPTED, acceptedById: actor?.id || null } }).catch(() => undefined);
    return intervention;
  }

  async dismissRecommendation(actionId: string, actor: any) {
    return this.prisma.clientHealthAction.update({ where: { id: actionId }, data: { status: ClientHealthActionStatus.DISMISSED, dismissedById: actor?.id || null, dismissedReason: 'Dismissed from customer success recommendations' } });
  }

  async createTaskFromRecommendation(actionId: string, actor: any) {
    const action = await this.prisma.clientHealthAction.findUnique({ where: { id: actionId } });
    if (!action) throw new NotFoundException('Recommendation not found');
    const task = await this.prisma.clientTask.create({ data: { clientAccountId: action.clientAccountId, associationId: action.associationId, title: action.title, description: action.description, priority: action.priority, category: ClientTaskCategory.GENERAL, status: ClientTaskStatus.OPEN, dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000), createdById: actor?.id || null, source: ClientTaskSource.SYSTEM, relatedEntityType: 'CLIENT_HEALTH_ACTION', relatedEntityId: action.id } });
    return this.prisma.clientHealthAction.update({ where: { id: action.id }, data: { status: ClientHealthActionStatus.ACCEPTED, acceptedById: actor?.id || null, relatedTaskId: task.id } });
  }

  private async ensureSystemPlaybooks() {
    for (const definition of SYSTEM_PLAYBOOKS) {
      const playbook = await this.prisma.customerSuccessPlaybook.upsert({
        where: { key: definition.key },
        create: { key: definition.key, name: definition.name, description: definition.description, category: definition.category, status: CustomerSuccessPlaybookStatus.ACTIVE, triggerType: definition.triggerType, recommendedFor: definition.recommendedFor as Prisma.InputJsonValue, defaultPriority: definition.defaultPriority, isSystem: true },
        update: { name: definition.name, description: definition.description, category: definition.category, status: CustomerSuccessPlaybookStatus.ACTIVE, triggerType: definition.triggerType, recommendedFor: definition.recommendedFor as Prisma.InputJsonValue, defaultPriority: definition.defaultPriority, isSystem: true },
      });
      const count = await this.prisma.customerSuccessPlaybookStep.count({ where: { playbookId: playbook.id } });
      if (count === 0) {
        await this.prisma.customerSuccessPlaybookStep.createMany({ data: definition.steps.map((step, index) => ({ playbookId: playbook.id, sortOrder: index + 1, title: step[0] as string, description: step[1] as string, stepType: step[2] as PlaybookStepType, required: true, actionConfig: this.defaultActionConfig(step[2] as PlaybookStepType) })) });
      }
    }
  }

  private async replaceSteps(playbookId: string, steps: any[]) {
    this.assertSteps(steps);
    const existing = await this.prisma.customerSuccessPlaybookStep.findMany({ where: { playbookId }, orderBy: { sortOrder: 'asc' } });
    for (const [index, step] of steps.entries()) {
      const data = {
        sortOrder: step.sortOrder || index + 1,
        title: step.title,
        description: step.description,
        stepType: step.stepType,
        required: step.required !== false,
        actionConfig: this.json(step.actionConfig),
        expectedOutcome: step.expectedOutcome || null,
      };
      if (existing[index]) await this.prisma.customerSuccessPlaybookStep.update({ where: { id: existing[index].id }, data });
      else await this.prisma.customerSuccessPlaybookStep.create({ data: { playbookId, ...data } });
    }
  }

  private assertSteps(steps: any[]) {
    if (!steps.length) throw new BadRequestException('Playbook-ul trebuie sa aiba cel putin un pas.');
  }

  private async ensureStep(interventionId: string, stepId: string) {
    const step = await this.prisma.clientInterventionStep.findFirst({ where: { id: stepId, interventionId } });
    if (!step) throw new NotFoundException('Step not found');
    return step;
  }

  private async stepAndIntervention(interventionId: string, stepId: string) {
    const [step, intervention] = await Promise.all([this.ensureStep(interventionId, stepId), this.prisma.clientIntervention.findUnique({ where: { id: interventionId } })]);
    if (!intervention) throw new NotFoundException('Intervention not found');
    return { step, intervention };
  }

  private async event(interventionId: string, clientAccountId: string, actorUserId: string | null | undefined, eventType: ClientInterventionEventType, title: string, message: string, metadata?: unknown) {
    await this.prisma.clientInterventionEvent.create({ data: { interventionId, clientAccountId, actorUserId: actorUserId || null, eventType, title, message, metadata: this.json(metadata) } });
  }

  private progress(steps: Array<{ status: PlaybookStepStatus; required: boolean }>) {
    const totalSteps = steps.length;
    const completedSteps = steps.filter((step) => step.status === PlaybookStepStatus.COMPLETED || step.status === PlaybookStepStatus.SKIPPED).length;
    const doneStatuses: PlaybookStepStatus[] = [PlaybookStepStatus.COMPLETED, PlaybookStepStatus.SKIPPED];
    const requiredRemaining = steps.filter((step) => step.required && !doneStatuses.includes(step.status)).length;
    return { totalSteps, completedSteps, requiredRemaining, percent: totalSteps ? Math.round((completedSteps / totalSteps) * 100) : 0 };
  }

  private findPlaybookForRisk(playbooks: any[], riskReason: ClientHealthRiskReason | string) {
    return playbooks.find((playbook) => Array.isArray(playbook.recommendedFor) && playbook.recommendedFor.includes(riskReason));
  }

  private taskCategory(step: any) {
    const config = step.actionConfig as any;
    if (config?.taskCategory && Object.values(ClientTaskCategory).includes(config.taskCategory)) return config.taskCategory;
    if (step.stepType === PlaybookStepType.REVIEW_SAAS_INVOICE) return ClientTaskCategory.SAAS_INVOICE;
    if (step.stepType === PlaybookStepType.REVIEW_SUBSCRIPTION) return ClientTaskCategory.SUBSCRIPTION;
    if (step.stepType === PlaybookStepType.REVIEW_DATA_QUALITY) return ClientTaskCategory.GENERAL;
    return ClientTaskCategory.GENERAL;
  }

  private dueFromConfig(config: unknown, fallbackDays: number) {
    const days = Number((config as any)?.dueInDays || fallbackDays);
    return new Date(Date.now() + Math.max(0, days) * 24 * 60 * 60 * 1000);
  }

  private defaultActionConfig(stepType: PlaybookStepType) {
    if (stepType === PlaybookStepType.CREATE_TASK) return { taskCategory: ClientTaskCategory.GENERAL, taskPriority: ClientPriority.HIGH, dueInDays: 1 } as Prisma.InputJsonValue;
    if (stepType === PlaybookStepType.CREATE_FOLLOW_UP) return { dueInDays: 1 } as Prisma.InputJsonValue;
    return undefined;
  }

  private knowledgePriority(priority: ClientPriority) {
    if (priority === ClientPriority.URGENT) return ClientKnowledgePriority.CRITICAL;
    if (priority === ClientPriority.HIGH) return ClientKnowledgePriority.HIGH;
    if (priority === ClientPriority.LOW) return ClientKnowledgePriority.LOW;
    return ClientKnowledgePriority.NORMAL;
  }

  private json(value: unknown) {
    if (value === undefined) return undefined;
    if (value === null) return null;
    return value as Prisma.InputJsonValue;
  }
}
