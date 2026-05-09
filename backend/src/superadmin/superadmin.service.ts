import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSuperadminOrgDto } from './dto/create-superadmin-org.dto';
import { UpdateSuperadminOrgDto } from './dto/update-superadmin-org.dto';
import { CreateSuperadminUserDto } from './dto/create-superadmin-user.dto';
import { UpdateSuperadminUserDto } from './dto/update-superadmin-user.dto';
import { CreateClientNoteDto, UpdateClientNoteDto } from './dto/client-note.dto';
import { CreateSuperadminTaskDto, ListSuperadminTasksDto, UpdateSuperadminTaskDto } from './dto/superadmin-task.dto';
import { UpdateQACheckDto } from './dto/qa-checklist.dto';
import { UpdateBetaReadinessCheckDto } from './dto/beta-readiness.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

type QACheckTemplate = { key: string; section: string; title: string };

const QA_CHECKLIST_TEMPLATES: QACheckTemplate[] = [
  { key: 'auth-superadmin-login', section: 'Authentication', title: 'login works for SUPER_ADMIN' },
  { key: 'auth-admin-login', section: 'Authentication', title: 'login works for ADMIN' },
  { key: 'auth-resident-login', section: 'Authentication', title: 'login works for RESIDENT' },
  { key: 'auth-role-redirect', section: 'Authentication', title: 'role redirect works correctly' },
  { key: 'auth-logout', section: 'Authentication', title: 'logout works' },
  { key: 'org-create', section: 'Organization flow', title: 'SUPER_ADMIN creates organization' },
  { key: 'org-assign-admin', section: 'Organization flow', title: 'assigns admin' },
  { key: 'org-subscription-trial', section: 'Organization flow', title: 'subscription/trial works' },
  { key: 'org-onboarding-starts', section: 'Organization flow', title: 'onboarding starts' },
  { key: 'setup-building', section: 'Admin setup flow', title: 'create building' },
  { key: 'setup-staircase', section: 'Admin setup flow', title: 'create staircase' },
  { key: 'setup-apartment', section: 'Admin setup flow', title: 'create apartment' },
  { key: 'setup-resident-create-import', section: 'Admin setup flow', title: 'create/import resident' },
  { key: 'setup-link-resident-apartment', section: 'Admin setup flow', title: 'link resident to apartment' },
  { key: 'fin-create-tariff', section: 'Financial flow', title: 'create tariff' },
  { key: 'fin-generate-charges', section: 'Financial flow', title: 'generate monthly charges' },
  { key: 'fin-generate-invoice', section: 'Financial flow', title: 'generate resident invoice' },
  { key: 'fin-record-manual-payment', section: 'Financial flow', title: 'record manual payment' },
  { key: 'fin-invoice-status-updates', section: 'Financial flow', title: 'invoice status updates' },
  { key: 'fin-receipt-generated', section: 'Financial flow', title: 'receipt generated' },
  { key: 'fin-apartment-balance-updates', section: 'Financial flow', title: 'apartment balance updates' },
  { key: 'resident-sees-own-apartment', section: 'Resident flow', title: 'resident sees own apartment only' },
  { key: 'resident-sees-debt-invoices', section: 'Resident flow', title: 'resident sees debt/invoices' },
  { key: 'resident-creates-issue', section: 'Resident flow', title: 'resident creates issue' },
  { key: 'resident-sends-chat', section: 'Resident flow', title: 'resident sends chat message' },
  { key: 'resident-sees-announcements', section: 'Resident flow', title: 'resident sees announcements' },
  { key: 'admin-sees-issues', section: 'Admin operations', title: 'admin sees issues' },
  { key: 'admin-responds-chat', section: 'Admin operations', title: 'admin responds to chat' },
  { key: 'admin-sends-announcement', section: 'Admin operations', title: 'admin sends announcement' },
  { key: 'admin-uploads-document', section: 'Admin operations', title: 'admin uploads document' },
  { key: 'admin-views-reports', section: 'Admin operations', title: 'admin views reports' },
  { key: 'sec-admin-cross-org', section: 'Security checks', title: 'ADMIN cannot access another organization' },
  { key: 'sec-resident-cross-apartment', section: 'Security checks', title: 'RESIDENT cannot access another apartment' },
  { key: 'sec-resident-admin-routes', section: 'Security checks', title: 'RESIDENT cannot access admin routes' },
  { key: 'sec-suspended-org-limited', section: 'Security checks', title: 'suspended organization is limited' },
  { key: 'mobile-bottom-nav', section: 'Mobile checks', title: 'bottom navigation works' },
  { key: 'mobile-pages-fit', section: 'Mobile checks', title: 'pages fit mobile' },
  { key: 'mobile-no-hidden-buttons', section: 'Mobile checks', title: 'no hidden buttons' },
  { key: 'mobile-forms-usable', section: 'Mobile checks', title: 'forms usable on phone' },
  { key: 'auto-jobs-list', section: 'Automation checks', title: 'scheduled jobs list works' },
  { key: 'auto-manual-job-run', section: 'Automation checks', title: 'manual job run works' },
  { key: 'auto-no-duplicates', section: 'Automation checks', title: 'invoice/reminder jobs do not duplicate data' },
  { key: 'err-failed-api-message', section: 'Error handling', title: 'failed API shows message' },
  { key: 'err-form-validation', section: 'Error handling', title: 'forms show validation errors' },
  { key: 'err-empty-states', section: 'Error handling', title: 'empty states display correctly' },
];

type BetaReadinessTemplate = { key: string; title: string; isCritical: boolean };

const BETA_READINESS_TEMPLATES: BetaReadinessTemplate[] = [
  { key: 'backend-builds', title: 'backend builds', isCritical: true },
  { key: 'frontend-builds', title: 'frontend builds', isCritical: true },
  { key: 'database-migrations-work', title: 'database migrations work', isCritical: true },
  { key: 'seed-demo-works', title: 'seed demo works', isCritical: false },
  { key: 'login-all-roles', title: 'login works for all roles', isCritical: true },
  { key: 'organization-creation-works', title: 'organization creation works', isCritical: true },
  { key: 'admin-onboarding-works', title: 'admin onboarding works', isCritical: true },
  { key: 'apartment-import-works', title: 'apartment import works', isCritical: true },
  { key: 'tariff-setup-works', title: 'tariff setup works', isCritical: true },
  { key: 'charges-generation-works', title: 'charges generation works', isCritical: true },
  { key: 'invoice-generation-works', title: 'invoice generation works', isCritical: true },
  { key: 'payment-recording-works', title: 'payment recording works', isCritical: true },
  { key: 'resident-portal-works', title: 'resident portal works', isCritical: true },
  { key: 'mobile-bottom-nav-works', title: 'mobile bottom nav works', isCritical: true },
  { key: 'chat-works', title: 'chat works', isCritical: true },
  { key: 'issues-work', title: 'issues work', isCritical: true },
  { key: 'notifications-work', title: 'notifications work', isCritical: true },
  { key: 'reports-work', title: 'reports work', isCritical: true },
  { key: 'permissions-verified', title: 'permissions verified', isCritical: true },
  { key: 'backup-export-works', title: 'backup export works', isCritical: true },
  { key: 'health-check-works', title: 'health check works', isCritical: true },
];

@Injectable()
export class SuperadminService {
  constructor(private readonly prisma: PrismaService) {}
  private static readonly DEMO_RESET_CONFIRM_TEXT = 'RESET DEMO DATA';

  async listOrganizations() {
    const organizations = await this.prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        isActive: true,
        betaAccessEnabled: true,
        isDemo: true,
        createdAt: true,
        subscription: {
          select: {
            status: true,
          },
        },
        users: {
          where: { deletedAt: null, role: Role.ADMIN },
          take: 1,
          select: {
            email: true,
          },
        },
      },
    });
    const organizationIds = organizations.map((item) => item.id);
    const activeApartmentCounts = organizationIds.length
      ? await this.prisma.apartment.groupBy({
          by: ['organizationId'],
          where: {
            organizationId: { in: organizationIds },
          },
          _count: {
            _all: true,
          },
        })
      : [];
    const activeApartmentsByOrg = new Map(
      activeApartmentCounts.map((entry) => [entry.organizationId, entry._count._all]),
    );
    return organizations.map((organization) => {
      const activeApartments = activeApartmentsByOrg.get(organization.id) ?? 0;
      return {
        id: organization.id,
        name: organization.name,
        isActive: organization.isActive,
        betaAccessEnabled: organization.betaAccessEnabled,
        isDemo: organization.isDemo,
        createdAt: organization.createdAt,
        adminEmail: organization.users[0]?.email ?? null,
        subscriptionStatus: organization.subscription?.status ?? null,
        activeApartments,
        monthlyCostMdl: activeApartments * 1,
      };
    });
  }

  async createOrganization(dto: CreateSuperadminOrgDto) {
    return this.prisma.organization.create({
      data: {
        name: dto.name.trim(),
        onboardingCompleted: false,
        onboardingStatus: 'NOT_STARTED',
        onboardingStep: 'ORGANIZATION_DETAILS',
        onboardingCompletedAt: null,
        defaultLocale: 'ro',
        weekStart: 'MONDAY',
      },
      select: {
        id: true,
        name: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async updateOrganization(id: string, dto: UpdateSuperadminOrgDto) {
    const existing = await this.prisma.organization.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Organization not found');
    }
    return this.prisma.organization.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.betaAccessEnabled !== undefined ? { betaAccessEnabled: dto.betaAccessEnabled } : {}),
        ...(dto.isDemo !== undefined ? { isDemo: dto.isDemo } : {}),
      },
      select: {
        id: true,
        name: true,
        isActive: true,
        betaAccessEnabled: true,
        isDemo: true,
        createdAt: true,
      },
    });
  }

  async listUsers(orgId: string) {
    return this.prisma.user.findMany({
      where: { organizationId: orgId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        organizationId: true,
        createdAt: true,
      },
    });
  }

  async createUser(dto: CreateSuperadminUserDto) {
    const org = await this.prisma.organization.findUnique({
      where: { id: dto.orgId },
      select: { id: true },
    });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    const existing = await this.prisma.user.findFirst({
      where: { email: dto.email, deletedAt: null },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException('A user with this email already exists');
    }

    const temporaryPassword = dto.password || crypto.randomBytes(8).toString('hex');
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);
    const user = await this.prisma.user.create({
      data: {
        organizationId: dto.orgId,
        email: dto.email,
        role: dto.role,
        passwordHash,
        authProvider: 'LOCAL',
        emailVerifiedAt: new Date(),
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        role: true,
        organizationId: true,
        createdAt: true,
      },
    });
    return {
      user,
      temporaryPassword: dto.password ? undefined : temporaryPassword,
    };
  }

  async updateUser(id: string, dto: UpdateSuperadminUserDto) {
    const existing = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, role: true },
    });
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    let temporaryPassword: string | undefined;
    let passwordHash: string | undefined;
    if (dto.resetPassword) {
      temporaryPassword = crypto.randomBytes(8).toString('hex');
      passwordHash = await bcrypt.hash(temporaryPassword, 10);
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.role !== undefined ? { role: dto.role as Role } : {}),
        ...(passwordHash ? { passwordHash } : {}),
      },
      select: {
        id: true,
        email: true,
        role: true,
        organizationId: true,
        updatedAt: true,
      },
    });

    return { user, temporaryPassword };
  }

  async startSupportSession(superAdminUserId: string, organizationId: string, reason?: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true },
    });
    if (!org) throw new NotFoundException('Organization not found');

    await this.prisma.supportSession.updateMany({
      where: { superAdminUserId, isActive: true },
      data: { isActive: false, endedAt: new Date() },
    });

    const session = await this.prisma.supportSession.create({
      data: {
        superAdminUserId,
        organizationId,
        reason: reason || null,
        isActive: true,
      },
      include: {
        organization: { select: { id: true, name: true, isDemo: true } },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId,
        userId: superAdminUserId,
        action: 'SUPPORT_SESSION_START',
        entityType: 'SupportSession',
        entityId: session.id,
        description: `Started support mode for organization ${org.name}`,
        newValuesJson: { reason: reason || null },
      },
    });
    return session;
  }

  async endSupportSession(superAdminUserId: string, sessionId: string) {
    const session = await this.prisma.supportSession.findFirst({
      where: { id: sessionId, superAdminUserId, isActive: true },
      select: { id: true, organizationId: true },
    });
    if (!session) throw new NotFoundException('Active support session not found');

    const updated = await this.prisma.supportSession.update({
      where: { id: session.id },
      data: { isActive: false, endedAt: new Date() },
      include: {
        organization: { select: { id: true, name: true, isDemo: true } },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: session.organizationId,
        userId: superAdminUserId,
        action: 'SUPPORT_SESSION_END',
        entityType: 'SupportSession',
        entityId: session.id,
        description: `Ended support mode for organization ${updated.organization.name}`,
      },
    });
    return updated;
  }

  async currentSupportSession(superAdminUserId: string) {
    return this.prisma.supportSession.findFirst({
      where: { superAdminUserId, isActive: true },
      include: {
        organization: { select: { id: true, name: true, isDemo: true } },
      },
      orderBy: { startedAt: 'desc' },
    });
  }

  async listClientNotes(organizationId: string, type?: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return (this.prisma as any).clientNote.findMany({
      where: {
        organizationId,
        ...(type ? { type } : {}),
      },
      include: {
        createdByUser: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
      orderBy: [{ isImportant: 'desc' }, { createdAt: 'desc' }],
      take: 500,
    });
  }

  async createClientNote(organizationId: string, createdByUserId: string, dto: CreateClientNoteDto) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true },
    });
    if (!org) throw new NotFoundException('Organization not found');
    const note = await (this.prisma as any).clientNote.create({
      data: {
        organizationId,
        createdByUserId,
        type: dto.type as any,
        title: dto.title.trim(),
        content: dto.content.trim(),
        followUpAt: dto.followUpAt ? new Date(dto.followUpAt) : null,
        isImportant: !!dto.isImportant,
      },
      include: {
        createdByUser: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });
    await this.createCrmAudit({
      organizationId,
      userId: createdByUserId,
      action: 'CRM_NOTE_ADDED',
      entityType: 'CLIENT_NOTE',
      entityId: note.id,
      description: `Notă internă adăugată pentru ${org.name}.`,
      payload: { title: note.title, type: note.type, followUpAt: note.followUpAt },
    });
    return note;
  }

  async updateClientNote(id: string, dto: UpdateClientNoteDto) {
    const existing = await (this.prisma as any).clientNote.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Client note not found');
    return (this.prisma as any).clientNote.update({
      where: { id },
      data: {
        ...(dto.type !== undefined ? { type: dto.type as any } : {}),
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.content !== undefined ? { content: dto.content.trim() } : {}),
        ...(dto.followUpAt !== undefined ? { followUpAt: dto.followUpAt ? new Date(dto.followUpAt) : null } : {}),
        ...(dto.isImportant !== undefined ? { isImportant: dto.isImportant } : {}),
        ...(dto.followUpAt !== undefined && !dto.followUpAt
          ? { followUpDone: false, followUpDoneAt: null, followUpReminderSentAt: null }
          : {}),
      },
      include: {
        createdByUser: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async listPendingFollowUps() {
    return (this.prisma as any).clientNote.findMany({
      where: {
        followUpAt: { not: null },
        followUpDone: false,
      },
      include: {
        organization: { select: { id: true, name: true } },
        createdByUser: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
      orderBy: [{ followUpAt: 'asc' }, { createdAt: 'desc' }],
      take: 500,
    });
  }

  async markClientNoteFollowUpDone(id: string) {
    const existing = await (this.prisma as any).clientNote.findUnique({
      where: { id },
      select: { id: true, followUpAt: true, followUpDone: true },
    });
    if (!existing) throw new NotFoundException('Client note not found');
    if (!existing.followUpAt) {
      throw new BadRequestException('Client note has no follow-up date');
    }
    if (existing.followUpDone) return { ok: true };

    await (this.prisma as any).clientNote.update({
      where: { id },
      data: {
        followUpDone: true,
        followUpDoneAt: new Date(),
      },
    });
    return { ok: true };
  }

  async deleteClientNote(id: string) {
    const existing = await (this.prisma as any).clientNote.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Client note not found');
    await (this.prisma as any).clientNote.delete({ where: { id } });
    return { ok: true };
  }

  async listTasks(query: ListSuperadminTasksDto) {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return (this.prisma as any).superAdminTask.findMany({
      where: {
        ...(query.status ? { status: query.status as any } : {}),
        ...(query.priority ? { priority: query.priority as any } : {}),
        ...(query.relatedType ? { relatedType: query.relatedType as any } : {}),
        ...(query.relatedId ? { relatedId: query.relatedId } : {}),
        ...(query.dueFilter === 'OVERDUE'
          ? { dueDate: { lt: startOfDay }, status: { not: 'DONE' } }
          : query.dueFilter === 'TODAY'
            ? { dueDate: { gte: startOfDay, lte: endOfDay } }
            : query.dueFilter === 'UPCOMING'
              ? { dueDate: { gt: endOfDay } }
              : {}),
      },
      include: {
        createdByUser: { select: { id: true, email: true, firstName: true, lastName: true } },
        assignedToUser: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
      orderBy: [{ status: 'asc' }, { priority: 'desc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
      take: 500,
    });
  }

  async listOrganizationTasks(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return this.listTasks({ relatedType: 'ORGANIZATION', relatedId: organizationId });
  }

  async createOrganizationTask(organizationId: string, createdByUserId: string, dto: CreateSuperadminTaskDto) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return this.createTask(createdByUserId, {
      ...dto,
      relatedType: 'ORGANIZATION',
      relatedId: organizationId,
    });
  }

  async updateOrganizationTask(organizationId: string, taskId: string, userId: string, dto: UpdateSuperadminTaskDto) {
    const task = await (this.prisma as any).superAdminTask.findFirst({
      where: { id: taskId, relatedType: 'ORGANIZATION', relatedId: organizationId },
      select: { id: true },
    });
    if (!task) throw new NotFoundException('Task not found');
    return this.updateTask(taskId, userId, {
      ...dto,
      relatedType: 'ORGANIZATION',
      relatedId: organizationId,
    });
  }

  async createTask(createdByUserId: string, dto: CreateSuperadminTaskDto) {
    const task = await (this.prisma as any).superAdminTask.create({
      data: {
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        status: (dto.status || 'TODO') as any,
        priority: (dto.priority || 'MEDIUM') as any,
        relatedType: (dto.relatedType || null) as any,
        relatedId: dto.relatedId?.trim() || null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        createdByUserId,
        assignedToUserId: dto.assignedToUserId || null,
      },
      include: {
        createdByUser: { select: { id: true, email: true, firstName: true, lastName: true } },
        assignedToUser: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
    await this.createCrmAudit({
      organizationId: dto.relatedType === 'ORGANIZATION' ? dto.relatedId?.trim() || null : null,
      userId: createdByUserId,
      action: 'CRM_TASK_CREATED',
      entityType: 'SUPERADMIN_TASK',
      entityId: task.id,
      description: `Sarcină creată: ${task.title}.`,
      payload: { title: task.title, priority: task.priority, dueDate: task.dueDate },
    });
    return task;
  }

  async updateTask(id: string, userId: string | null, dto: UpdateSuperadminTaskDto) {
    const existing = await (this.prisma as any).superAdminTask.findUnique({
      where: { id },
      select: { id: true, title: true, status: true, relatedType: true, relatedId: true },
    });
    if (!existing) throw new NotFoundException('Task not found');
    const updated = await (this.prisma as any).superAdminTask.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description.trim() || null } : {}),
        ...(dto.status !== undefined ? { status: dto.status as any } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority as any } : {}),
        ...(dto.relatedType !== undefined ? { relatedType: dto.relatedType as any } : {}),
        ...(dto.relatedId !== undefined ? { relatedId: dto.relatedId.trim() || null } : {}),
        ...(dto.dueDate !== undefined ? { dueDate: dto.dueDate ? new Date(dto.dueDate) : null } : {}),
        ...(dto.assignedToUserId !== undefined ? { assignedToUserId: dto.assignedToUserId || null } : {}),
      },
      include: {
        createdByUser: { select: { id: true, email: true, firstName: true, lastName: true } },
        assignedToUser: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
    if (userId && dto.status === 'DONE' && existing.status !== 'DONE') {
      await this.createCrmAudit({
        organizationId: existing.relatedType === 'ORGANIZATION' ? existing.relatedId : null,
        userId,
        action: 'CRM_TASK_COMPLETED',
        entityType: 'SUPERADMIN_TASK',
        entityId: updated.id,
        description: `Sarcină finalizată: ${updated.title}.`,
        payload: { title: updated.title, previousStatus: existing.status, status: updated.status },
      });
    }
    return updated;
  }

  async deleteTask(id: string) {
    const existing = await (this.prisma as any).superAdminTask.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Task not found');
    await (this.prisma as any).superAdminTask.delete({ where: { id } });
    return { ok: true };
  }

  private async createCrmAudit(input: {
    organizationId?: string | null;
    userId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    description: string;
    payload?: Record<string, unknown>;
  }) {
    if (!input.userId) return null;
    try {
      return await this.prisma.auditLog.create({
        data: {
          organizationId: input.organizationId || null,
          userId: input.userId,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId || null,
          description: input.description,
          newValuesJson: (input.payload || {}) as any,
        },
      });
    } catch {
      return null;
    }
  }

  async getDemoStatus() {
    const demoOrganizations = await this.prisma.organization.findMany({
      where: { isDemo: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, createdAt: true },
    });
    const organizationIds = demoOrganizations.map((org) => org.id);
    if (!organizationIds.length) {
      return {
        organizations: [],
        totals: {
          organizations: 0,
          buildings: 0,
          staircases: 0,
          apartments: 0,
          residents: 0,
          monthlyCharges: 0,
          invoices: 0,
          payments: 0,
          issues: 0,
          announcements: 0,
          voteSessions: 0,
          maintenanceEvents: 0,
        },
      };
    }

    const [buildings, staircases, apartments, residents, monthlyCharges, invoices, payments, issues, announcements, voteSessions, maintenanceEvents] =
      await Promise.all([
        this.prisma.building.count({ where: { organizationId: { in: organizationIds } } }),
        this.prisma.staircase.count({ where: { organizationId: { in: organizationIds } } }),
        this.prisma.apartment.count({ where: { organizationId: { in: organizationIds } } }),
        this.prisma.user.count({ where: { organizationId: { in: organizationIds }, role: { in: ['RESIDENT', 'TENANT'] }, deletedAt: null } }),
        this.prisma.monthlyCharge.count({ where: { organizationId: { in: organizationIds } } }),
        this.prisma.residentInvoice.count({ where: { organizationId: { in: organizationIds } } }),
        this.prisma.payment.count({ where: { organizationId: { in: organizationIds } } }),
        this.prisma.issue.count({ where: { organizationId: { in: organizationIds } } }),
        this.prisma.announcement.count({ where: { organizationId: { in: organizationIds } } }),
        this.prisma.voteSession.count({ where: { organizationId: { in: organizationIds } } }),
        this.prisma.maintenanceEvent.count({ where: { organizationId: { in: organizationIds } } }),
      ]);

    return {
      organizations: demoOrganizations,
      totals: {
        organizations: demoOrganizations.length,
        buildings,
        staircases,
        apartments,
        residents,
        monthlyCharges,
        invoices,
        payments,
        issues,
        announcements,
        voteSessions,
        maintenanceEvents,
      },
    };
  }

  async resetDemoData(confirmText: string) {
    if ((confirmText || '').trim() !== SuperadminService.DEMO_RESET_CONFIRM_TEXT) {
      throw new BadRequestException('Invalid confirmation text');
    }

    const demoOrganizations = await this.prisma.organization.findMany({
      where: { isDemo: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true },
    });
    if (!demoOrganizations.length) {
      return { ok: true, resetOrganizations: 0, message: 'No demo organizations found' };
    }

    for (const organization of demoOrganizations) {
      await this.resetDemoOrganization(organization.id, organization.name);
    }

    return { ok: true, resetOrganizations: demoOrganizations.length };
  }

  async listQAChecklist() {
    await this.ensureQAChecklistSeeded();
    return (this.prisma as any).qACheck.findMany({
      orderBy: [{ section: 'asc' }, { createdAt: 'asc' }],
      include: {
        testedByUser: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async updateQACheck(id: string, testedByUserId: string, dto: UpdateQACheckDto) {
    await this.ensureQAChecklistSeeded();
    const existing = await (this.prisma as any).qACheck.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('QA check not found');
    }

    const hasStatusChange = dto.status !== undefined;
    const hasNotesChange = dto.notes !== undefined;
    if (!hasStatusChange && !hasNotesChange) {
      return (this.prisma as any).qACheck.findUnique({
        where: { id },
        include: {
          testedByUser: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
      });
    }

    return (this.prisma as any).qACheck.update({
      where: { id },
      data: {
        ...(dto.status !== undefined ? { status: dto.status as any } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes.trim() || null } : {}),
        ...(dto.status !== undefined
          ? {
              lastTestedAt: new Date(),
              testedByUserId,
            }
          : {}),
      },
      include: {
        testedByUser: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });
  }

  private async ensureQAChecklistSeeded() {
    const count = await (this.prisma as any).qACheck.count();
    if (count >= QA_CHECKLIST_TEMPLATES.length) {
      return;
    }

    for (const item of QA_CHECKLIST_TEMPLATES) {
      await (this.prisma as any).qACheck.upsert({
        where: { key: item.key },
        update: {
          section: item.section,
          title: item.title,
        },
        create: {
          key: item.key,
          section: item.section,
          title: item.title,
          status: 'NOT_TESTED',
        },
      });
    }
  }

  async getBetaReadiness() {
    await this.ensureBetaReadinessSeeded();
    const [checks, launchConfig, demoCount, realCount] = await Promise.all([
      (this.prisma as any).betaReadinessCheck.findMany({
        orderBy: { createdAt: 'asc' },
        include: {
          checkedByUser: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
      }),
      (this.prisma as any).betaLaunchConfig.findUnique({
        where: { id: 'default' },
        include: {
          updatedByUser: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
      }),
      this.prisma.organization.count({ where: { isDemo: true } }),
      this.prisma.organization.count({ where: { isDemo: false } }),
    ]);
    const criticalChecks = checks.filter((item: any) => item.isCritical);
    const allCriticalPassed =
      criticalChecks.length > 0 && criticalChecks.every((item: any) => item.status === 'PASSED');
    const passedChecks = checks.filter((item: any) => item.status === 'PASSED').length;
    const progress = checks.length ? Math.round((passedChecks / checks.length) * 100) : 0;
    return {
      checks,
      launchStatus: launchConfig?.launchStatus || 'NOT_READY',
      maintenanceMode: !!launchConfig?.maintenanceMode,
      launchStatusUpdatedAt: launchConfig?.updatedAt || null,
      launchStatusUpdatedBy: launchConfig?.updatedByUser || null,
      allCriticalPassed,
      progress,
      organizations: {
        demo: demoCount,
        real: realCount,
      },
      betaWarning: 'Beta version — verify data before official use.',
    };
  }

  async updateBetaReadinessCheck(id: string, checkedByUserId: string, dto: UpdateBetaReadinessCheckDto) {
    await this.ensureBetaReadinessSeeded();
    const existing = await (this.prisma as any).betaReadinessCheck.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Beta readiness check not found');
    return (this.prisma as any).betaReadinessCheck.update({
      where: { id },
      data: {
        ...(dto.status !== undefined ? { status: dto.status as any } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes.trim() || null } : {}),
        ...(dto.status !== undefined
          ? {
              lastCheckedAt: new Date(),
              checkedByUserId,
            }
          : {}),
      },
      include: {
        checkedByUser: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async updateBetaLaunchStatus(userId: string, launchStatus: 'NOT_READY' | 'READY_FOR_BETA' | 'LIVE') {
    await this.ensureBetaReadinessSeeded();
    if (launchStatus === 'READY_FOR_BETA') {
      const criticalChecks = await (this.prisma as any).betaReadinessCheck.findMany({
        where: { isCritical: true },
        select: { status: true },
      });
      const allCriticalPassed =
        criticalChecks.length > 0 && criticalChecks.every((item: any) => item.status === 'PASSED');
      if (!allCriticalPassed) {
        throw new BadRequestException('All critical checks must be PASSED before READY_FOR_BETA');
      }
    }
    return (this.prisma as any).betaLaunchConfig.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        launchStatus: launchStatus as any,
        updatedByUserId: userId,
      },
      update: {
        launchStatus: launchStatus as any,
        updatedByUserId: userId,
      },
      include: {
        updatedByUser: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async updateMaintenanceMode(userId: string, maintenanceMode: boolean) {
    await this.ensureBetaReadinessSeeded();
    return (this.prisma as any).betaLaunchConfig.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        maintenanceMode: !!maintenanceMode,
        updatedByUserId: userId,
      },
      update: {
        maintenanceMode: !!maintenanceMode,
        updatedByUserId: userId,
      },
      include: {
        updatedByUser: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });
  }

  private async ensureBetaReadinessSeeded() {
    for (const item of BETA_READINESS_TEMPLATES) {
      await (this.prisma as any).betaReadinessCheck.upsert({
        where: { key: item.key },
        update: {
          title: item.title,
          isCritical: item.isCritical,
        },
        create: {
          key: item.key,
          title: item.title,
          isCritical: item.isCritical,
          status: 'NOT_CHECKED',
        },
      });
    }
    await (this.prisma as any).betaLaunchConfig.upsert({
      where: { id: 'default' },
      create: { id: 'default', launchStatus: 'NOT_READY' },
      update: {},
    });
  }

  private async resetDemoOrganization(organizationId: string, organizationName: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, isDemo: true },
    });
    if (!org || !org.isDemo) {
      throw new BadRequestException('Only demo organizations can be reset');
    }

    const now = new Date();
    const baseStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const adminEmail = `demo.admin+${organizationId.slice(0, 8)}@example.invalid`;
    const residentEmails = Array.from({ length: 8 }).map(
      (_, i) => `demo.resident${i + 1}+${organizationId.slice(0, 8)}@example.invalid`,
    );

    let admin = await this.prisma.user.findFirst({
      where: { organizationId, role: 'ADMIN', deletedAt: null },
      select: { id: true },
    });
    if (!admin) {
      const createdAdmin = await this.prisma.user.upsert({
        where: { email: adminEmail },
        update: {
          organizationId,
          role: 'ADMIN',
          firstName: 'Demo',
          lastName: 'Admin',
          isActive: true,
          isDemoUser: true,
          deletedAt: null,
          authProvider: 'LOCAL',
        },
        create: {
          email: adminEmail,
          role: 'ADMIN',
          firstName: 'Demo',
          lastName: 'Admin',
          organizationId,
          isActive: true,
          isDemoUser: true,
          authProvider: 'LOCAL',
        },
        select: { id: true },
      });
      admin = { id: createdAdmin.id };
    }

    await this.prisma.$transaction(async (tx) => {
      const voteSessionIds = (
        await tx.voteSession.findMany({
          where: { organizationId },
          select: { id: true },
        })
      ).map((item) => item.id);
      if (voteSessionIds.length) {
        await tx.vote.deleteMany({ where: { voteSessionId: { in: voteSessionIds } } });
        await tx.voteOption.deleteMany({ where: { voteSessionId: { in: voteSessionIds } } });
      }
      await tx.voteSession.deleteMany({ where: { organizationId } });
      await tx.announcementComment.deleteMany({ where: { organizationId } });
      await tx.announcement.deleteMany({ where: { organizationId } });
      await tx.issue.deleteMany({ where: { organizationId } });
      await tx.maintenanceEvent.deleteMany({ where: { organizationId } });
      await tx.payment.deleteMany({ where: { organizationId } });
      await tx.residentInvoice.deleteMany({ where: { organizationId } });
      await tx.monthlyCharge.deleteMany({ where: { organizationId } });
      await tx.residentProfile.deleteMany({ where: { organizationId } });
      await tx.apartment.deleteMany({ where: { organizationId } });
      await tx.staircase.deleteMany({ where: { organizationId } });
      await tx.building.deleteMany({ where: { organizationId } });
      await tx.user.deleteMany({
        where: {
          organizationId,
          role: { in: ['RESIDENT', 'TENANT'] },
          email: { contains: '@example.invalid' },
        },
      });

      const buildingA = await tx.building.create({
        data: { organizationId, name: `${organizationName} - Bloc A`, address: 'Strada Exemplu 10', totalFloors: 8 },
      });
      const buildingB = await tx.building.create({
        data: { organizationId, name: `${organizationName} - Bloc B`, address: 'Strada Exemplu 12', totalFloors: 6 },
      });
      const staircases = [
        await tx.staircase.create({
          data: { organizationId, buildingId: buildingA.id, name: 'Scara 1', floorsCount: 8 },
        }),
        await tx.staircase.create({
          data: { organizationId, buildingId: buildingA.id, name: 'Scara 2', floorsCount: 8 },
        }),
        await tx.staircase.create({
          data: { organizationId, buildingId: buildingB.id, name: 'Scara 1', floorsCount: 6 },
        }),
      ];

      const apartments: Array<{ id: string; number: string; staircaseId: string; buildingId: string }> = [];
      for (let i = 0; i < 20; i += 1) {
        const staircase = staircases[i % staircases.length];
        const number = `${(i % 5) + 1}${String(i + 1).padStart(2, '0')}`;
        const apartment = await tx.apartment.create({
          data: {
            organizationId,
            buildingId: staircase.buildingId,
            staircaseId: staircase.id,
            number,
            floor: (i % 8) + 1,
            areaM2: 45 + i,
            rooms: i % 2 === 0 ? 2 : 3,
            status: i % 4 === 0 ? 'EMPTY' : 'OCCUPIED',
          },
        });
        apartments.push({ id: apartment.id, number: apartment.number, staircaseId: staircase.id, buildingId: staircase.buildingId });
      }

      for (let i = 0; i < residentEmails.length; i += 1) {
        const email = residentEmails[i];
        const resident = await tx.user.upsert({
          where: { email },
          update: {
            organizationId,
            role: 'RESIDENT',
            firstName: `Locatar${i + 1}`,
            lastName: 'Demo',
            isActive: true,
            isDemoUser: true,
            deletedAt: null,
            authProvider: 'LOCAL',
          },
          create: {
            email,
            organizationId,
            role: 'RESIDENT',
            firstName: `Locatar${i + 1}`,
            lastName: 'Demo',
            isActive: true,
            isDemoUser: true,
            authProvider: 'LOCAL',
          },
        });
        const apartment = apartments[i];
        await tx.residentProfile.create({
          data: {
            organizationId,
            userId: resident.id,
            apartmentId: apartment.id,
            type: 'OWNER',
            phone: `+3736009${String(i + 1).padStart(3, '0')}`,
            isPrimary: true,
          },
        });
      }

      for (let i = 0; i < 12; i += 1) {
        const apartment = apartments[i];
        const maintenanceCharge = 260 + i * 4;
        const utilitiesCharge = 420 + i * 6;
        await tx.monthlyCharge.createMany({
          data: [
            {
              organizationId,
              apartmentId: apartment.id,
              month: baseStart.getMonth() + 1,
              year: baseStart.getFullYear(),
              tariffName: 'TARIF_ADMINISTRARE',
              amount: maintenanceCharge,
              status: 'PENDING',
              createdByUserId: admin.id,
            },
            {
              organizationId,
              apartmentId: apartment.id,
              month: baseStart.getMonth() + 1,
              year: baseStart.getFullYear(),
              tariffName: 'TARIF_UTILITATI',
              amount: utilitiesCharge,
              status: 'PENDING',
              createdByUserId: admin.id,
            },
          ],
        });
        const totalDue = maintenanceCharge + utilitiesCharge;
        const invoice = await tx.residentInvoice.create({
          data: {
            organizationId,
            apartmentId: apartment.id,
            month: baseStart.getMonth() + 1,
            year: baseStart.getFullYear(),
            invoiceNumber: `DEMO-${organizationId.slice(0, 4).toUpperCase()}-${String(i + 1).padStart(4, '0')}`,
            previousDebt: i % 3 === 0 ? 120 : 0,
            currentCharges: totalDue,
            paymentsAmount: i % 2 === 0 ? totalDue * 0.6 : 0,
            totalDue: i % 2 === 0 ? totalDue * 0.4 : totalDue,
            status: i % 2 === 0 ? 'ISSUED' : 'DRAFT',
            issuedAt: now,
            dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
          },
        });
        if (i % 2 === 0) {
          await tx.payment.create({
            data: {
              organizationId,
              apartmentId: apartment.id,
              invoiceId: invoice.id,
              amount: totalDue * 0.6,
              currency: 'MDL',
              method: 'BANK_TRANSFER',
              status: 'CONFIRMED',
              provider: 'MANUAL_BANK_TRANSFER',
              month: `${baseStart.getFullYear()}-${String(baseStart.getMonth() + 1).padStart(2, '0')}`,
              createdByUserId: admin.id,
              confirmedAt: now,
            },
          });
        }
      }

      await tx.issue.createMany({
        data: [
          {
            organizationId,
            apartmentId: apartments[0]?.id,
            buildingId: apartments[0]?.buildingId,
            staircaseId: apartments[0]?.staircaseId,
            createdByUserId: admin.id,
            title: 'Sesizare demo: iluminat hol',
            description: 'Bec defect la etaj intermediar.',
            category: 'ELECTRICITY',
            locationType: 'STAIRCASE',
            status: 'NEW',
            priority: 'MEDIUM',
          },
          {
            organizationId,
            apartmentId: apartments[1]?.id,
            buildingId: apartments[1]?.buildingId,
            staircaseId: apartments[1]?.staircaseId,
            createdByUserId: admin.id,
            title: 'Sesizare demo: presiune apa',
            description: 'Presiune scazuta in apartamentele superioare.',
            category: 'WATER',
            locationType: 'BUILDING',
            status: 'IN_PROGRESS',
            priority: 'HIGH',
          },
        ],
      });

      await tx.announcement.createMany({
        data: [
          {
            organizationId,
            title: 'Anunt demo: curatenie scari',
            content: 'Echipa de curatenie va interveni miercuri intre 10:00-14:00.',
            importance: 'IMPORTANT',
            targetType: 'ORGANIZATION',
            createdByUserId: admin.id,
          },
          {
            organizationId,
            title: 'Anunt demo: verificare instalatii',
            content: 'Datele sunt exclusiv demonstrative.',
            importance: 'NORMAL',
            targetType: 'ORGANIZATION',
            createdByUserId: admin.id,
          },
        ],
      });

      const voteSession = await tx.voteSession.create({
        data: {
          organizationId,
          title: 'Vot demo: modernizare iluminat LED',
          description: 'Sesiune demonstrativa pentru test',
          targetType: 'ORGANIZATION',
          votingMethod: 'BY_APARTMENT',
          status: 'ACTIVE',
          startsAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
          endsAt: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
          createdByUserId: admin.id,
        },
      });
      const [yesOption, noOption] = await Promise.all([
        tx.voteOption.create({ data: { voteSessionId: voteSession.id, label: 'Da' } }),
        tx.voteOption.create({ data: { voteSessionId: voteSession.id, label: 'Nu' } }),
      ]);
      await tx.vote.createMany({
        data: apartments.slice(0, 6).map((apartment, idx) => ({
          organizationId,
          voteSessionId: voteSession.id,
          voteOptionId: idx % 2 === 0 ? yesOption.id : noOption.id,
          apartmentId: apartment.id,
          userId: admin.id,
          weight: 1,
        })),
      });

      await tx.maintenanceEvent.createMany({
        data: [
          {
            organizationId,
            title: 'Interventie demo: revizie lift',
            description: 'Revizie periodica planificata.',
            targetType: 'BUILDING',
            buildingId: buildingA.id,
            startsAt: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
            endsAt: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
            status: 'PLANNED',
            notifyResidents: true,
            createdByUserId: admin.id,
          },
          {
            organizationId,
            title: 'Interventie demo: spalare subsol',
            description: 'Date de test',
            targetType: 'ORGANIZATION',
            startsAt: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000),
            status: 'PLANNED',
            notifyResidents: false,
            createdByUserId: admin.id,
          },
        ],
      });
    });
  }
}
