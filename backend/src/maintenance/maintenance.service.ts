import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ContentTargetType, NotificationType, OrganizationMemberStatus, OrganizationMemberRole, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateMaintenanceEventDto,
  CreateExpenseAttachmentDto,
  CreateExpenseDto,
  CreateMaintenanceTaskDto,
  CreateSupplierDto,
  ExpenseFiltersDto,
  MaintenanceEventFiltersDto,
  MaintenanceTaskFiltersDto,
  SupplierFiltersDto,
  TechnicianUpdateTaskDto,
  UpdateMaintenanceEventDto,
  UpdateExpenseDto,
  UpdateMaintenanceTaskDto,
  UpdateSupplierDto,
} from './dto/maintenance.dto';

type AuthUser = { id?: string; sub?: string; role?: string; organizationId?: string | null };

@Injectable()
export class MaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private userId(user: AuthUser) {
    return user.id || user.sub || '';
  }

  private assertOrg(user: AuthUser) {
    if (!user.organizationId) throw new ForbiddenException('Organization context missing');
    return { organizationId: user.organizationId, userId: this.userId(user) };
  }

  private async getMembership(organizationId: string, userId: string) {
    return this.prisma.organizationMember.findFirst({
      where: { organizationId, userId, status: OrganizationMemberStatus.ACTIVE },
      select: { role: true, permissionsJson: true },
    });
  }

  private async assertAdminModuleAccess(
    user: AuthUser,
    options: { allowManager?: boolean; allowAccountant?: boolean; allowTechnician?: boolean; allowOperatorView?: boolean },
  ) {
    const { organizationId, userId } = this.assertOrg(user);
    if (String(user.role || '').toUpperCase() === 'ADMIN') return { organizationId, userId, role: 'ADMIN' };
    const member = await this.getMembership(organizationId, userId);
    if (!member) throw new ForbiddenException('Active organization membership required');
    const role = member.role;
    if (
      role === OrganizationMemberRole.ORG_ADMIN ||
      (options.allowManager && role === OrganizationMemberRole.MANAGER) ||
      (options.allowAccountant && role === OrganizationMemberRole.ACCOUNTANT) ||
      (options.allowTechnician && role === OrganizationMemberRole.TECHNICIAN) ||
      (options.allowOperatorView && role === OrganizationMemberRole.OPERATOR)
    ) {
      return { organizationId, userId, role };
    }
    throw new ForbiddenException('Insufficient role permissions');
  }

  async listSuppliers(user: AuthUser, filters: SupplierFiltersDto) {
    const { organizationId } = await this.assertAdminModuleAccess(user, {
      allowManager: true,
      allowAccountant: true,
      allowOperatorView: true,
    });
    return this.prisma.supplier.findMany({
      where: {
        organizationId,
        ...(filters.search
          ? {
              OR: [
                { name: { contains: filters.search, mode: Prisma.QueryMode.insensitive } },
                { contactPerson: { contains: filters.search, mode: Prisma.QueryMode.insensitive } },
                { serviceType: { contains: filters.search, mode: Prisma.QueryMode.insensitive } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createSupplier(user: AuthUser, dto: CreateSupplierDto) {
    const actor = await this.assertAdminModuleAccess(user, { allowManager: true, allowAccountant: true });
    const created = await this.prisma.supplier.create({
      data: {
        organizationId: actor.organizationId,
        name: dto.name.trim(),
        contactPerson: dto.contactPerson || null,
        phone: dto.phone || null,
        email: dto.email || null,
        serviceType: dto.serviceType || null,
      },
    });
    await this.auditService.logCreate(actor, 'SUPPLIER', created.id, created, 'Created supplier');
    return created;
  }

  async updateSupplier(user: AuthUser, id: string, dto: UpdateSupplierDto) {
    const actor = await this.assertAdminModuleAccess(user, { allowManager: true, allowAccountant: true });
    const existing = await this.prisma.supplier.findFirst({ where: { id, organizationId: actor.organizationId } });
    if (!existing) throw new NotFoundException('Supplier not found');
    const updated = await this.prisma.supplier.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.contactPerson !== undefined ? { contactPerson: dto.contactPerson || null } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone || null } : {}),
        ...(dto.email !== undefined ? { email: dto.email || null } : {}),
        ...(dto.serviceType !== undefined ? { serviceType: dto.serviceType || null } : {}),
      },
    });
    await this.auditService.logUpdate(actor, 'SUPPLIER', id, existing, updated, 'Updated supplier');
    return updated;
  }

  async deleteSupplier(user: AuthUser, id: string) {
    const actor = await this.assertAdminModuleAccess(user, { allowManager: true, allowAccountant: true });
    const existing = await this.prisma.supplier.findFirst({ where: { id, organizationId: actor.organizationId } });
    if (!existing) throw new NotFoundException('Supplier not found');
    await this.prisma.supplier.delete({ where: { id } });
    await this.auditService.logDelete(actor, 'SUPPLIER', id, existing, 'Deleted supplier');
    return { ok: true };
  }

  async listMaintenanceTasks(user: AuthUser, filters: MaintenanceTaskFiltersDto) {
    const { organizationId } = await this.assertAdminModuleAccess(user, {
      allowManager: true,
      allowTechnician: true,
      allowOperatorView: true,
    });
    return this.prisma.maintenanceTask.findMany({
      where: {
        organizationId,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.priority ? { priority: filters.priority } : {}),
        ...(filters.assignedTo ? { assignedToUserId: filters.assignedTo } : {}),
        ...(filters.buildingId ? { buildingId: filters.buildingId } : {}),
      },
      include: {
        building: { select: { id: true, name: true } },
        staircase: { select: { id: true, name: true } },
        relatedIssue: { select: { id: true, title: true, status: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async validateTaskReferences(
    organizationId: string,
    dto: Partial<CreateMaintenanceTaskDto | UpdateMaintenanceTaskDto>,
  ) {
    if (dto.type === 'REACTIVE' && dto.relatedIssueId) {
      const issue = await this.prisma.issue.findFirst({
        where: { id: dto.relatedIssueId, organizationId },
        select: { id: true },
      });
      if (!issue) throw new BadRequestException('Related issue not found in organization');
    }
    if (dto.buildingId) {
      const building = await this.prisma.building.findFirst({ where: { id: dto.buildingId, organizationId }, select: { id: true } });
      if (!building) throw new BadRequestException('Building not found in organization');
    }
    if (dto.staircaseId) {
      const staircase = await this.prisma.staircase.findFirst({ where: { id: dto.staircaseId, organizationId }, select: { id: true } });
      if (!staircase) throw new BadRequestException('Staircase not found in organization');
    }
    if (dto.assignedToUserId) {
      const assignee = await this.prisma.user.findFirst({ where: { id: dto.assignedToUserId, organizationId, deletedAt: null }, select: { id: true } });
      if (!assignee) throw new BadRequestException('Assigned user not found in organization');
    }
  }

  private assertResident(user: AuthUser) {
    const role = String(user.role || '').toUpperCase();
    if (role !== 'RESIDENT' && role !== 'TENANT') throw new ForbiddenException('Resident access required');
    if (!user.organizationId) throw new ForbiddenException('Organization context missing');
    return { organizationId: user.organizationId, userId: this.userId(user) };
  }

  private async assertTargetInOrg(
    organizationId: string,
    targetType: ContentTargetType,
    buildingId?: string | null,
    staircaseId?: string | null,
    apartmentId?: string | null,
  ) {
    if (targetType === 'ORGANIZATION') return;
    if (targetType === 'BUILDING') {
      if (!buildingId) throw new BadRequestException('buildingId is required');
      const building = await this.prisma.building.findFirst({ where: { id: buildingId, organizationId }, select: { id: true } });
      if (!building) throw new BadRequestException('Building not found in organization');
      return;
    }
    if (targetType === 'STAIRCASE') {
      if (!staircaseId) throw new BadRequestException('staircaseId is required');
      const staircase = await this.prisma.staircase.findFirst({ where: { id: staircaseId, organizationId }, select: { id: true } });
      if (!staircase) throw new BadRequestException('Staircase not found in organization');
      return;
    }
    if (!apartmentId) throw new BadRequestException('apartmentId is required');
    const apartment = await this.prisma.apartment.findFirst({ where: { id: apartmentId, organizationId }, select: { id: true } });
    if (!apartment) throw new BadRequestException('Apartment not found in organization');
  }

  private async targetResidentUserIds(
    organizationId: string,
    targetType: ContentTargetType,
    buildingId?: string | null,
    staircaseId?: string | null,
    apartmentId?: string | null,
  ) {
    const where: Prisma.ResidentProfileWhereInput = { organizationId };
    if (targetType === 'BUILDING') where.apartment = { buildingId: buildingId || undefined };
    if (targetType === 'STAIRCASE') where.apartment = { staircaseId: staircaseId || undefined };
    if (targetType === 'APARTMENT') where.apartmentId = apartmentId || undefined;
    const profiles = await this.prisma.residentProfile.findMany({
      where,
      select: { userId: true },
      distinct: ['userId'],
    });
    return profiles.map((profile) => profile.userId);
  }

  private residentVisibilityWhere(organizationId: string, buildingIds: string[], staircaseIds: string[], apartmentIds: string[]) {
    return {
      organizationId,
      OR: [
        { targetType: ContentTargetType.ORGANIZATION },
        { targetType: ContentTargetType.BUILDING, buildingId: { in: buildingIds.length ? buildingIds : ['__none__'] } },
        { targetType: ContentTargetType.STAIRCASE, staircaseId: { in: staircaseIds.length ? staircaseIds : ['__none__'] } },
        { targetType: ContentTargetType.APARTMENT, apartmentId: { in: apartmentIds.length ? apartmentIds : ['__none__'] } },
      ],
    };
  }

  async listMaintenanceEvents(user: AuthUser, filters: MaintenanceEventFiltersDto) {
    const { organizationId } = await this.assertAdminModuleAccess(user, {
      allowManager: true,
      allowTechnician: true,
      allowOperatorView: true,
    });
    return this.prisma.maintenanceEvent.findMany({
      where: {
        organizationId,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.from || filters.to
          ? {
              startsAt: {
                ...(filters.from ? { gte: new Date(filters.from) } : {}),
                ...(filters.to ? { lte: new Date(filters.to) } : {}),
              },
            }
          : {}),
      },
      include: {
        building: { select: { id: true, name: true } },
        staircase: { select: { id: true, name: true } },
        apartment: { select: { id: true, number: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { startsAt: 'asc' },
    });
  }

  async createMaintenanceEvent(user: AuthUser, dto: CreateMaintenanceEventDto) {
    const actor = await this.assertAdminModuleAccess(user, { allowManager: true });
    await this.assertTargetInOrg(
      actor.organizationId,
      dto.targetType as ContentTargetType,
      dto.buildingId,
      dto.staircaseId,
      dto.apartmentId,
    );
    const created = await this.prisma.maintenanceEvent.create({
      data: {
        organizationId: actor.organizationId,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        targetType: dto.targetType as ContentTargetType,
        buildingId: dto.buildingId || null,
        staircaseId: dto.staircaseId || null,
        apartmentId: dto.apartmentId || null,
        startsAt: new Date(dto.startsAt),
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        status: dto.status || 'PLANNED',
        notifyResidents: !!dto.notifyResidents,
        createdByUserId: actor.userId,
      },
    });
    if (created.notifyResidents) {
      const residentUserIds = await this.targetResidentUserIds(
        actor.organizationId,
        created.targetType as ContentTargetType,
        created.buildingId,
        created.staircaseId,
        created.apartmentId,
      );
      if (residentUserIds.length) {
        await this.notificationsService.notifyUsers({
          organizationId: actor.organizationId,
          userIds: residentUserIds,
          title: `Lucrari planificate: ${created.title}`,
          message: created.description || 'A fost programata o lucrare de mentenanta.',
          type: NotificationType.MAINTENANCE,
          link: '/resident/maintenance',
        });
      }
    }
    await this.auditService.logCreate(actor, 'MAINTENANCE_EVENT', created.id, created, 'Created maintenance event');
    return created;
  }

  async updateMaintenanceEvent(user: AuthUser, id: string, dto: UpdateMaintenanceEventDto) {
    const actor = await this.assertAdminModuleAccess(user, { allowManager: true });
    const existing = await this.prisma.maintenanceEvent.findFirst({ where: { id, organizationId: actor.organizationId } });
    if (!existing) throw new NotFoundException('Maintenance event not found');
    const targetType = (dto.targetType || existing.targetType) as ContentTargetType;
    await this.assertTargetInOrg(
      actor.organizationId,
      targetType,
      dto.buildingId === undefined ? existing.buildingId : dto.buildingId,
      dto.staircaseId === undefined ? existing.staircaseId : dto.staircaseId,
      dto.apartmentId === undefined ? existing.apartmentId : dto.apartmentId,
    );
    const updated = await this.prisma.maintenanceEvent.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
        ...(dto.targetType !== undefined ? { targetType: dto.targetType as ContentTargetType } : {}),
        ...(dto.buildingId !== undefined ? { buildingId: dto.buildingId || null } : {}),
        ...(dto.staircaseId !== undefined ? { staircaseId: dto.staircaseId || null } : {}),
        ...(dto.apartmentId !== undefined ? { apartmentId: dto.apartmentId || null } : {}),
        ...(dto.startsAt !== undefined ? { startsAt: new Date(dto.startsAt) } : {}),
        ...(dto.endsAt !== undefined ? { endsAt: dto.endsAt ? new Date(dto.endsAt) : null } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.notifyResidents !== undefined ? { notifyResidents: dto.notifyResidents } : {}),
      },
    });
    await this.auditService.logUpdate(actor, 'MAINTENANCE_EVENT', id, existing, updated, 'Updated maintenance event');
    return updated;
  }

  async deleteMaintenanceEvent(user: AuthUser, id: string) {
    const actor = await this.assertAdminModuleAccess(user, { allowManager: true });
    const existing = await this.prisma.maintenanceEvent.findFirst({ where: { id, organizationId: actor.organizationId } });
    if (!existing) throw new NotFoundException('Maintenance event not found');
    await this.prisma.maintenanceEvent.delete({ where: { id } });
    await this.auditService.logDelete(actor, 'MAINTENANCE_EVENT', id, existing, 'Deleted maintenance event');
    return { ok: true };
  }

  async listResidentMaintenanceEvents(user: AuthUser, filters: MaintenanceEventFiltersDto) {
    const { organizationId, userId } = this.assertResident(user);
    const profiles = await this.prisma.residentProfile.findMany({
      where: { organizationId, userId },
      include: { apartment: { select: { id: true, buildingId: true, staircaseId: true } } },
    });
    const apartmentIds = profiles.map((profile) => profile.apartmentId);
    const buildingIds = profiles.map((profile) => profile.apartment.buildingId);
    const staircaseIds = profiles.map((profile) => profile.apartment.staircaseId);
    return this.prisma.maintenanceEvent.findMany({
      where: {
        ...this.residentVisibilityWhere(organizationId, buildingIds, staircaseIds, apartmentIds),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.from || filters.to
          ? {
              startsAt: {
                ...(filters.from ? { gte: new Date(filters.from) } : {}),
                ...(filters.to ? { lte: new Date(filters.to) } : {}),
              },
            }
          : {}),
      },
      include: {
        building: { select: { id: true, name: true } },
        staircase: { select: { id: true, name: true } },
        apartment: { select: { id: true, number: true } },
      },
      orderBy: { startsAt: 'asc' },
    });
  }

  async createMaintenanceTask(user: AuthUser, dto: CreateMaintenanceTaskDto) {
    const actor = await this.assertAdminModuleAccess(user, { allowManager: true });
    if (dto.type === 'REACTIVE' && !dto.relatedIssueId) {
      throw new BadRequestException('relatedIssueId is required when type is REACTIVE');
    }
    await this.validateTaskReferences(actor.organizationId, dto);
    const created = await this.prisma.maintenanceTask.create({
      data: {
        organizationId: actor.organizationId,
        title: dto.title.trim(),
        description: dto.description || null,
        type: dto.type,
        relatedIssueId: dto.relatedIssueId || null,
        buildingId: dto.buildingId || null,
        staircaseId: dto.staircaseId || null,
        assignedToUserId: dto.assignedToUserId || null,
        status: dto.status || 'NEW',
        priority: dto.priority || 'MEDIUM',
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        createdByUserId: actor.userId,
      },
    });
    if (created.assignedToUserId) {
      await this.notificationsService.createNotification({
        organizationId: actor.organizationId,
        userId: created.assignedToUserId,
        title: `Task asignat: ${created.title}`,
        message: `A fost programat un task de mentenanta.`,
        type: 'MAINTENANCE' as any,
        link: '/technician/tasks',
      });
    }
    await this.auditService.logCreate(actor, 'MAINTENANCE_TASK', created.id, created, 'Created maintenance task');
    return created;
  }

  async createMaintenanceTaskFromIssue(user: AuthUser, issueId: string, body?: Partial<CreateMaintenanceTaskDto>) {
    const actor = await this.assertAdminModuleAccess(user, { allowManager: true });
    const issue = await this.prisma.issue.findFirst({
      where: { id: issueId, organizationId: actor.organizationId },
      select: { id: true, title: true, description: true, buildingId: true, staircaseId: true, priority: true },
    });
    if (!issue) throw new NotFoundException('Issue not found');
    return this.createMaintenanceTask(user, {
      title: body?.title || `Reactive task: ${issue.title}`,
      description: body?.description || issue.description || '',
      type: 'REACTIVE',
      relatedIssueId: issue.id,
      buildingId: body?.buildingId || issue.buildingId || undefined,
      staircaseId: body?.staircaseId || issue.staircaseId || undefined,
      assignedToUserId: body?.assignedToUserId,
      priority: (body?.priority as any) || (issue.priority as any) || 'MEDIUM',
      status: 'NEW',
      scheduledAt: body?.scheduledAt,
    });
  }

  async updateMaintenanceTask(user: AuthUser, id: string, dto: UpdateMaintenanceTaskDto) {
    const actor = await this.assertAdminModuleAccess(user, { allowManager: true });
    const existing = await this.prisma.maintenanceTask.findFirst({ where: { id, organizationId: actor.organizationId } });
    if (!existing) throw new NotFoundException('Task not found');
    await this.validateTaskReferences(actor.organizationId, dto);
    if (dto.type === 'REACTIVE' && dto.relatedIssueId === undefined && !existing.relatedIssueId) {
      throw new BadRequestException('relatedIssueId is required for REACTIVE tasks');
    }

    const nextStatus = dto.status ?? existing.status;
    const updated = await this.prisma.maintenanceTask.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description || null } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes || null } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.relatedIssueId !== undefined ? { relatedIssueId: dto.relatedIssueId || null } : {}),
        ...(dto.buildingId !== undefined ? { buildingId: dto.buildingId || null } : {}),
        ...(dto.staircaseId !== undefined ? { staircaseId: dto.staircaseId || null } : {}),
        ...(dto.assignedToUserId !== undefined ? { assignedToUserId: dto.assignedToUserId || null } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.scheduledAt !== undefined ? { scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(nextStatus === 'COMPLETED' ? { completedAt: new Date() } : dto.status ? { completedAt: null } : {}),
      },
    });
    if (updated.assignedToUserId && updated.assignedToUserId !== existing.assignedToUserId) {
      await this.notificationsService.createNotification({
        organizationId: actor.organizationId,
        userId: updated.assignedToUserId,
        title: `Task nou asignat: ${updated.title}`,
        message: `Verifica taskurile tale de mentenanta.`,
        type: 'MAINTENANCE' as any,
        link: '/technician/tasks',
      });
    }
    await this.auditService.logUpdate(actor, 'MAINTENANCE_TASK', id, existing, updated, 'Updated maintenance task');
    return updated;
  }

  async deleteMaintenanceTask(user: AuthUser, id: string) {
    const actor = await this.assertAdminModuleAccess(user, { allowManager: true });
    const existing = await this.prisma.maintenanceTask.findFirst({ where: { id, organizationId: actor.organizationId } });
    if (!existing) throw new NotFoundException('Task not found');
    await this.prisma.maintenanceTask.delete({ where: { id } });
    await this.auditService.logDelete(actor, 'MAINTENANCE_TASK', id, existing, 'Deleted maintenance task');
    return { ok: true };
  }

  async technicianTasks(user: AuthUser) {
    const { organizationId, userId } = this.assertOrg(user);
    const member = await this.getMembership(organizationId, userId);
    if (!member || member.role !== OrganizationMemberRole.TECHNICIAN) {
      throw new ForbiddenException('Technician access required');
    }
    return this.prisma.maintenanceTask.findMany({
      where: { organizationId, assignedToUserId: userId },
      include: {
        building: { select: { id: true, name: true } },
        staircase: { select: { id: true, name: true } },
        relatedIssue: { select: { id: true, title: true } },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async technicianUpdateTask(user: AuthUser, id: string, dto: TechnicianUpdateTaskDto) {
    const { organizationId, userId } = this.assertOrg(user);
    const member = await this.getMembership(organizationId, userId);
    if (!member || member.role !== OrganizationMemberRole.TECHNICIAN) {
      throw new ForbiddenException('Technician access required');
    }
    const existing = await this.prisma.maintenanceTask.findFirst({
      where: { id, organizationId, assignedToUserId: userId },
    });
    if (!existing) throw new NotFoundException('Task not found');
    const nextStatus = dto.status ?? existing.status;
    const updated = await this.prisma.maintenanceTask.update({
      where: { id },
      data: {
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes || null } : {}),
        ...(nextStatus === 'COMPLETED' ? { completedAt: new Date() } : {}),
      },
    });
    await this.auditService.logUpdate(
      { organizationId, userId },
      'MAINTENANCE_TASK',
      id,
      existing,
      updated,
      'Technician updated maintenance task',
    );
    return updated;
  }

  private async validateExpenseRefs(organizationId: string, dto: Partial<CreateExpenseDto | UpdateExpenseDto>) {
    if (dto.supplierId) {
      const supplier = await this.prisma.supplier.findFirst({ where: { id: dto.supplierId, organizationId }, select: { id: true } });
      if (!supplier) throw new BadRequestException('Supplier not found in organization');
    }
    if (dto.maintenanceTaskId) {
      const task = await this.prisma.maintenanceTask.findFirst({
        where: { id: dto.maintenanceTaskId, organizationId },
        select: { id: true },
      });
      if (!task) throw new BadRequestException('Maintenance task not found in organization');
    }
  }

  async listExpenses(user: AuthUser, filters: ExpenseFiltersDto) {
    const { organizationId } = await this.assertAdminModuleAccess(user, {
      allowAccountant: true,
      allowOperatorView: true,
    });
    const expenses = await this.prisma.expense.findMany({
      where: {
        organizationId,
        ...(filters.category ? { category: filters.category } : {}),
        ...(filters.supplier ? { supplierId: filters.supplier } : {}),
        ...(filters.from || filters.to
          ? {
              expenseDate: {
                ...(filters.from ? { gte: new Date(filters.from) } : {}),
                ...(filters.to ? { lte: new Date(filters.to) } : {}),
              },
            }
          : {}),
      },
      include: {
        supplier: { select: { id: true, name: true } },
        maintenanceTask: { select: { id: true, title: true, status: true } },
        attachments: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { expenseDate: 'desc' },
    });
    const assets = await this.prisma.fileAsset.findMany({
      where: { organizationId, entityType: 'EXPENSE_ATTACHMENT' },
      select: { id: true, fileUrl: true, entityId: true },
    });
    const byEntityId = new Map(assets.filter((a) => a.entityId).map((a) => [a.entityId as string, a.id]));
    const byUrl = new Map(assets.map((a) => [a.fileUrl, a.id]));
    return expenses.map((expense) => ({
      ...expense,
      attachments: (expense.attachments || []).map((att: any) => ({
        ...att,
        fileAssetId: byEntityId.get(expense.id) || byUrl.get(att.fileUrl) || null,
      })),
    }));
  }

  async createExpense(user: AuthUser, dto: CreateExpenseDto) {
    const actor = await this.assertAdminModuleAccess(user, { allowAccountant: true });
    await this.validateExpenseRefs(actor.organizationId, dto);
    const created = await this.prisma.expense.create({
      data: {
        organizationId: actor.organizationId,
        supplierId: dto.supplierId || null,
        maintenanceTaskId: dto.maintenanceTaskId || null,
        category: dto.category,
        description: dto.description.trim(),
        amount: Number(dto.amount),
        currency: dto.currency,
        expenseDate: new Date(dto.expenseDate),
        paidBy: dto.paidBy,
        invoiceNumber: dto.invoiceNumber || null,
        createdByUserId: actor.userId,
      },
    });
    await this.auditService.logCreate(actor, 'EXPENSE', created.id, created, 'Created expense');
    return created;
  }

  async updateExpense(user: AuthUser, id: string, dto: UpdateExpenseDto) {
    const actor = await this.assertAdminModuleAccess(user, { allowAccountant: true });
    const existing = await this.prisma.expense.findFirst({ where: { id, organizationId: actor.organizationId } });
    if (!existing) throw new NotFoundException('Expense not found');
    await this.validateExpenseRefs(actor.organizationId, dto);
    const updated = await this.prisma.expense.update({
      where: { id },
      data: {
        ...(dto.supplierId !== undefined ? { supplierId: dto.supplierId || null } : {}),
        ...(dto.maintenanceTaskId !== undefined ? { maintenanceTaskId: dto.maintenanceTaskId || null } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.description !== undefined ? { description: dto.description.trim() } : {}),
        ...(dto.amount !== undefined ? { amount: Number(dto.amount) } : {}),
        ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
        ...(dto.expenseDate !== undefined ? { expenseDate: new Date(dto.expenseDate) } : {}),
        ...(dto.paidBy !== undefined ? { paidBy: dto.paidBy } : {}),
        ...(dto.invoiceNumber !== undefined ? { invoiceNumber: dto.invoiceNumber || null } : {}),
      },
    });
    await this.auditService.logUpdate(actor, 'EXPENSE', id, existing, updated, 'Updated expense');
    return updated;
  }

  async deleteExpense(user: AuthUser, id: string) {
    const actor = await this.assertAdminModuleAccess(user, { allowAccountant: true });
    const existing = await this.prisma.expense.findFirst({ where: { id, organizationId: actor.organizationId } });
    if (!existing) throw new NotFoundException('Expense not found');
    await this.prisma.expense.delete({ where: { id } });
    await this.auditService.logDelete(actor, 'EXPENSE', id, existing, 'Deleted expense');
    return { ok: true };
  }

  async addExpenseAttachment(user: AuthUser, id: string, dto: CreateExpenseAttachmentDto) {
    const actor = await this.assertAdminModuleAccess(user, { allowAccountant: true });
    const expense = await this.prisma.expense.findFirst({ where: { id, organizationId: actor.organizationId }, select: { id: true } });
    if (!expense) throw new NotFoundException('Expense not found');
    const created = await this.prisma.expenseAttachment.create({
      data: {
        expenseId: id,
        fileUrl: dto.fileUrl,
        fileName: dto.fileName,
      },
    });
    await this.prisma.fileAsset.updateMany({
      where: { organizationId: actor.organizationId, entityType: 'EXPENSE_ATTACHMENT', fileUrl: dto.fileUrl, entityId: null },
      data: { entityId: id },
    });
    return created;
  }
}

