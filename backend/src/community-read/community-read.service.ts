import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AnnouncementCategory, AnnouncementStatus, IssueStatus, NotificationType, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityMvpService } from '../activity-mvp/activity-mvp.service';
import type { MvpUser } from '../security/mvp-auth.guard';

@Injectable()
export class CommunityReadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityMvpService,
  ) {}

  private issueSelect(): Prisma.IssueSelect {
    return {
      id: true,
      organizationId: true,
      apartmentId: true,
      residentId: true,
      category: true,
      priority: true,
      status: true,
      title: true,
      description: true,
      createdAt: true,
      updatedAt: true,
      apartment: {
        select: {
          id: true,
          number: true,
          floor: true,
          staircase: { select: { id: true, name: true } },
          building: { select: { id: true, name: true } },
        },
      },
      resident: {
        select: {
          id: true,
          userId: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
        },
      },
    };
  }

  private announcementSelect(): Prisma.AnnouncementSelect {
    return {
      id: true,
      organizationId: true,
      title: true,
      content: true,
      category: true,
      status: true,
      targetType: true,
      createdAt: true,
      updatedAt: true,
      createdBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    };
  }

  private fullName(person?: { firstName?: string | null; lastName?: string | null; email?: string | null } | null) {
    const name = `${person?.firstName || ''} ${person?.lastName || ''}`.trim();
    return name || person?.email || null;
  }

  private preview(value: string, maxLength = 140) {
    if (!value) return '';
    return value.length > maxLength ? `${value.slice(0, maxLength).trim()}...` : value;
  }

  private toIssue(row: any) {
    return {
      id: row.id,
      organizationId: row.organizationId,
      apartmentId: row.apartmentId,
      apartmentNumber: row.apartment?.number ?? null,
      apartment: row.apartment ?? null,
      residentId: row.residentId,
      residentName: this.fullName(row.resident),
      resident: row.resident
        ? {
            id: row.resident.id,
            name: this.fullName(row.resident),
            phone: row.resident.phone,
            email: row.resident.email,
          }
        : null,
      category: row.category,
      priority: row.priority,
      status: row.status,
      title: row.title,
      description: row.description,
      preview: this.preview(row.description),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private toAnnouncement(row: any) {
    return {
      id: row.id,
      organizationId: row.organizationId,
      title: row.title,
      content: row.content,
      preview: this.preview(row.content),
      category: row.category,
      status: row.status,
      audience: row.targetType || 'ORGANIZATION',
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      createdBy: row.createdBy
        ? {
            id: row.createdBy.id,
            name: this.fullName(row.createdBy),
            email: row.createdBy.email,
          }
        : null,
    };
  }

  private isSuperadmin(user: MvpUser) {
    return String(user.role).toUpperCase() === Role.SUPERADMIN;
  }

  private organizationWhere(user: MvpUser) {
    return this.isSuperadmin(user) ? {} : { organizationId: user.organizationId };
  }

  private assertOrganizationAccess(user: MvpUser, organizationId: string) {
    if (!this.isSuperadmin(user) && organizationId !== user.organizationId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_ORGANIZATION',
        message: 'Nu ai acces la aceste date.',
      });
    }
  }

  async listIssues(user: MvpUser) {
    const issues = await this.prisma.issue.findMany({
      where: this.organizationWhere(user),
      orderBy: { createdAt: 'desc' },
      select: this.issueSelect(),
    });

    return issues.map((issue) => this.toIssue(issue));
  }

  async getIssue(user: MvpUser, id: string) {
    const issue = await this.prisma.issue.findFirst({
      where: { id, ...this.organizationWhere(user) },
      select: this.issueSelect(),
    });

    if (!issue) {
      throw new NotFoundException('Înregistrarea nu a fost găsită.');
    }

    return this.toIssue(issue);
  }

  async updateIssueStatus(user: MvpUser, id: string, body: unknown) {
    const status = this.parseIssueStatus(body);
    const existing = await this.prisma.issue.findFirst({
      where: { id, ...this.organizationWhere(user) },
      select: { id: true, organizationId: true },
    });

    if (!existing) {
      throw new NotFoundException('Înregistrarea nu a fost găsită.');
    }
    this.assertOrganizationAccess(user, existing.organizationId);

    const issue = await this.prisma.issue.update({
      where: { id },
      data: {
        status,
        resolvedAt: status === IssueStatus.RESOLVED ? new Date() : null,
      },
      select: this.issueSelect(),
    });

    await this.activity.createActivity({
      organizationId: issue.organizationId,
      actorUserId: user.id,
      type: 'ISSUE_STATUS_UPDATED',
      title: 'Status cerere actualizat',
      message: `Cererea „${issue.title}” a fost actualizată la statusul ${status}.`,
      targetType: 'ISSUE',
      targetId: issue.id,
      link: `/admin/issues/${issue.id}`,
    });

    await this.activity.notifyResidentProfile({
      organizationId: issue.organizationId,
      residentId: issue.residentId,
      type: NotificationType.ISSUE,
      title: 'Status cerere actualizat',
      message: `Cererea „${issue.title}” are acum statusul ${status}.`,
      link: `/resident/issues/${issue.id}`,
    });

    return this.toIssue(issue);
  }

  async listAnnouncements(user: MvpUser) {
    const announcements = await this.prisma.announcement.findMany({
      where: this.organizationWhere(user),
      orderBy: [{ createdAt: 'desc' }],
      select: this.announcementSelect(),
    });

    return announcements.map((announcement) => this.toAnnouncement(announcement));
  }

  async createAnnouncement(user: MvpUser, body: unknown) {
    const input = this.parseCreateAnnouncementBody(body);
    if (!this.isSuperadmin(user)) {
      input.organizationId = user.organizationId;
    }
    this.assertOrganizationAccess(user, input.organizationId);
    const organization = await this.prisma.organization.findUnique({
      where: { id: input.organizationId },
      select: { id: true },
    });

    if (!organization) {
      throw new NotFoundException('Înregistrarea nu a fost găsită.');
    }

    const announcement = await this.prisma.announcement.create({
      data: input,
      select: this.announcementSelect(),
    });

    await this.activity.createActivity({
      organizationId: announcement.organizationId,
      actorUserId: user.id,
      type: 'ANNOUNCEMENT_CREATED',
      title: 'Anunț publicat',
      message: `Anunțul „${announcement.title}” a fost publicat pe avizier.`,
      targetType: 'ANNOUNCEMENT',
      targetId: announcement.id,
      link: `/admin/announcements/${announcement.id}`,
    });

    if (announcement.status === AnnouncementStatus.ACTIVE) {
      await this.activity.notifyOrganizationResidents({
        organizationId: announcement.organizationId,
        type: NotificationType.ANNOUNCEMENT,
        title: announcement.title,
        message: `Un anunț nou a fost publicat pe avizier: ${announcement.title}.`,
        link: `/resident/announcements/${announcement.id}`,
      });
    }

    return this.toAnnouncement(announcement);
  }

  async getAnnouncement(user: MvpUser, id: string) {
    const announcement = await this.prisma.announcement.findFirst({
      where: { id, ...this.organizationWhere(user) },
      select: this.announcementSelect(),
    });

    if (!announcement) {
      throw new NotFoundException('Înregistrarea nu a fost găsită.');
    }

    return this.toAnnouncement(announcement);
  }

  private parseIssueStatus(body: unknown) {
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const status = this.requiredString(payload.status, 'Statusul este obligatoriu.').toUpperCase();
    const allowed: IssueStatus[] = [IssueStatus.NEW, IssueStatus.IN_PROGRESS, IssueStatus.RESOLVED];
    if (!allowed.includes(status as IssueStatus)) {
      throw new BadRequestException('Statusul cererii nu este valid.');
    }
    return status as IssueStatus;
  }

  private parseCreateAnnouncementBody(body: unknown) {
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    return {
      organizationId:
        typeof payload.organizationId === 'string' && payload.organizationId.trim()
          ? payload.organizationId.trim()
          : '',
      title: this.requiredString(payload.title, 'Titlul anunțului este obligatoriu.'),
      content: this.requiredString(payload.content, 'Conținutul anunțului este obligatoriu.'),
      category: this.optionalEnum(payload.category, AnnouncementCategory, AnnouncementCategory.GENERAL, 'Categoria nu este validă.'),
      status: this.optionalEnum(payload.status, AnnouncementStatus, AnnouncementStatus.ACTIVE, 'Statusul anunțului nu este valid.'),
    };
  }

  private requiredString(value: unknown, message: string) {
    if (typeof value !== 'string' || !value.trim()) throw new BadRequestException(message);
    return value.trim();
  }

  private optionalEnum<T extends Record<string, string>>(value: unknown, enumValues: T, fallback: T[keyof T], message: string) {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value !== 'string') throw new BadRequestException(message);
    const normalized = value.trim().toUpperCase();
    const allowed = Object.values(enumValues) as string[];
    if (!allowed.includes(normalized)) throw new BadRequestException(message);
    return normalized as T[keyof T];
  }
}
