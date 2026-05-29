import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ContractPricingModel,
  OrganizationContractStatus,
  OrganizationLaunchStatus,
  OrganizationSubscriptionStatus,
  Prisma,
  SuperadminBillingTaskPriority,
  SuperadminBillingTaskSource,
  SuperadminBillingTaskStatus,
  SuperadminBillingTaskType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { MvpUser } from '../security/mvp-auth.guard';

type BillingTaskCandidate = {
  organizationId: string;
  organizationName: string;
  title: string;
  description?: string | null;
  type: SuperadminBillingTaskType;
  priority: SuperadminBillingTaskPriority;
  dueDate?: Date | null;
  relatedContractId?: string | null;
  relatedSubscriptionId?: string | null;
};

const ACTIVE_TASK_STATUSES = [SuperadminBillingTaskStatus.OPEN, SuperadminBillingTaskStatus.IN_PROGRESS] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class SuperadminBillingTasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: Record<string, string | undefined>) {
    const page = this.positiveInt(query.page, 1);
    const limit = Math.min(this.positiveInt(query.limit, 20), 100);
    const where = this.listWhere(query);

    const [items, total, statusGroups, priorityGroups, summary] = await Promise.all([
      this.prisma.superadminBillingTask.findMany({
        where,
        orderBy: [{ status: 'asc' }, { priority: 'desc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: this.taskInclude(),
      }),
      this.prisma.superadminBillingTask.count({ where }),
      this.prisma.superadminBillingTask.groupBy({ by: ['status'], where, _count: { _all: true } }),
      this.prisma.superadminBillingTask.groupBy({ by: ['priority'], where, _count: { _all: true } }),
      this.summary(where),
    ]);

    return {
      items: items.map((task) => this.toTask(task)),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      countsByStatus: this.countMap(statusGroups, 'status'),
      countsByPriority: this.countMap(priorityGroups, 'priority'),
      summary,
    };
  }

  async createManualTask(user: MvpUser, body: unknown) {
    const payload = this.objectPayload(body);
    const title = this.requiredString(payload.title, 'Titlul taskului este obligatoriu.');
    const organizationId = this.nullableString(payload.organizationId);
    if (organizationId) await this.ensureOrganization(organizationId);

    const task = await this.prisma.superadminBillingTask.create({
      data: {
        organizationId,
        title,
        description: this.nullableString(payload.description),
        type: this.enumValue(payload.type, SuperadminBillingTaskType, SuperadminBillingTaskType.OTHER, 'Tipul taskului nu este valid.'),
        priority: this.enumValue(payload.priority, SuperadminBillingTaskPriority, SuperadminBillingTaskPriority.NORMAL, 'Prioritatea nu este validă.'),
        dueDate: this.optionalDate(payload.dueDate, 'Scadența nu este validă.'),
        source: SuperadminBillingTaskSource.MANUAL,
        assignedToId: this.nullableString(payload.assignedToId),
        internalNote: this.nullableString(payload.internalNote),
      },
      include: this.taskInclude(),
    });

    await this.writeAudit(user, task, 'BILLING_TASK_CREATED');
    return this.toTask(task);
  }

  async updateTask(user: MvpUser, id: string, body: unknown) {
    const existing = await this.ensureTask(id);
    const payload = this.objectPayload(body);
    const status = payload.status === undefined ? undefined : this.enumValue(payload.status, SuperadminBillingTaskStatus, existing.status, 'Statusul taskului nu este valid.');
    const data: Prisma.SuperadminBillingTaskUpdateInput = {};

    if (payload.title !== undefined) data.title = this.requiredString(payload.title, 'Titlul taskului este obligatoriu.');
    if (payload.description !== undefined) data.description = this.nullableString(payload.description);
    if (payload.priority !== undefined) data.priority = this.enumValue(payload.priority, SuperadminBillingTaskPriority, existing.priority, 'Prioritatea nu este validă.');
    if (payload.dueDate !== undefined) data.dueDate = this.optionalDate(payload.dueDate, 'Scadența nu este validă.');
    if (payload.assignedToId !== undefined) data.assignedTo = this.nullableString(payload.assignedToId) ? { connect: { id: this.nullableString(payload.assignedToId)! } } : { disconnect: true };
    if (payload.internalNote !== undefined) data.internalNote = this.nullableString(payload.internalNote);
    if (status) {
      data.status = status;
      if (status === SuperadminBillingTaskStatus.DONE) {
        data.completedAt = new Date();
        data.completedBy = { connect: { id: user.id } };
      }
      if (status === SuperadminBillingTaskStatus.DISMISSED) {
        data.dismissedAt = new Date();
        data.dismissedBy = { connect: { id: user.id } };
      }
    }

    const task = await this.prisma.superadminBillingTask.update({
      where: { id },
      data,
      include: this.taskInclude(),
    });
    await this.writeAudit(user, task, 'BILLING_TASK_UPDATED');
    return this.toTask(task);
  }

  async completeTask(user: MvpUser, id: string) {
    await this.ensureTask(id);
    const task = await this.prisma.superadminBillingTask.update({
      where: { id },
      data: {
        status: SuperadminBillingTaskStatus.DONE,
        completedAt: new Date(),
        completedById: user.id,
      },
      include: this.taskInclude(),
    });
    await this.writeAudit(user, task, 'BILLING_TASK_COMPLETED');
    return this.toTask(task);
  }

  async dismissTask(user: MvpUser, id: string) {
    await this.ensureTask(id);
    const task = await this.prisma.superadminBillingTask.update({
      where: { id },
      data: {
        status: SuperadminBillingTaskStatus.DISMISSED,
        dismissedAt: new Date(),
        dismissedById: user.id,
      },
      include: this.taskInclude(),
    });
    await this.writeAudit(user, task, 'BILLING_TASK_DISMISSED');
    return this.toTask(task);
  }

  async generateAutomaticTasks(user: MvpUser) {
    const organizations = await this.prisma.organization.findMany({
      where: { isDemo: false },
      select: {
        id: true,
        name: true,
        city: true,
        fiscalCode: true,
        launchStatus: true,
        commercialContracts: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            status: true,
            endDate: true,
            pricingModel: true,
            pricePerApartment: true,
            fixedMonthlyPrice: true,
          },
        },
        subscriptionContracts: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            status: true,
            planName: true,
            price: true,
            trialEndDate: true,
            nextBillingDate: true,
          },
        },
      },
    });

    const candidates = organizations.flatMap((organization) => this.candidatesForOrganization(organization as any));
    const created: any[] = [];
    let kept = 0;

    for (const candidate of candidates) {
      const existing = await this.prisma.superadminBillingTask.findFirst({
        where: {
          organizationId: candidate.organizationId,
          type: candidate.type,
          source: SuperadminBillingTaskSource.AUTO,
          status: { in: [...ACTIVE_TASK_STATUSES] },
          relatedContractId: candidate.relatedContractId || null,
          relatedSubscriptionId: candidate.relatedSubscriptionId || null,
        },
        select: { id: true },
      });
      if (existing) {
        kept += 1;
        continue;
      }

      const task = await this.prisma.superadminBillingTask.create({
        data: {
          organizationId: candidate.organizationId,
          title: candidate.title,
          description: candidate.description || null,
          type: candidate.type,
          priority: candidate.priority,
          dueDate: candidate.dueDate || null,
          source: SuperadminBillingTaskSource.AUTO,
          relatedContractId: candidate.relatedContractId || null,
          relatedSubscriptionId: candidate.relatedSubscriptionId || null,
        },
        include: this.taskInclude(),
      });
      await this.writeAudit(user, task, 'BILLING_TASK_CREATED');
      created.push(this.toTask(task));
    }

    await this.audit.record({
      actorId: user.id,
      actorRole: user.role,
      organizationId: user.organizationId || null,
      action: 'BILLING_TASKS_GENERATED',
      entityType: 'BILLING_TASK',
      title: 'Taskuri de facturare generate',
      description: 'Taskuri de facturare generate automat.',
      severity: created.length ? 'SUCCESS' : 'INFO',
      after: { created: created.length, kept, candidates: candidates.length },
      actionUrl: '/ro/superadmin/billing-tasks',
    }).catch(() => null);

    return {
      created: created.length,
      kept,
      candidates: candidates.length,
      items: created,
      message: `Au fost generate ${created.length} taskuri noi. ${kept} taskuri existente au fost păstrate.`,
    };
  }

  private candidatesForOrganization(organization: any): BillingTaskCandidate[] {
    const now = new Date();
    const sevenDays = new Date(now.getTime() + 7 * DAY_MS);
    const thirtyDays = new Date(now.getTime() + 30 * DAY_MS);
    const contract = organization.commercialContracts?.[0] || null;
    const subscription = organization.subscriptionContracts?.[0] || null;
    const name = organization.name || 'Organizație fără nume';
    const candidates: BillingTaskCandidate[] = [];
    const add = (task: Omit<BillingTaskCandidate, 'organizationId' | 'organizationName'>) => {
      candidates.push({ organizationId: organization.id, organizationName: name, ...task });
    };

    if (organization.launchStatus === OrganizationLaunchStatus.LIVE && !this.isContractActive(contract?.status || null)) {
      add({
        type: SuperadminBillingTaskType.LIVE_WITHOUT_CONTRACT,
        priority: SuperadminBillingTaskPriority.HIGH,
        title: `Organizație LIVE fără contract activ: ${name}`,
        description: 'Organizația este live, dar contractul comercial nu este activ sau semnat.',
        dueDate: this.inDays(1),
        relatedContractId: contract?.id || null,
      });
    }

    if (!contract) {
      add({
        type: SuperadminBillingTaskType.CREATE_CONTRACT,
        priority: SuperadminBillingTaskPriority.NORMAL,
        title: `Creează contract pentru ${name}`,
        description: 'Organizația nu are contract comercial creat.',
        dueDate: this.inDays(7),
      });
    }

    if (contract && [OrganizationContractStatus.DRAFT, OrganizationContractStatus.SENT].includes(contract.status)) {
      add({
        type: SuperadminBillingTaskType.SIGN_CONTRACT,
        priority: SuperadminBillingTaskPriority.HIGH,
        title: `Semnează contractul cu ${name}`,
        description: `Contractul este ${contract.status}, dar nu este semnat/activ.`,
        dueDate: this.inDays(3),
        relatedContractId: contract.id,
      });
    }

    if (contract && this.isContractActive(contract.status) && !this.isSubscriptionActive(subscription?.status || null)) {
      add({
        type: SuperadminBillingTaskType.ACTIVATE_SUBSCRIPTION,
        priority: SuperadminBillingTaskPriority.HIGH,
        title: `Activează abonamentul pentru ${name}`,
        description: 'Contractul este semnat/activ, dar abonamentul nu este ACTIVE sau TRIAL.',
        dueDate: this.inDays(3),
        relatedContractId: contract.id,
        relatedSubscriptionId: subscription?.id || null,
      });
    }

    if (contract && !this.hasPricing(contract, subscription)) {
      add({
        type: SuperadminBillingTaskType.PRICING_MISSING,
        priority: SuperadminBillingTaskPriority.HIGH,
        title: `Tarif lipsă pentru ${name}`,
        description: 'Contractul nu are un tarif suficient pentru calculul lunar.',
        dueDate: this.inDays(3),
        relatedContractId: contract.id,
        relatedSubscriptionId: subscription?.id || null,
      });
    }

    if (subscription?.status === OrganizationSubscriptionStatus.PAST_DUE) {
      add({
        type: SuperadminBillingTaskType.PAYMENT_FOLLOW_UP,
        priority: SuperadminBillingTaskPriority.URGENT,
        title: `Follow-up plată pentru ${name}`,
        description: 'Abonamentul este PAST_DUE. Verifică plata și contactează clientul.',
        dueDate: now,
        relatedSubscriptionId: subscription.id,
        relatedContractId: contract?.id || null,
      });
    }

    if ([OrganizationSubscriptionStatus.PAUSED, OrganizationSubscriptionStatus.SUSPENDED, OrganizationSubscriptionStatus.CANCELLED].includes(subscription?.status)) {
      add({
        type: SuperadminBillingTaskType.SUBSCRIPTION_INACTIVE,
        priority: SuperadminBillingTaskPriority.HIGH,
        title: `Abonament inactiv pentru ${name}`,
        description: `Abonamentul are status ${subscription.status}.`,
        dueDate: this.inDays(2),
        relatedSubscriptionId: subscription.id,
        relatedContractId: contract?.id || null,
      });
    }

    if (subscription?.status === OrganizationSubscriptionStatus.TRIAL && subscription.trialEndDate && this.isBetween(subscription.trialEndDate, now, sevenDays)) {
      add({
        type: SuperadminBillingTaskType.TRIAL_ENDING,
        priority: SuperadminBillingTaskPriority.NORMAL,
        title: `Trial se termină curând pentru ${name}`,
        description: 'Contactează clientul înainte de finalul perioadei de trial.',
        dueDate: subscription.trialEndDate,
        relatedSubscriptionId: subscription.id,
      });
    }

    if (contract?.endDate && new Date(contract.endDate) < now) {
      add({
        type: SuperadminBillingTaskType.CONTRACT_EXPIRED,
        priority: SuperadminBillingTaskPriority.HIGH,
        title: `Contract expirat pentru ${name}`,
        description: 'Contractul comercial are data de expirare depășită.',
        dueDate: now,
        relatedContractId: contract.id,
      });
    } else if (contract?.endDate && this.isBetween(contract.endDate, now, thirtyDays)) {
      add({
        type: SuperadminBillingTaskType.CONTRACT_EXPIRING,
        priority: SuperadminBillingTaskPriority.NORMAL,
        title: `Contractul expiră curând pentru ${name}`,
        description: 'Pregătește reînnoirea contractului comercial.',
        dueDate: contract.endDate,
        relatedContractId: contract.id,
      });
    }

    if (subscription?.nextBillingDate && this.isBetween(subscription.nextBillingDate, now, sevenDays)) {
      add({
        type: SuperadminBillingTaskType.CHECK_PAYMENT,
        priority: SuperadminBillingTaskPriority.NORMAL,
        title: `Verifică plata lunară pentru ${name}`,
        description: 'Următoarea scadență de facturare este în următoarele 7 zile.',
        dueDate: subscription.nextBillingDate,
        relatedSubscriptionId: subscription.id,
        relatedContractId: contract?.id || null,
      });
    }

    return candidates;
  }

  private listWhere(query: Record<string, string | undefined>): Prisma.SuperadminBillingTaskWhereInput {
    const where: Prisma.SuperadminBillingTaskWhereInput = {};
    const status = this.enumFilter(query.status, SuperadminBillingTaskStatus);
    const type = this.enumFilter(query.type, SuperadminBillingTaskType);
    const priority = this.enumFilter(query.priority, SuperadminBillingTaskPriority);
    const search = this.stringValue(query.search);
    const dueFrom = this.dateOrNull(query.dueFrom);
    const dueTo = this.dateOrNull(query.dueTo);

    if (status) where.status = status;
    if (type) where.type = type;
    if (priority) where.priority = priority;
    if (query.organizationId) where.organizationId = query.organizationId;
    if (dueFrom || dueTo) where.dueDate = { ...(dueFrom ? { gte: dueFrom } : {}), ...(dueTo ? { lte: dueTo } : {}) };
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { internalNote: { contains: search, mode: 'insensitive' } },
        { organization: { is: { name: { contains: search, mode: 'insensitive' } } } },
        { organization: { is: { legalName: { contains: search, mode: 'insensitive' } } } },
        { organization: { is: { fiscalCode: { contains: search, mode: 'insensitive' } } } },
      ];
    }
    return where;
  }

  private async summary(where: Prisma.SuperadminBillingTaskWhereInput) {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart.getTime() + DAY_MS - 1);
    const sevenDays = new Date(todayEnd.getTime() + 6 * DAY_MS);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const base = { ...where };

    const [open, urgent, inProgress, dueToday, dueNext7Days, completedThisMonth] = await Promise.all([
      this.prisma.superadminBillingTask.count({ where: { ...base, status: { in: [...ACTIVE_TASK_STATUSES] } } }),
      this.prisma.superadminBillingTask.count({ where: { ...base, status: { in: [...ACTIVE_TASK_STATUSES] }, priority: SuperadminBillingTaskPriority.URGENT } }),
      this.prisma.superadminBillingTask.count({ where: { ...base, status: SuperadminBillingTaskStatus.IN_PROGRESS } }),
      this.prisma.superadminBillingTask.count({ where: { ...base, status: { in: [...ACTIVE_TASK_STATUSES] }, dueDate: { gte: todayStart, lte: todayEnd } } }),
      this.prisma.superadminBillingTask.count({ where: { ...base, status: { in: [...ACTIVE_TASK_STATUSES] }, dueDate: { gte: todayStart, lte: sevenDays } } }),
      this.prisma.superadminBillingTask.count({ where: { ...base, status: SuperadminBillingTaskStatus.DONE, completedAt: { gte: monthStart } } }),
    ]);

    return { open, urgent, inProgress, dueToday, dueNext7Days, completedThisMonth };
  }

  private taskInclude() {
    return {
      organization: { select: { id: true, name: true, legalName: true, fiscalCode: true, city: true, launchStatus: true } },
      relatedContract: { select: { id: true, status: true, contractNumber: true, pricingModel: true, startDate: true, endDate: true } },
      relatedSubscription: { select: { id: true, status: true, planName: true, price: true, currency: true, trialEndDate: true, nextBillingDate: true } },
      assignedTo: { select: { id: true, email: true, fullName: true, firstName: true, lastName: true } },
      completedBy: { select: { id: true, email: true, fullName: true, firstName: true, lastName: true } },
      dismissedBy: { select: { id: true, email: true, fullName: true, firstName: true, lastName: true } },
    } satisfies Prisma.SuperadminBillingTaskInclude;
  }

  private toTask(task: any) {
    return {
      id: task.id,
      organizationId: task.organizationId,
      title: task.title,
      description: task.description,
      type: task.type,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate,
      source: task.source,
      relatedContractId: task.relatedContractId,
      relatedSubscriptionId: task.relatedSubscriptionId,
      assignedToId: task.assignedToId,
      completedAt: task.completedAt,
      dismissedAt: task.dismissedAt,
      internalNote: task.internalNote,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      organization: task.organization ? {
        id: task.organization.id,
        name: task.organization.name,
        legalName: task.organization.legalName,
        apcCode: task.organization.fiscalCode,
        city: task.organization.city,
        launchStatus: task.organization.launchStatus,
      } : null,
      contract: task.relatedContract ? {
        id: task.relatedContract.id,
        status: task.relatedContract.status,
        contractNumber: task.relatedContract.contractNumber,
        pricingModel: task.relatedContract.pricingModel,
        startDate: task.relatedContract.startDate,
        endDate: task.relatedContract.endDate,
      } : null,
      subscription: task.relatedSubscription ? {
        id: task.relatedSubscription.id,
        status: task.relatedSubscription.status,
        planName: task.relatedSubscription.planName,
        currentMonthlyAmount: task.relatedSubscription.price,
        currency: task.relatedSubscription.currency,
        trialEndsAt: task.relatedSubscription.trialEndDate,
        nextBillingDate: task.relatedSubscription.nextBillingDate,
      } : null,
      assignedTo: task.assignedTo ? this.toUser(task.assignedTo) : null,
      completedBy: task.completedBy ? this.toUser(task.completedBy) : null,
      dismissedBy: task.dismissedBy ? this.toUser(task.dismissedBy) : null,
    };
  }

  private async ensureOrganization(id: string) {
    const organization = await this.prisma.organization.findUnique({ where: { id }, select: { id: true } });
    if (!organization) throw new NotFoundException('Organizația nu a fost găsită.');
  }

  private async ensureTask(id: string) {
    const task = await this.prisma.superadminBillingTask.findUnique({ where: { id }, select: { id: true, status: true, priority: true } });
    if (!task) throw new NotFoundException('Taskul de facturare nu a fost găsit.');
    return task;
  }

  private async writeAudit(user: MvpUser, task: any, action: string) {
    if (!task.organizationId) return;
    await this.audit.record({
      actorId: user.id,
      actorRole: user.role,
      organizationId: task.organizationId,
      billingTaskId: task.id,
      contractId: task.relatedContractId || null,
      subscriptionId: task.relatedSubscriptionId || null,
      action,
      entityType: 'BILLING_TASK',
      entityId: task.id,
      title: this.auditDescription(action),
      description: this.auditDescription(action),
      severity: action === 'BILLING_TASK_COMPLETED' ? 'SUCCESS' : action === 'BILLING_TASK_DISMISSED' ? 'WARNING' : 'INFO',
      after: { status: task.status, priority: task.priority, type: task.type, dueDate: task.dueDate, source: task.source },
      actionUrl: `/ro/superadmin/billing-tasks?organizationId=${task.organizationId}`,
    }).catch(() => null);
  }

  private auditDescription(action: string) {
    const labels: Record<string, string> = {
      BILLING_TASK_CREATED: 'Task de facturare creat.',
      BILLING_TASK_UPDATED: 'Task de facturare actualizat.',
      BILLING_TASK_COMPLETED: 'Task de facturare finalizat.',
      BILLING_TASK_DISMISSED: 'Task de facturare respins.',
    };
    return labels[action] || action;
  }

  private isContractActive(status: OrganizationContractStatus | null) {
    return status === OrganizationContractStatus.SIGNED || status === OrganizationContractStatus.ACTIVE;
  }

  private isSubscriptionActive(status: OrganizationSubscriptionStatus | null) {
    return status === OrganizationSubscriptionStatus.ACTIVE || status === OrganizationSubscriptionStatus.TRIAL;
  }

  private hasPricing(contract: any, subscription: any) {
    if (contract.pricingModel === ContractPricingModel.PER_APARTMENT) return this.decimalToNumber(contract.pricePerApartment) > 0;
    if (contract.pricingModel === ContractPricingModel.FIXED_MONTHLY) return this.decimalToNumber(contract.fixedMonthlyPrice) > 0;
    if (contract.pricingModel === ContractPricingModel.CUSTOM) return Number(subscription?.price || 0) > 0;
    return false;
  }

  private isBetween(value: Date | string, from: Date, to: Date) {
    const date = new Date(value);
    return date >= from && date <= to;
  }

  private inDays(days: number) {
    return new Date(Date.now() + days * DAY_MS);
  }

  private countMap<T extends Record<string, any>>(rows: T[], key: keyof T) {
    return rows.reduce<Record<string, number>>((acc, row) => {
      acc[String(row[key])] = row._count?._all || 0;
      return acc;
    }, {});
  }

  private toUser(user: { id: string; email: string; fullName: string | null; firstName: string | null; lastName: string | null }) {
    return {
      id: user.id,
      email: user.email,
      name: user.fullName || [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email,
    };
  }

  private objectPayload(body: unknown) {
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  }

  private requiredString(value: unknown, message: string) {
    const text = this.stringValue(value);
    if (!text) throw new BadRequestException(message);
    return text;
  }

  private nullableString(value: unknown) {
    const text = this.stringValue(value);
    return text || null;
  }

  private stringValue(value: unknown) {
    if (value === undefined || value === null) return '';
    return String(value).trim();
  }

  private optionalDate(value: unknown, message: string) {
    if (value === undefined || value === null || value === '') return null;
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) throw new BadRequestException(message);
    return date;
  }

  private dateOrNull(value: unknown) {
    if (value === undefined || value === null || value === '') return null;
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private enumValue<T extends Record<string, string>>(value: unknown, source: T, fallback: T[keyof T], message: string) {
    if (value === undefined || value === null || value === '') return fallback;
    const normalized = String(value).trim().toUpperCase();
    const allowed = Object.values(source) as string[];
    if (!allowed.includes(normalized)) throw new BadRequestException(message);
    return normalized as T[keyof T];
  }

  private enumFilter<T extends Record<string, string>>(value: unknown, source: T): T[keyof T] | null {
    const normalized = this.stringValue(value).toUpperCase();
    if (!normalized) return null;
    return (Object.values(source) as string[]).includes(normalized) ? normalized as T[keyof T] : null;
  }

  private positiveInt(value: unknown, fallback: number) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  }

  private decimalToNumber(value: Prisma.Decimal | null | undefined) {
    return value ? Number(value.toString()) : 0;
  }
}
