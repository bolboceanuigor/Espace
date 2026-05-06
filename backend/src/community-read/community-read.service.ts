import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AnnouncementCategory, AnnouncementStatus, IssueStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CommunityReadService {
  constructor(private readonly prisma: PrismaService) {}

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

  async listIssues() {
    const issues = await this.prisma.issue.findMany({
      orderBy: { createdAt: 'desc' },
      select: this.issueSelect(),
    });

    return issues.map((issue) => this.toIssue(issue));
  }

  async getIssue(id: string) {
    const issue = await this.prisma.issue.findFirst({
      where: { id },
      select: this.issueSelect(),
    });

    if (!issue) {
      throw new NotFoundException('Issue not found');
    }

    return this.toIssue(issue);
  }

  async updateIssueStatus(id: string, body: unknown) {
    const status = this.parseIssueStatus(body);
    const existing = await this.prisma.issue.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Issue not found');
    }

    const issue = await this.prisma.issue.update({
      where: { id },
      data: {
        status,
        resolvedAt: status === IssueStatus.RESOLVED ? new Date() : null,
      },
      select: this.issueSelect(),
    });

    return this.toIssue(issue);
  }

  async listAnnouncements() {
    const announcements = await this.prisma.announcement.findMany({
      orderBy: [{ createdAt: 'desc' }],
      select: this.announcementSelect(),
    });

    return announcements.map((announcement) => this.toAnnouncement(announcement));
  }

  async createAnnouncement(body: unknown) {
    const input = this.parseCreateAnnouncementBody(body);
    const organization = await this.prisma.organization.findUnique({
      where: { id: input.organizationId },
      select: { id: true },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const announcement = await this.prisma.announcement.create({
      data: input,
      select: this.announcementSelect(),
    });

    return this.toAnnouncement(announcement);
  }

  async getAnnouncement(id: string) {
    const announcement = await this.prisma.announcement.findFirst({
      where: { id },
      select: this.announcementSelect(),
    });

    if (!announcement) {
      throw new NotFoundException('Announcement not found');
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
      organizationId: this.requiredString(payload.organizationId, 'Organizația este obligatorie.'),
      title: this.requiredString(payload.title, 'Titlul este obligatoriu.'),
      content: this.requiredString(payload.content, 'Conținutul este obligatoriu.'),
      category: this.optionalEnum(payload.category, AnnouncementCategory, AnnouncementCategory.GENERAL, 'Categoria anunțului nu este validă.'),
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
