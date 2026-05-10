import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AnnouncementCategory,
  AnnouncementStatus,
  ContentImportance,
  ContentTargetType,
  IssueCategory,
  IssuePriority,
  IssueStatus,
  NotificationType,
  Prisma,
  Role,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityMvpService } from '../activity-mvp/activity-mvp.service';
import type { MvpUser } from '../security/mvp-auth.guard';

const ANNOUNCEMENT_METADATA_TITLE = 'Announcement module metadata';
const ANNOUNCEMENT_CATEGORIES = ['GENERAL', 'MAINTENANCE', 'PAYMENTS', 'EMERGENCY', 'MEETING', 'DOCUMENTS', 'OTHER'] as const;
const ANNOUNCEMENT_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;
const ANNOUNCEMENT_STATUSES = ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'] as const;
const ANNOUNCEMENT_VISIBILITY_TYPES = ['ALL_RESIDENTS', 'BY_STAIRCASE', 'BY_APARTMENTS', 'BY_ROLE'] as const;
const ANNOUNCEMENT_ROLES = ['OWNER', 'TENANT', 'RESIDENT', 'REPRESENTATIVE'] as const;
const REQUEST_METADATA_TITLE = 'Resident request module metadata';
const REQUEST_CATEGORIES = ['MAINTENANCE', 'CLEANING', 'PAYMENTS', 'DOCUMENTS', 'ACCESS', 'NOISE', 'COMMON_AREA', 'TECHNICAL', 'OTHER'] as const;
const REQUEST_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;
const REQUEST_STATUSES = ['NEW', 'IN_REVIEW', 'IN_PROGRESS', 'WAITING_FOR_RESIDENT', 'RESOLVED', 'CLOSED', 'CANCELLED'] as const;
const REQUEST_MESSAGE_TYPES = ['PUBLIC_COMMENT', 'INTERNAL_NOTE', 'STATUS_CHANGE'] as const;

type AnnouncementCategoryValue = (typeof ANNOUNCEMENT_CATEGORIES)[number];
type AnnouncementPriorityValue = (typeof ANNOUNCEMENT_PRIORITIES)[number];
type AnnouncementStatusValue = (typeof ANNOUNCEMENT_STATUSES)[number];
type AnnouncementVisibilityTypeValue = (typeof ANNOUNCEMENT_VISIBILITY_TYPES)[number];
type AnnouncementMetadata = {
  excerpt?: string;
  category: AnnouncementCategoryValue;
  priority: AnnouncementPriorityValue;
  status: AnnouncementStatusValue;
  visibilityType: AnnouncementVisibilityTypeValue;
  visibleToResidents: boolean;
  pinned: boolean;
  publishAt: string | null;
  publishedAt: string | null;
  publishedById: string | null;
  expiresAt: string | null;
  archivedAt: string | null;
  archivedById: string | null;
  staircaseIds: string[];
  apartmentIds: string[];
  roles: string[];
  createdById?: string | null;
};
type AnnouncementMetadataStore = {
  items: Record<string, AnnouncementMetadata>;
  reads: Record<string, Record<string, string>>;
};
type ResidentAnnouncementScope = {
  residentIds: string[];
  apartmentIds: string[];
  staircaseIds: string[];
  staircaseNames: string[];
  buildingIds: string[];
  roles: string[];
};
type RequestCategoryValue = (typeof REQUEST_CATEGORIES)[number];
type RequestPriorityValue = (typeof REQUEST_PRIORITIES)[number];
type RequestStatusValue = (typeof REQUEST_STATUSES)[number];
type RequestMessageTypeValue = (typeof REQUEST_MESSAGE_TYPES)[number];
type RequestMetadata = {
  requestNumber: string;
  category: RequestCategoryValue;
  priority: RequestPriorityValue;
  status: RequestStatusValue;
  locationDetails: string | null;
  preferredContactMethod: string | null;
  createdByResidentId: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  cancelledAt: string | null;
  assignedToId?: string | null;
  timeline: Array<{
    type: RequestMessageTypeValue;
    oldStatus?: string | null;
    newStatus?: string | null;
    message: string;
    createdAt: string;
    authorUserId?: string | null;
  }>;
};
type RequestMetadataStore = {
  items: Record<string, RequestMetadata>;
  counters: Record<string, number>;
};

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
      buildingId: true,
      staircaseId: true,
      assignedToUserId: true,
      createdByUserId: true,
      category: true,
      priority: true,
      status: true,
      locationType: true,
      title: true,
      description: true,
      resolvedAt: true,
      createdAt: true,
      updatedAt: true,
      building: { select: { id: true, name: true } },
      staircase: { select: { id: true, name: true } },
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
      assignedTo: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
        },
      },
      comments: {
        select: {
          id: true,
          message: true,
          isInternal: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
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
      contentType: true,
      importance: true,
      isPinned: true,
      commentsEnabled: true,
      targetType: true,
      buildingId: true,
      staircaseId: true,
      apartmentId: true,
      createdByUserId: true,
      createdAt: true,
      updatedAt: true,
      building: { select: { id: true, name: true } },
      staircase: { select: { id: true, name: true } },
      apartment: { select: { id: true, number: true } },
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

  private toRequest(row: any, store?: RequestMetadataStore, includeInternal = false) {
    const meta = this.requestMeta(row, store);
    const publicComments = (row.comments || []).filter((comment: any) => !comment.isInternal);
    const visibleComments = (row.comments || []).filter((comment: any) => includeInternal || !comment.isInternal);
    const lastMessage = publicComments[publicComments.length - 1];
    const apartment = row.apartment
      ? {
          id: row.apartment.id,
          apartmentNumber: row.apartment.number,
          number: row.apartment.number,
          staircase: row.apartment.staircase?.name || row.staircase?.name || null,
          floor: row.apartment.floor,
        }
      : null;
    const resident = row.resident
      ? {
          id: row.resident.id,
          fullName: this.fullName(row.resident),
          phone: row.resident.phone,
          email: row.resident.email,
        }
      : null;
    const assignedTo = row.assignedTo
      ? {
          id: row.assignedTo.id,
          fullName: this.fullName(row.assignedTo),
          email: row.assignedTo.email,
        }
      : null;
    return {
      id: row.id,
      organizationId: row.organizationId,
      requestNumber: meta.requestNumber,
      title: row.title,
      description: row.description,
      category: meta.category,
      priority: meta.priority,
      status: meta.status,
      locationDetails: meta.locationDetails,
      preferredContactMethod: meta.preferredContactMethod,
      apartmentId: row.apartmentId,
      residentId: row.residentId,
      createdByUserId: row.createdByUserId,
      assignedToId: row.assignedToUserId || meta.assignedToId || null,
      apartment,
      building: row.building ? { id: row.building.id, name: row.building.name } : row.apartment?.building || null,
      staircase: row.staircase ? { id: row.staircase.id, name: row.staircase.name } : row.apartment?.staircase || null,
      resident,
      assignedTo,
      lastMessagePreview: lastMessage?.message ? this.preview(lastMessage.message, 120) : null,
      messages: visibleComments.map((comment: any) => ({
        id: comment.id,
        messageType: comment.isInternal ? 'INTERNAL_NOTE' : 'PUBLIC_COMMENT',
        message: comment.message,
        author: {
          id: comment.user?.id || null,
          name: this.fullName(comment.user) || (comment.user?.role === Role.ADMIN ? 'Administrator' : 'Locatar'),
          role: comment.user?.role || null,
        },
        createdAt: comment.createdAt,
      })),
      timeline: [
        {
          type: 'STATUS_CHANGE',
          oldStatus: null,
          newStatus: 'NEW',
          message: 'Solicitarea a fost creată.',
          createdAt: row.createdAt,
          authorUserId: row.createdByUserId,
        },
        ...(meta.timeline || []),
      ],
      resolvedAt: meta.resolvedAt || row.resolvedAt || null,
      closedAt: meta.closedAt,
      cancelledAt: meta.cancelledAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private emptyRequestMetadataStore(): RequestMetadataStore {
    return { items: {}, counters: {} };
  }

  private async readRequestMetadata(organizationId: string): Promise<RequestMetadataStore> {
    const note = await this.prisma.clientNote.findFirst({
      where: { organizationId, title: REQUEST_METADATA_TITLE },
      orderBy: { updatedAt: 'desc' },
      select: { content: true },
    });
    if (!note?.content) return this.emptyRequestMetadataStore();
    try {
      const parsed = JSON.parse(note.content);
      return {
        items: parsed?.items && typeof parsed.items === 'object' ? parsed.items : {},
        counters: parsed?.counters && typeof parsed.counters === 'object' ? parsed.counters : {},
      };
    } catch {
      return this.emptyRequestMetadataStore();
    }
  }

  private async writeRequestMetadata(organizationId: string, userId: string, store: RequestMetadataStore) {
    const existing = await this.prisma.clientNote.findFirst({
      where: { organizationId, title: REQUEST_METADATA_TITLE },
      select: { id: true },
    });
    const content = JSON.stringify(store);
    if (existing) {
      await this.prisma.clientNote.update({ where: { id: existing.id }, data: { content } });
      return;
    }
    await this.prisma.clientNote.create({
      data: {
        organizationId,
        createdByUserId: userId,
        title: REQUEST_METADATA_TITLE,
        content,
      },
    });
  }

  private requestMeta(row: any, store?: RequestMetadataStore): RequestMetadata {
    const existing = (store?.items?.[row.id] || {}) as Partial<RequestMetadata>;
    return {
      requestNumber: typeof existing.requestNumber === 'string' && existing.requestNumber ? existing.requestNumber : this.fallbackRequestNumber(row),
      category: this.normalizeRequestCategory(existing.category || this.requestCategoryFromPrisma(row.category)),
      priority: this.normalizeRequestPriority(existing.priority || this.requestPriorityFromPrisma(row.priority)),
      status: this.normalizeRequestStatus(existing.status || this.requestStatusFromPrisma(row.status)),
      locationDetails: typeof existing.locationDetails === 'string' && existing.locationDetails ? existing.locationDetails : null,
      preferredContactMethod: typeof existing.preferredContactMethod === 'string' && existing.preferredContactMethod ? existing.preferredContactMethod : null,
      createdByResidentId: typeof existing.createdByResidentId === 'string' ? existing.createdByResidentId : row.residentId || null,
      resolvedAt: typeof existing.resolvedAt === 'string' ? existing.resolvedAt : row.resolvedAt?.toISOString?.() || null,
      closedAt: typeof existing.closedAt === 'string' ? existing.closedAt : null,
      cancelledAt: typeof existing.cancelledAt === 'string' ? existing.cancelledAt : null,
      assignedToId: typeof existing.assignedToId === 'string' ? existing.assignedToId : row.assignedToUserId || null,
      timeline: Array.isArray(existing.timeline) ? existing.timeline : [],
    };
  }

  private fallbackRequestNumber(row: any) {
    const date = new Date(row.createdAt || Date.now());
    const yearMonth = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
    const hash = String(row.id || '')
      .split('')
      .reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return `REQ-${yearMonth}-${String((hash % 9999) + 1).padStart(4, '0')}`;
  }

  private nextRequestNumber(store: RequestMetadataStore) {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const next = Number(store.counters[yearMonth] || 0) + 1;
    store.counters[yearMonth] = next;
    return `REQ-${yearMonth}-${String(next).padStart(4, '0')}`;
  }

  private normalizeRequestCategory(value: unknown): RequestCategoryValue {
    const normalized = typeof value === 'string' ? value.trim().toUpperCase() : 'OTHER';
    if (REQUEST_CATEGORIES.includes(normalized as RequestCategoryValue)) return normalized as RequestCategoryValue;
    if (normalized === 'REPAIR' || normalized === 'WATER' || normalized === 'HEATING' || normalized === 'ELEVATOR' || normalized === 'ELECTRICITY') return 'MAINTENANCE';
    if (normalized === 'SECURITY') return 'ACCESS';
    throw new BadRequestException('Categoria solicitării nu este validă.');
  }

  private normalizeRequestPriority(value: unknown): RequestPriorityValue {
    const normalized = typeof value === 'string' ? value.trim().toUpperCase() : 'NORMAL';
    if (REQUEST_PRIORITIES.includes(normalized as RequestPriorityValue)) return normalized as RequestPriorityValue;
    if (normalized === 'MEDIUM' || normalized === 'IMPORTANT') return 'NORMAL';
    throw new BadRequestException('Prioritatea solicitării nu este validă.');
  }

  private normalizeRequestStatus(value: unknown): RequestStatusValue {
    const normalized = typeof value === 'string' ? value.trim().toUpperCase() : 'NEW';
    if (REQUEST_STATUSES.includes(normalized as RequestStatusValue)) return normalized as RequestStatusValue;
    if (normalized === 'WAITING') return 'WAITING_FOR_RESIDENT';
    throw new BadRequestException('Statusul solicitării nu este valid.');
  }

  private requestCategoryFromPrisma(value?: string | null): RequestCategoryValue {
    if (value === IssueCategory.CLEANING) return 'CLEANING';
    if (value === IssueCategory.SECURITY) return 'ACCESS';
    if (value && value !== IssueCategory.OTHER) return 'MAINTENANCE';
    return 'OTHER';
  }

  private requestCategoryToPrisma(value: RequestCategoryValue): IssueCategory {
    if (value === 'CLEANING') return IssueCategory.CLEANING;
    if (value === 'ACCESS') return IssueCategory.SECURITY;
    if (value === 'MAINTENANCE' || value === 'TECHNICAL' || value === 'COMMON_AREA') return IssueCategory.REPAIR;
    return IssueCategory.OTHER;
  }

  private requestPriorityFromPrisma(value?: string | null): RequestPriorityValue {
    if (value === IssuePriority.URGENT) return 'URGENT';
    if (value === IssuePriority.HIGH) return 'HIGH';
    if (value === IssuePriority.LOW) return 'LOW';
    return 'NORMAL';
  }

  private requestPriorityToPrisma(value: RequestPriorityValue): IssuePriority {
    if (value === 'URGENT') return IssuePriority.URGENT;
    if (value === 'HIGH') return IssuePriority.HIGH;
    if (value === 'LOW') return IssuePriority.LOW;
    return IssuePriority.NORMAL;
  }

  private requestStatusFromPrisma(value?: string | null): RequestStatusValue {
    if (value === IssueStatus.IN_PROGRESS) return 'IN_PROGRESS';
    if (value === IssueStatus.WAITING) return 'WAITING_FOR_RESIDENT';
    if (value === IssueStatus.RESOLVED) return 'RESOLVED';
    if (value === IssueStatus.CLOSED) return 'CLOSED';
    return 'NEW';
  }

  private requestStatusToPrisma(value: RequestStatusValue): IssueStatus {
    if (value === 'IN_PROGRESS') return IssueStatus.IN_PROGRESS;
    if (value === 'WAITING_FOR_RESIDENT') return IssueStatus.WAITING;
    if (value === 'RESOLVED') return IssueStatus.RESOLVED;
    if (value === 'CLOSED' || value === 'CANCELLED') return IssueStatus.CLOSED;
    return IssueStatus.NEW;
  }

  private toAnnouncement(row: any, store?: AnnouncementMetadataStore, readAt?: string | null, targetedResidents = 0) {
    const meta = this.announcementMeta(row, store);
    const readCount = Object.keys(store?.reads?.[row.id] || {}).length;
    return {
      id: row.id,
      organizationId: row.organizationId,
      title: row.title,
      excerpt: meta.excerpt || this.preview(row.content, 160),
      body: row.content,
      content: row.content,
      preview: this.preview(row.content),
      category: meta.category,
      priority: meta.priority,
      status: meta.status,
      visibilityType: meta.visibilityType,
      visibleToResidents: meta.visibleToResidents,
      pinned: meta.pinned,
      isPinned: meta.pinned,
      publishAt: meta.publishAt,
      publishedAt: meta.publishedAt,
      expiresAt: meta.expiresAt,
      archivedAt: meta.archivedAt,
      readCount,
      targetedResidents,
      readRate: targetedResidents > 0 ? Math.round((readCount / targetedResidents) * 10000) / 100 : 0,
      isRead: Boolean(readAt),
      readAt: readAt || null,
      audience: this.visibilityLabel(meta, row),
      targetType: row.targetType || 'ORGANIZATION',
      building: row.building || null,
      staircase: row.staircase || null,
      apartment: row.apartment || null,
      targets: {
        staircaseIds: meta.staircaseIds,
        apartmentIds: meta.apartmentIds,
        roles: meta.roles,
      },
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

  private emptyAnnouncementMetadataStore(): AnnouncementMetadataStore {
    return { items: {}, reads: {} };
  }

  private async readAnnouncementMetadata(organizationId: string): Promise<AnnouncementMetadataStore> {
    const note = await this.prisma.clientNote.findFirst({
      where: { organizationId, title: ANNOUNCEMENT_METADATA_TITLE },
      orderBy: { updatedAt: 'desc' },
      select: { content: true },
    });
    if (!note?.content) return this.emptyAnnouncementMetadataStore();
    try {
      const parsed = JSON.parse(note.content);
      return {
        items: parsed?.items && typeof parsed.items === 'object' ? parsed.items : {},
        reads: parsed?.reads && typeof parsed.reads === 'object' ? parsed.reads : {},
      };
    } catch {
      return this.emptyAnnouncementMetadataStore();
    }
  }

  private async writeAnnouncementMetadata(organizationId: string, userId: string, store: AnnouncementMetadataStore) {
    const existing = await this.prisma.clientNote.findFirst({
      where: { organizationId, title: ANNOUNCEMENT_METADATA_TITLE },
      select: { id: true },
    });
    const content = JSON.stringify(store);
    if (existing) {
      await this.prisma.clientNote.update({ where: { id: existing.id }, data: { content } });
      return;
    }
    await this.prisma.clientNote.create({
      data: {
        organizationId,
        createdByUserId: userId,
        title: ANNOUNCEMENT_METADATA_TITLE,
        content,
      },
    });
  }

  private announcementMeta(row: any, store?: AnnouncementMetadataStore): AnnouncementMetadata {
    const existing = (store?.items?.[row.id] || {}) as Partial<AnnouncementMetadata>;
    const category = this.normalizeAnnouncementCategory(existing.category || this.categoryFromPrisma(row.category));
    const priority = this.normalizeAnnouncementPriority(existing.priority || this.priorityFromPrisma(row.importance));
    const status = this.normalizeAnnouncementStatus(existing.status || (row.status === AnnouncementStatus.ARCHIVED ? 'ARCHIVED' : 'PUBLISHED'));
    const visibilityType = this.normalizeAnnouncementVisibility(existing.visibilityType || this.visibilityFromTargetType(row.targetType));
    return {
      excerpt: typeof existing.excerpt === 'string' ? existing.excerpt : '',
      category,
      priority,
      status,
      visibilityType,
      visibleToResidents: existing.visibleToResidents !== false,
      pinned: existing.pinned !== undefined ? Boolean(existing.pinned) : Boolean(row.isPinned),
      publishAt: typeof existing.publishAt === 'string' && existing.publishAt ? existing.publishAt : null,
      publishedAt: typeof existing.publishedAt === 'string' && existing.publishedAt ? existing.publishedAt : row.createdAt?.toISOString?.() || null,
      publishedById: typeof existing.publishedById === 'string' ? existing.publishedById : null,
      expiresAt: typeof existing.expiresAt === 'string' && existing.expiresAt ? existing.expiresAt : null,
      archivedAt: typeof existing.archivedAt === 'string' && existing.archivedAt ? existing.archivedAt : null,
      archivedById: typeof existing.archivedById === 'string' ? existing.archivedById : null,
      staircaseIds: Array.isArray(existing.staircaseIds) ? existing.staircaseIds.filter(Boolean).map(String) : row.staircaseId ? [row.staircaseId] : [],
      apartmentIds: Array.isArray(existing.apartmentIds) ? existing.apartmentIds.filter(Boolean).map(String) : row.apartmentId ? [row.apartmentId] : [],
      roles: Array.isArray(existing.roles) ? existing.roles.filter(Boolean).map((item) => String(item).toUpperCase()) : [],
      createdById: typeof existing.createdById === 'string' ? existing.createdById : row.createdByUserId || null,
    };
  }

  private visibilityLabel(meta: AnnouncementMetadata, row: any) {
    if (meta.visibilityType === 'BY_STAIRCASE') return `Scări: ${meta.staircaseIds.length || (row.staircase ? 1 : 0)}`;
    if (meta.visibilityType === 'BY_APARTMENTS') return `Apartamente: ${meta.apartmentIds.length || (row.apartment ? 1 : 0)}`;
    if (meta.visibilityType === 'BY_ROLE') return `Roluri: ${meta.roles.join(', ') || '-'}`;
    return 'Toată asociația';
  }

  private categoryFromPrisma(value?: string | null): AnnouncementCategoryValue {
    if (value === AnnouncementCategory.REPAIR) return 'MAINTENANCE';
    if (value === AnnouncementCategory.URGENT) return 'EMERGENCY';
    return 'GENERAL';
  }

  private categoryToPrisma(value: AnnouncementCategoryValue): AnnouncementCategory {
    if (value === 'MAINTENANCE') return AnnouncementCategory.REPAIR;
    if (value === 'EMERGENCY') return AnnouncementCategory.URGENT;
    if (value === 'PAYMENTS' || value === 'MEETING' || value === 'DOCUMENTS') return AnnouncementCategory.ADMINISTRATION;
    return AnnouncementCategory.GENERAL;
  }

  private priorityFromPrisma(value?: string | null): AnnouncementPriorityValue {
    if (value === ContentImportance.URGENT) return 'URGENT';
    if (value === ContentImportance.IMPORTANT) return 'HIGH';
    return 'NORMAL';
  }

  private priorityToPrisma(value: AnnouncementPriorityValue): ContentImportance {
    if (value === 'URGENT') return ContentImportance.URGENT;
    if (value === 'HIGH') return ContentImportance.IMPORTANT;
    return ContentImportance.NORMAL;
  }

  private visibilityFromTargetType(value?: string | null): AnnouncementVisibilityTypeValue {
    if (value === ContentTargetType.STAIRCASE) return 'BY_STAIRCASE';
    if (value === ContentTargetType.APARTMENT) return 'BY_APARTMENTS';
    return 'ALL_RESIDENTS';
  }

  private visibilityToTargetType(value: AnnouncementVisibilityTypeValue): ContentTargetType {
    if (value === 'BY_STAIRCASE') return ContentTargetType.STAIRCASE;
    if (value === 'BY_APARTMENTS') return ContentTargetType.APARTMENT;
    return ContentTargetType.ORGANIZATION;
  }

  private normalizeAnnouncementCategory(value: unknown): AnnouncementCategoryValue {
    const normalized = typeof value === 'string' ? value.trim().toUpperCase() : 'GENERAL';
    if (ANNOUNCEMENT_CATEGORIES.includes(normalized as AnnouncementCategoryValue)) return normalized as AnnouncementCategoryValue;
    if (normalized === 'REPAIR') return 'MAINTENANCE';
    if (normalized === 'URGENT') return 'EMERGENCY';
    if (normalized === 'ADMINISTRATION') return 'GENERAL';
    throw new BadRequestException('Categoria nu este validă.');
  }

  private normalizeAnnouncementPriority(value: unknown): AnnouncementPriorityValue {
    const normalized = typeof value === 'string' ? value.trim().toUpperCase() : 'NORMAL';
    if (ANNOUNCEMENT_PRIORITIES.includes(normalized as AnnouncementPriorityValue)) return normalized as AnnouncementPriorityValue;
    if (normalized === 'IMPORTANT') return 'HIGH';
    throw new BadRequestException('Prioritatea nu este validă.');
  }

  private normalizeAnnouncementStatus(value: unknown): AnnouncementStatusValue {
    const normalized = typeof value === 'string' ? value.trim().toUpperCase() : 'DRAFT';
    if (ANNOUNCEMENT_STATUSES.includes(normalized as AnnouncementStatusValue)) return normalized as AnnouncementStatusValue;
    if (normalized === 'ACTIVE') return 'PUBLISHED';
    throw new BadRequestException('Statusul anunțului nu este valid.');
  }

  private normalizeAnnouncementVisibility(value: unknown): AnnouncementVisibilityTypeValue {
    const normalized = typeof value === 'string' ? value.trim().toUpperCase() : 'ALL_RESIDENTS';
    if (ANNOUNCEMENT_VISIBILITY_TYPES.includes(normalized as AnnouncementVisibilityTypeValue)) return normalized as AnnouncementVisibilityTypeValue;
    if (normalized === 'ORGANIZATION') return 'ALL_RESIDENTS';
    if (normalized === 'STAIRCASE') return 'BY_STAIRCASE';
    if (normalized === 'APARTMENT') return 'BY_APARTMENTS';
    throw new BadRequestException('Vizibilitatea nu este validă.');
  }

  private normalizeRoles(value: unknown): string[] {
    const raw = Array.isArray(value)
      ? value
      : typeof value === 'string'
        ? value.split(',')
        : [];
    return Array.from(
      new Set(
        raw
          .map((item) => String(item || '').trim().toUpperCase())
          .filter((item) => ANNOUNCEMENT_ROLES.includes(item as any)),
      ),
    );
  }

  private normalizeStringList(value: unknown): string[] {
    const raw = Array.isArray(value)
      ? value
      : typeof value === 'string'
        ? value.split(',')
        : [];
    return Array.from(new Set(raw.map((item) => String(item || '').trim()).filter(Boolean)));
  }

  private optionalIsoDate(value: unknown, message: string) {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'string') throw new BadRequestException(message);
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException(message);
    return date.toISOString();
  }

  private async residentScope(organizationId: string, userId: string): Promise<ResidentAnnouncementScope> {
    const profiles = await this.prisma.residentProfile.findMany({
      where: { organizationId, userId },
      select: {
        id: true,
        type: true,
        apartment: { select: { id: true, buildingId: true, staircaseId: true, staircase: { select: { name: true } } } },
        apartmentResidents: {
          select: {
            role: true,
            apartment: { select: { id: true, buildingId: true, staircaseId: true, staircase: { select: { name: true } } } },
          },
        },
      },
    });
    const apartmentIds = new Set<string>();
    const buildingIds = new Set<string>();
    const staircaseIds = new Set<string>();
    const staircaseNames = new Set<string>();
    const roles = new Set<string>();
    profiles.forEach((profile) => {
      if (profile.type) roles.add(String(profile.type).toUpperCase());
      if (profile.apartment?.id) apartmentIds.add(profile.apartment.id);
      if (profile.apartment?.buildingId) buildingIds.add(profile.apartment.buildingId);
      if (profile.apartment?.staircaseId) staircaseIds.add(profile.apartment.staircaseId);
      if (profile.apartment?.staircase?.name) staircaseNames.add(profile.apartment.staircase.name);
      profile.apartmentResidents.forEach((relation) => {
        if (relation.role) roles.add(String(relation.role).toUpperCase());
        if (relation.apartment?.id) apartmentIds.add(relation.apartment.id);
        if (relation.apartment?.buildingId) buildingIds.add(relation.apartment.buildingId);
        if (relation.apartment?.staircaseId) staircaseIds.add(relation.apartment.staircaseId);
        if (relation.apartment?.staircase?.name) staircaseNames.add(relation.apartment.staircase.name);
      });
    });
    return {
      residentIds: profiles.map((profile) => profile.id),
      apartmentIds: Array.from(apartmentIds),
      buildingIds: Array.from(buildingIds),
      staircaseIds: Array.from(staircaseIds),
      staircaseNames: Array.from(staircaseNames),
      roles: Array.from(roles),
    };
  }

  private isAnnouncementVisibleToResident(row: any, meta: AnnouncementMetadata, scope: ResidentAnnouncementScope, now = new Date()) {
    if (!meta.visibleToResidents) return false;
    if (row.status === AnnouncementStatus.ARCHIVED || meta.status === 'ARCHIVED' || meta.status === 'DRAFT') return false;
    if (meta.publishAt && new Date(meta.publishAt) > now) return false;
    if (meta.status === 'SCHEDULED' && !meta.publishAt) return false;
    if (meta.expiresAt && new Date(meta.expiresAt) < now) return false;
    if (meta.visibilityType === 'ALL_RESIDENTS') return true;
    if (meta.visibilityType === 'BY_APARTMENTS') {
      const targets = meta.apartmentIds.length ? meta.apartmentIds : row.apartmentId ? [row.apartmentId] : [];
      return targets.some((id) => scope.apartmentIds.includes(id));
    }
    if (meta.visibilityType === 'BY_STAIRCASE') {
      const targets = meta.staircaseIds.length ? meta.staircaseIds : row.staircaseId ? [row.staircaseId] : [];
      return targets.some((id) => scope.staircaseIds.includes(id) || scope.staircaseNames.includes(id) || scope.staircaseNames.includes(String(id).replace(/^Scara\s*/i, '').trim()));
    }
    if (meta.visibilityType === 'BY_ROLE') {
      return meta.roles.some((role) => scope.roles.includes(role));
    }
    return false;
  }

  private readKeyForScope(scope: ResidentAnnouncementScope, userId: string) {
    return scope.residentIds[0] || userId;
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

  private adminOrganizationId(user: MvpUser, payload?: Record<string, unknown>) {
    if (!this.isSuperadmin(user)) return user.organizationId;
    const requested =
      typeof payload?.organizationId === 'string' && payload.organizationId.trim()
        ? payload.organizationId.trim()
        : user.organizationId;
    if (!requested) throw new BadRequestException('Asociația este obligatorie.');
    return requested;
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

  async listResidentRequests(user: MvpUser, query: Record<string, string | undefined>) {
    const scope = await this.residentScope(user.organizationId, user.id);
    const store = await this.readRequestMetadata(user.organizationId);
    const rows = await this.prisma.issue.findMany({
      where: {
        organizationId: user.organizationId,
        OR: [
          { createdByUserId: user.id },
          { residentId: { in: scope.residentIds.length ? scope.residentIds : ['__none__'] } },
          { apartmentId: { in: scope.apartmentIds.length ? scope.apartmentIds : ['__none__'] } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      select: this.issueSelect(),
    });
    const association = await this.getOrganizationBadge(user.organizationId);
    const allItems = rows.map((row) => this.toRequest(row, store, false));
    const filtered = this.filterRequests(allItems, query, false);
    const sorted = this.sortRequests(filtered, query.sortBy, query.sortDirection);
    const page = this.positiveInt(query.page, 1);
    const limit = Math.min(this.positiveInt(query.limit, 20), 100);
    const start = (page - 1) * limit;
    return {
      items: sorted.slice(start, start + limit),
      meta: { page, limit, total: sorted.length },
      stats: this.requestStats(allItems),
      association,
      apartments: await this.residentRequestApartments(user.organizationId, scope),
    };
  }

  async getResidentRequestStats(user: MvpUser) {
    const result = await this.listResidentRequests(user, { limit: '1000' });
    return result.stats;
  }

  async createResidentRequest(user: MvpUser, body: unknown) {
    const payload = this.objectPayload(body);
    const scope = await this.residentScope(user.organizationId, user.id);
    if (!scope.apartmentIds.length) throw new BadRequestException('Contul tău nu este conectat încă la un apartament.');
    const apartmentId = this.requiredString(payload.apartmentId || scope.apartmentIds[0], 'Apartamentul este obligatoriu.');
    if (!scope.apartmentIds.includes(apartmentId)) throw new ForbiddenException('Nu ai acces la acest apartament.');
    const apartment = await this.prisma.apartment.findFirst({
      where: { id: apartmentId, organizationId: user.organizationId },
      select: { id: true, buildingId: true, staircaseId: true },
    });
    if (!apartment) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    const title = this.requiredString(payload.title, 'Titlul solicitării este obligatoriu.');
    if (title.length < 3) throw new BadRequestException('Titlul trebuie să aibă cel puțin 3 caractere.');
    const description = this.requiredString(payload.description, 'Descrierea solicitării este obligatorie.');
    if (description.length < 10) throw new BadRequestException('Descrierea trebuie să aibă cel puțin 10 caractere.');
    const category = this.normalizeRequestCategory(payload.category);
    const priority = payload.priority ? this.normalizeRequestPriority(payload.priority) : 'NORMAL';
    const residentId = scope.residentIds[0] || null;
    const store = await this.readRequestMetadata(user.organizationId);
    const requestNumber = this.nextRequestNumber(store);

    const issue = await this.prisma.issue.create({
      data: {
        organizationId: user.organizationId,
        apartmentId,
        buildingId: apartment.buildingId,
        staircaseId: apartment.staircaseId,
        residentId,
        createdByUserId: user.id,
        title,
        description,
        category: this.requestCategoryToPrisma(category),
        priority: this.requestPriorityToPrisma(priority),
        status: IssueStatus.NEW,
        locationType: 'APARTMENT',
      },
      select: this.issueSelect(),
    });
    store.items[issue.id] = {
      requestNumber,
      category,
      priority,
      status: 'NEW',
      locationDetails: typeof payload.locationDetails === 'string' && payload.locationDetails.trim() ? payload.locationDetails.trim() : null,
      preferredContactMethod:
        typeof payload.preferredContactMethod === 'string' && payload.preferredContactMethod.trim()
          ? payload.preferredContactMethod.trim().toUpperCase()
          : null,
      createdByResidentId: residentId,
      resolvedAt: null,
      closedAt: null,
      cancelledAt: null,
      assignedToId: null,
      timeline: [],
    };
    await this.writeRequestMetadata(user.organizationId, user.id, store);

    await this.activity.createActivity({
      organizationId: user.organizationId,
      actorUserId: user.id,
      type: 'ISSUE_CREATED',
      title: 'Solicitare nouă',
      message: `Solicitarea „${title}” a fost trimisă de locatar.`,
      targetType: 'ISSUE',
      targetId: issue.id,
      link: `/admin/requests/${issue.id}`,
    });

    return this.toRequest(issue, store, false);
  }

  async getResidentRequest(user: MvpUser, id: string) {
    const { row, store } = await this.findResidentRequest(user, id);
    const association = await this.getOrganizationBadge(row.organizationId);
    return {
      request: this.toRequest(row, store, false),
      association,
    };
  }

  async addResidentRequestComment(user: MvpUser, id: string, body: unknown) {
    const { row } = await this.findResidentRequest(user, id);
    const message = this.requiredString(this.objectPayload(body).message, 'Comentariul este obligatoriu.');
    const comment = await this.prisma.issueComment.create({
      data: { issueId: row.id, userId: user.id, message, isInternal: false },
    });
    await this.activity.createActivity({
      organizationId: row.organizationId,
      actorUserId: user.id,
      type: 'ISSUE_STATUS_UPDATED',
      title: 'Comentariu nou la solicitare',
      message: `Locatarul a adăugat un comentariu la „${row.title}”.`,
      targetType: 'ISSUE',
      targetId: row.id,
      link: `/admin/requests/${row.id}`,
    });
    return comment;
  }

  async cancelResidentRequest(user: MvpUser, id: string) {
    const { row, store } = await this.findResidentRequest(user, id);
    const meta = this.requestMeta(row, store);
    if (!['NEW', 'IN_REVIEW'].includes(meta.status)) throw new BadRequestException('Solicitarea nu mai poate fi anulată.');
    return this.changeRequestStatus(row, store, user.id, meta.status, 'CANCELLED', 'Solicitarea a fost anulată de locatar.');
  }

  async closeResidentRequest(user: MvpUser, id: string) {
    const { row, store } = await this.findResidentRequest(user, id);
    const meta = this.requestMeta(row, store);
    if (meta.status !== 'RESOLVED') throw new BadRequestException('Poți închide doar o solicitare rezolvată.');
    return this.changeRequestStatus(row, store, user.id, meta.status, 'CLOSED', 'Solicitarea a fost închisă de locatar.');
  }

  async markResidentRequestResolved(user: MvpUser, id: string) {
    const { row, store } = await this.findResidentRequest(user, id);
    const meta = this.requestMeta(row, store);
    if (!['WAITING_FOR_RESIDENT', 'IN_PROGRESS'].includes(meta.status)) {
      throw new BadRequestException('Solicitarea nu poate fi marcată ca rezolvată în acest status.');
    }
    return this.changeRequestStatus(row, store, user.id, meta.status, 'RESOLVED', 'Locatarul a confirmat rezolvarea solicitării.');
  }

  async listAdminRequests(user: MvpUser, query: Record<string, string | undefined>) {
    const organizationId = this.adminOrganizationId(user, query);
    this.assertOrganizationAccess(user, organizationId);
    const store = await this.readRequestMetadata(organizationId);
    const rows = await this.prisma.issue.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      select: this.issueSelect(),
    });
    const allItems = rows.map((row) => this.toRequest(row, store, true));
    const filtered = this.filterRequests(allItems, query, true);
    const sorted = this.sortRequests(filtered, query.sortBy, query.sortDirection);
    const page = this.positiveInt(query.page, 1);
    const limit = Math.min(this.positiveInt(query.limit, 20), 100);
    const start = (page - 1) * limit;
    return {
      items: sorted.slice(start, start + limit),
      meta: { page, limit, total: sorted.length },
      stats: this.requestStats(allItems),
      association: await this.getOrganizationBadge(organizationId),
    };
  }

  async getAdminRequestStats(user: MvpUser) {
    const result = await this.listAdminRequests(user, { limit: '1000' });
    return result.stats;
  }

  async getAdminRequest(user: MvpUser, id: string) {
    const row = await this.findAdminRequest(user, id);
    const store = await this.readRequestMetadata(row.organizationId);
    return {
      request: this.toRequest(row, store, true),
      association: await this.getOrganizationBadge(row.organizationId),
    };
  }

  async updateAdminRequestStatus(user: MvpUser, id: string, body: unknown) {
    const row = await this.findAdminRequest(user, id);
    const store = await this.readRequestMetadata(row.organizationId);
    const meta = this.requestMeta(row, store);
    const nextStatus = this.normalizeRequestStatus(this.objectPayload(body).status);
    return this.changeRequestStatus(row, store, user.id, meta.status, nextStatus, `Status schimbat la ${nextStatus}.`);
  }

  async updateAdminRequestPriority(user: MvpUser, id: string, body: unknown) {
    const row = await this.findAdminRequest(user, id);
    const store = await this.readRequestMetadata(row.organizationId);
    const meta = this.requestMeta(row, store);
    const nextPriority = this.normalizeRequestPriority(this.objectPayload(body).priority);
    store.items[row.id] = { ...meta, priority: nextPriority };
    const updated = await this.prisma.issue.update({
      where: { id: row.id },
      data: { priority: this.requestPriorityToPrisma(nextPriority) },
      select: this.issueSelect(),
    });
    await this.writeRequestMetadata(row.organizationId, user.id, store);
    return this.toRequest(updated, store, true);
  }

  async assignAdminRequest(user: MvpUser, id: string, body: unknown) {
    const row = await this.findAdminRequest(user, id);
    const payload = this.objectPayload(body);
    const assignedToId =
      typeof payload.assignedToId === 'string'
        ? payload.assignedToId.trim()
        : typeof payload.assignedToUserId === 'string'
          ? payload.assignedToUserId.trim()
          : user.id;
    if (assignedToId) {
      const assignee = await this.prisma.user.findFirst({
        where: { id: assignedToId, organizationId: row.organizationId, role: Role.ADMIN, deletedAt: null },
        select: { id: true },
      });
      if (!assignee) throw new BadRequestException('Administratorul selectat nu este valid.');
    }
    const store = await this.readRequestMetadata(row.organizationId);
    const meta = this.requestMeta(row, store);
    store.items[row.id] = { ...meta, assignedToId: assignedToId || null };
    const updated = await this.prisma.issue.update({
      where: { id: row.id },
      data: { assignedToUserId: assignedToId || null },
      select: this.issueSelect(),
    });
    await this.writeRequestMetadata(row.organizationId, user.id, store);
    return this.toRequest(updated, store, true);
  }

  async addAdminRequestComment(user: MvpUser, id: string, body: unknown) {
    const row = await this.findAdminRequest(user, id);
    const message = this.requiredString(this.objectPayload(body).message, 'Comentariul este obligatoriu.');
    return this.prisma.issueComment.create({
      data: { issueId: row.id, userId: user.id, message, isInternal: false },
    });
  }

  async addAdminRequestInternalNote(user: MvpUser, id: string, body: unknown) {
    const row = await this.findAdminRequest(user, id);
    const message = this.requiredString(this.objectPayload(body).message, 'Nota internă este obligatorie.');
    return this.prisma.issueComment.create({
      data: { issueId: row.id, userId: user.id, message, isInternal: true },
    });
  }

  async resolveAdminRequest(user: MvpUser, id: string) {
    const row = await this.findAdminRequest(user, id);
    const store = await this.readRequestMetadata(row.organizationId);
    const meta = this.requestMeta(row, store);
    return this.changeRequestStatus(row, store, user.id, meta.status, 'RESOLVED', 'Solicitarea a fost marcată ca rezolvată.');
  }

  async closeAdminRequest(user: MvpUser, id: string) {
    const row = await this.findAdminRequest(user, id);
    const store = await this.readRequestMetadata(row.organizationId);
    const meta = this.requestMeta(row, store);
    return this.changeRequestStatus(row, store, user.id, meta.status, 'CLOSED', 'Solicitarea a fost închisă.');
  }

  async reopenAdminRequest(user: MvpUser, id: string) {
    const row = await this.findAdminRequest(user, id);
    const store = await this.readRequestMetadata(row.organizationId);
    const meta = this.requestMeta(row, store);
    return this.changeRequestStatus(row, store, user.id, meta.status, 'IN_PROGRESS', 'Solicitarea a fost redeschisă.');
  }

  async listAdminResidentRequests(user: MvpUser, residentId: string) {
    const organizationId = this.adminOrganizationId(user);
    this.assertOrganizationAccess(user, organizationId);
    const store = await this.readRequestMetadata(organizationId);
    const rows = await this.prisma.issue.findMany({
      where: { organizationId, residentId },
      orderBy: { createdAt: 'desc' },
      select: this.issueSelect(),
    });
    return { items: rows.map((row) => this.toRequest(row, store, true)), meta: { total: rows.length } };
  }

  async listAdminApartmentRequests(user: MvpUser, apartmentId: string) {
    const organizationId = this.adminOrganizationId(user);
    this.assertOrganizationAccess(user, organizationId);
    const store = await this.readRequestMetadata(organizationId);
    const rows = await this.prisma.issue.findMany({
      where: { organizationId, apartmentId },
      orderBy: { createdAt: 'desc' },
      select: this.issueSelect(),
    });
    return { items: rows.map((row) => this.toRequest(row, store, true)), meta: { total: rows.length } };
  }

  async listAnnouncements(user: MvpUser) {
    const result = await this.listAdminAnnouncements(user, {});
    return result.items;
  }

  async createAnnouncement(user: MvpUser, body: unknown) {
    return this.createAdminAnnouncement(user, body);
  }

  async getAnnouncement(user: MvpUser, id: string) {
    const result = await this.getAdminAnnouncement(user, id);
    return result.announcement;
  }

  async listAdminAnnouncements(user: MvpUser, query: Record<string, string | undefined>) {
    const organizationId = this.adminOrganizationId(user, query);
    this.assertOrganizationAccess(user, organizationId);
    const organization = await this.getOrganizationBadge(organizationId);
    const store = await this.readAnnouncementMetadata(organizationId);
    const rows = await this.prisma.announcement.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      select: this.announcementSelect(),
    });
    const allItems = await this.mapAnnouncementsWithCounts(rows, store);
    const filtered = this.filterAdminAnnouncements(allItems, query);
    const sorted = this.sortAdminAnnouncements(filtered, query.sortBy, query.sortDirection);
    const page = this.positiveInt(query.page, 1);
    const limit = Math.min(this.positiveInt(query.limit, 20), 100);
    const start = (page - 1) * limit;

    return {
      items: sorted.slice(start, start + limit),
      meta: { page, limit, total: sorted.length },
      stats: this.announcementStats(allItems),
      association: organization,
    };
  }

  async getAdminAnnouncementStats(user: MvpUser) {
    const organizationId = this.adminOrganizationId(user);
    this.assertOrganizationAccess(user, organizationId);
    const store = await this.readAnnouncementMetadata(organizationId);
    const rows = await this.prisma.announcement.findMany({
      where: { organizationId },
      select: this.announcementSelect(),
    });
    const items = await this.mapAnnouncementsWithCounts(rows, store);
    return this.announcementStats(items);
  }

  async createAdminAnnouncement(user: MvpUser, body: unknown) {
    const payload = this.objectPayload(body);
    const organizationId = this.adminOrganizationId(user, payload);
    this.assertOrganizationAccess(user, organizationId);
    await this.ensureOrganizationExists(organizationId);
    const input = this.parseAnnouncementInput(payload, undefined, false);

    const announcement = await this.prisma.announcement.create({
      data: {
        organizationId,
        title: input.title,
        content: input.body,
        category: this.categoryToPrisma(input.metadata.category),
        status: input.metadata.status === 'ARCHIVED' ? AnnouncementStatus.ARCHIVED : AnnouncementStatus.ACTIVE,
        contentType: 'ANNOUNCEMENT',
        importance: this.priorityToPrisma(input.metadata.priority),
        isPinned: input.metadata.pinned,
        commentsEnabled: false,
        targetType: this.visibilityToTargetType(input.metadata.visibilityType),
        createdByUserId: user.id,
      },
      select: this.announcementSelect(),
    });

    const store = await this.readAnnouncementMetadata(organizationId);
    store.items[announcement.id] = {
      ...input.metadata,
      createdById: user.id,
      publishedById: input.metadata.status === 'PUBLISHED' ? user.id : input.metadata.publishedById,
    };
    await this.writeAnnouncementMetadata(organizationId, user.id, store);

    await this.activity.createActivity({
      organizationId,
      actorUserId: user.id,
      type: 'ANNOUNCEMENT_CREATED',
      title: input.metadata.status === 'PUBLISHED' ? 'Anunț publicat' : 'Anunț creat',
      message: `Anunțul „${announcement.title}” a fost salvat cu statusul ${input.metadata.status}.`,
      targetType: 'ANNOUNCEMENT',
      targetId: announcement.id,
      link: `/admin/announcements/${announcement.id}`,
    });

    return this.toAnnouncement(announcement, store, null, await this.targetedResidentCount(organizationId, announcement, store.items[announcement.id]));
  }

  async getAdminAnnouncement(user: MvpUser, id: string) {
    const announcement = await this.findAdminAnnouncement(user, id);
    const store = await this.readAnnouncementMetadata(announcement.organizationId);
    const meta = this.announcementMeta(announcement, store);
    const targetedResidents = await this.targetedResidentCount(announcement.organizationId, announcement, meta);
    const association = await this.getOrganizationBadge(announcement.organizationId);
    return {
      announcement: this.toAnnouncement(announcement, store, null, targetedResidents),
      association,
      readStats: this.readStatsFor(announcement, store, targetedResidents),
    };
  }

  async updateAdminAnnouncement(user: MvpUser, id: string, body: unknown) {
    const existing = await this.findAdminAnnouncement(user, id);
    const store = await this.readAnnouncementMetadata(existing.organizationId);
    const existingMeta = this.announcementMeta(existing, store);
    if (existingMeta.status === 'ARCHIVED') {
      throw new BadRequestException('Anunțurile arhivate sunt read-only.');
    }

    const input = this.parseAnnouncementInput(this.objectPayload(body), { row: existing, meta: existingMeta }, true);
    const updated = await this.prisma.announcement.update({
      where: { id },
      data: {
        title: input.title,
        content: input.body,
        category: this.categoryToPrisma(input.metadata.category),
        status: input.metadata.status === 'ARCHIVED' ? AnnouncementStatus.ARCHIVED : AnnouncementStatus.ACTIVE,
        importance: this.priorityToPrisma(input.metadata.priority),
        isPinned: input.metadata.pinned,
        targetType: this.visibilityToTargetType(input.metadata.visibilityType),
      },
      select: this.announcementSelect(),
    });
    store.items[id] = { ...input.metadata, createdById: existingMeta.createdById || existing.createdByUserId || user.id };
    await this.writeAnnouncementMetadata(updated.organizationId, user.id, store);

    await this.activity.createActivity({
      organizationId: updated.organizationId,
      actorUserId: user.id,
      type: 'ANNOUNCEMENT_CREATED',
      title: 'Anunț actualizat',
      message: `Anunțul „${updated.title}” a fost actualizat.`,
      targetType: 'ANNOUNCEMENT',
      targetId: updated.id,
      link: `/admin/announcements/${updated.id}`,
    });

    return this.toAnnouncement(updated, store, null, await this.targetedResidentCount(updated.organizationId, updated, store.items[id]));
  }

  async publishAdminAnnouncement(user: MvpUser, id: string) {
    const existing = await this.findAdminAnnouncement(user, id);
    const store = await this.readAnnouncementMetadata(existing.organizationId);
    const meta = this.announcementMeta(existing, store);
    if (!meta.visibleToResidents) throw new BadRequestException('Anunțul trebuie să fie vizibil pentru locatari înainte de publicare.');
    if (!existing.title?.trim() || !existing.content?.trim()) throw new BadRequestException('Titlul și conținutul sunt obligatorii pentru publicare.');
    if (meta.status === 'ARCHIVED') throw new BadRequestException('Anunțurile arhivate nu pot fi publicate.');
    const nowDate = new Date();
    const now = nowDate.toISOString();
    const publishIsFuture = Boolean(meta.publishAt && new Date(meta.publishAt) > nowDate);
    const nextMeta: AnnouncementMetadata = {
      ...meta,
      status: publishIsFuture ? 'SCHEDULED' : 'PUBLISHED',
      publishedAt: publishIsFuture ? null : meta.publishedAt || now,
      publishedById: publishIsFuture ? null : user.id,
      publishAt: meta.publishAt || now,
    };
    store.items[id] = nextMeta;
    const updated = await this.prisma.announcement.update({
      where: { id },
      data: { status: AnnouncementStatus.ACTIVE, isPinned: nextMeta.pinned },
      select: this.announcementSelect(),
    });
    await this.writeAnnouncementMetadata(updated.organizationId, user.id, store);
    await this.activity.createActivity({
      organizationId: updated.organizationId,
      actorUserId: user.id,
      type: 'ANNOUNCEMENT_CREATED',
      title: 'Anunț publicat',
      message: `Anunțul „${updated.title}” a fost publicat pe avizier.`,
      targetType: 'ANNOUNCEMENT',
      targetId: updated.id,
      link: `/admin/announcements/${updated.id}`,
    });
    return this.toAnnouncement(updated, store, null, await this.targetedResidentCount(updated.organizationId, updated, nextMeta));
  }

  async archiveAdminAnnouncement(user: MvpUser, id: string) {
    const existing = await this.findAdminAnnouncement(user, id);
    const store = await this.readAnnouncementMetadata(existing.organizationId);
    const meta = this.announcementMeta(existing, store);
    const now = new Date().toISOString();
    const nextMeta: AnnouncementMetadata = { ...meta, status: 'ARCHIVED', archivedAt: now, archivedById: user.id };
    store.items[id] = nextMeta;
    const updated = await this.prisma.announcement.update({
      where: { id },
      data: { status: AnnouncementStatus.ARCHIVED },
      select: this.announcementSelect(),
    });
    await this.writeAnnouncementMetadata(updated.organizationId, user.id, store);
    return this.toAnnouncement(updated, store, null, await this.targetedResidentCount(updated.organizationId, updated, nextMeta));
  }

  async duplicateAdminAnnouncement(user: MvpUser, id: string) {
    const existing = await this.findAdminAnnouncement(user, id);
    const store = await this.readAnnouncementMetadata(existing.organizationId);
    const meta = this.announcementMeta(existing, store);
    const duplicate = await this.prisma.announcement.create({
      data: {
        organizationId: existing.organizationId,
        title: `${existing.title} (copie)`,
        content: existing.content,
        category: existing.category,
        status: AnnouncementStatus.ACTIVE,
        contentType: 'ANNOUNCEMENT',
        importance: existing.importance,
        isPinned: false,
        commentsEnabled: false,
        targetType: existing.targetType,
        createdByUserId: user.id,
      },
      select: this.announcementSelect(),
    });
    store.items[duplicate.id] = {
      ...meta,
      status: 'DRAFT',
      pinned: false,
      publishedAt: null,
      publishedById: null,
      archivedAt: null,
      archivedById: null,
      createdById: user.id,
    };
    await this.writeAnnouncementMetadata(existing.organizationId, user.id, store);
    return this.toAnnouncement(duplicate, store, null, await this.targetedResidentCount(existing.organizationId, duplicate, store.items[duplicate.id]));
  }

  async deleteAdminAnnouncement(user: MvpUser, id: string) {
    const existing = await this.findAdminAnnouncement(user, id);
    const store = await this.readAnnouncementMetadata(existing.organizationId);
    const meta = this.announcementMeta(existing, store);
    if (meta.status !== 'DRAFT') throw new BadRequestException('Doar anunțurile draft pot fi șterse. Pentru anunțurile publicate folosește arhivarea.');
    await this.prisma.announcement.delete({ where: { id } });
    delete store.items[id];
    delete store.reads[id];
    await this.writeAnnouncementMetadata(existing.organizationId, user.id, store);
    return { success: true };
  }

  async getAdminAnnouncementReadStats(user: MvpUser, id: string) {
    const announcement = await this.findAdminAnnouncement(user, id);
    const store = await this.readAnnouncementMetadata(announcement.organizationId);
    const targetedResidents = await this.targetedResidentCount(announcement.organizationId, announcement, this.announcementMeta(announcement, store));
    return this.readStatsFor(announcement, store, targetedResidents);
  }

  async listResidentAnnouncements(user: MvpUser, query: Record<string, string | undefined>) {
    const result = await this.residentAnnouncementsResult(user, query);
    return result;
  }

  async listRecentResidentAnnouncements(user: MvpUser) {
    const result = await this.residentAnnouncementsResult(user, { limit: '5', sortBy: 'priority' });
    return { ...result, items: result.items.slice(0, 5) };
  }

  async getResidentAnnouncementStats(user: MvpUser) {
    const result = await this.residentAnnouncementsResult(user, { limit: '1000' });
    return result.stats;
  }

  async getResidentAnnouncement(user: MvpUser, id: string) {
    const { announcement, store, scope } = await this.findResidentAnnouncement(user, id);
    const readKey = this.readKeyForScope(scope, user.id);
    const now = new Date().toISOString();
    store.reads[id] = { ...(store.reads[id] || {}), [readKey]: store.reads[id]?.[readKey] || now };
    await this.writeAnnouncementMetadata(announcement.organizationId, user.id, store);
    const association = await this.getOrganizationBadge(announcement.organizationId);
    return {
      announcement: this.toAnnouncement(announcement, store, store.reads[id]?.[readKey] || now),
      association,
    };
  }

  async markResidentAnnouncementRead(user: MvpUser, id: string) {
    const { announcement, store, scope } = await this.findResidentAnnouncement(user, id);
    const readKey = this.readKeyForScope(scope, user.id);
    const now = new Date().toISOString();
    store.reads[id] = { ...(store.reads[id] || {}), [readKey]: now };
    await this.writeAnnouncementMetadata(announcement.organizationId, user.id, store);
    return { success: true, readAt: now };
  }

  private async residentRequestApartments(organizationId: string, scope: ResidentAnnouncementScope) {
    if (!scope.apartmentIds.length) return [];
    const apartments = await this.prisma.apartment.findMany({
      where: { organizationId, id: { in: scope.apartmentIds } },
      select: { id: true, number: true, floor: true, staircase: { select: { id: true, name: true } } },
      orderBy: { number: 'asc' },
    });
    return apartments.map((apartment) => ({
      id: apartment.id,
      apartmentNumber: apartment.number,
      staircase: apartment.staircase?.name || null,
      floor: apartment.floor,
    }));
  }

  private filterRequests(items: any[], query: Record<string, string | undefined>, admin: boolean) {
    const search = (query.search || '').trim().toLowerCase();
    const status = query.status ? this.normalizeRequestStatus(query.status) : null;
    const category = query.category ? this.normalizeRequestCategory(query.category) : null;
    const priority = query.priority ? this.normalizeRequestPriority(query.priority) : null;
    const openOnly = query.openOnly === 'true' || query.unresolvedOnly === 'true';
    const resolvedOnly = query.resolvedOnly === 'true';
    const dateFrom = query.dateFrom ? new Date(query.dateFrom) : null;
    const dateTo = query.dateTo ? new Date(query.dateTo) : null;
    return items.filter((item) => {
      if (status && item.status !== status) return false;
      if (category && item.category !== category) return false;
      if (priority && item.priority !== priority) return false;
      if (query.apartmentId && item.apartment?.id !== query.apartmentId) return false;
      if (query.residentId && item.resident?.id !== query.residentId) return false;
      if (query.assignedToId && item.assignedTo?.id !== query.assignedToId) return false;
      if (query.staircase && String(item.apartment?.staircase || item.staircase?.name || '').toLowerCase() !== String(query.staircase).toLowerCase()) return false;
      if (openOnly && ['RESOLVED', 'CLOSED', 'CANCELLED'].includes(item.status)) return false;
      if (resolvedOnly && item.status !== 'RESOLVED' && item.status !== 'CLOSED') return false;
      if (dateFrom && new Date(item.createdAt) < dateFrom) return false;
      if (dateTo && new Date(item.createdAt) > dateTo) return false;
      if (search) {
        const haystack = [
          item.requestNumber,
          item.title,
          item.description,
          item.resident?.fullName,
          item.resident?.phone,
          item.apartment?.apartmentNumber,
          item.locationDetails,
          admin ? item.assignedTo?.fullName : '',
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
  }

  private sortRequests(items: any[], sortBy?: string, sortDirection?: string) {
    const direction = sortDirection === 'asc' || sortBy === 'oldest' ? 1 : -1;
    const priorityWeight: Record<string, number> = { URGENT: 4, HIGH: 3, NORMAL: 2, LOW: 1 };
    return [...items].sort((a, b) => {
      if (sortBy === 'priority') {
        const diff = (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
        if (diff !== 0) return diff;
      }
      if (sortBy === 'status') return String(a.status).localeCompare(String(b.status)) * direction;
      if (sortBy === 'updatedAt') return (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()) * direction;
      return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * direction;
    });
  }

  private requestStats(items: any[]) {
    const openStatuses = ['NEW', 'IN_REVIEW', 'IN_PROGRESS', 'WAITING_FOR_RESIDENT'];
    const last = [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    const resolved = items.filter((item) => item.status === 'RESOLVED');
    const resolutionHours = resolved
      .map((item) => {
        const end = item.resolvedAt ? new Date(item.resolvedAt).getTime() : 0;
        const start = item.createdAt ? new Date(item.createdAt).getTime() : 0;
        return end && start ? (end - start) / 36e5 : 0;
      })
      .filter((value) => value > 0);
    return {
      total: items.length,
      open: items.filter((item) => openStatuses.includes(item.status)).length,
      new: items.filter((item) => item.status === 'NEW').length,
      inReview: items.filter((item) => item.status === 'IN_REVIEW').length,
      inProgress: items.filter((item) => item.status === 'IN_PROGRESS').length,
      waitingForResident: items.filter((item) => item.status === 'WAITING_FOR_RESIDENT').length,
      resolved: items.filter((item) => item.status === 'RESOLVED').length,
      closed: items.filter((item) => item.status === 'CLOSED').length,
      cancelled: items.filter((item) => item.status === 'CANCELLED').length,
      urgent: items.filter((item) => item.priority === 'URGENT').length,
      currentMonth: items.filter((item) => {
        const date = new Date(item.createdAt);
        const now = new Date();
        return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
      }).length,
      lastRequestAt: last?.createdAt || null,
      averageResolutionHours: resolutionHours.length
        ? Math.round((resolutionHours.reduce((sum, value) => sum + value, 0) / resolutionHours.length) * 10) / 10
        : null,
    };
  }

  private async findResidentRequest(user: MvpUser, id: string) {
    const scope = await this.residentScope(user.organizationId, user.id);
    const row = await this.prisma.issue.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
        OR: [
          { createdByUserId: user.id },
          { residentId: { in: scope.residentIds.length ? scope.residentIds : ['__none__'] } },
          { apartmentId: { in: scope.apartmentIds.length ? scope.apartmentIds : ['__none__'] } },
        ],
      },
      select: this.issueSelect(),
    });
    if (!row) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    return { row, store: await this.readRequestMetadata(user.organizationId), scope };
  }

  private async findAdminRequest(user: MvpUser, id: string) {
    const row = await this.prisma.issue.findFirst({
      where: { id, ...this.organizationWhere(user) },
      select: this.issueSelect(),
    });
    if (!row) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    this.assertOrganizationAccess(user, row.organizationId);
    return row;
  }

  private async changeRequestStatus(
    row: any,
    store: RequestMetadataStore,
    userId: string,
    oldStatus: RequestStatusValue,
    newStatus: RequestStatusValue,
    message: string,
  ) {
    const now = new Date().toISOString();
    const meta = this.requestMeta(row, store);
    const nextMeta: RequestMetadata = {
      ...meta,
      status: newStatus,
      resolvedAt: newStatus === 'RESOLVED' ? now : meta.resolvedAt,
      closedAt: newStatus === 'CLOSED' ? now : meta.closedAt,
      cancelledAt: newStatus === 'CANCELLED' ? now : meta.cancelledAt,
      timeline: [
        ...(meta.timeline || []),
        {
          type: 'STATUS_CHANGE',
          oldStatus,
          newStatus,
          message,
          createdAt: now,
          authorUserId: userId,
        },
      ],
    };
    store.items[row.id] = nextMeta;
    const updated = await this.prisma.issue.update({
      where: { id: row.id },
      data: {
        status: this.requestStatusToPrisma(newStatus),
        resolvedAt: newStatus === 'RESOLVED' ? new Date(now) : newStatus === 'IN_PROGRESS' ? null : row.resolvedAt || null,
      },
      select: this.issueSelect(),
    });
    await this.writeRequestMetadata(row.organizationId, userId, store);
    return this.toRequest(updated, store, true);
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

  private objectPayload(body: unknown): Record<string, unknown> {
    return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  }

  private parseAnnouncementInput(
    payload: Record<string, unknown>,
    existing?: { row: any; meta: AnnouncementMetadata },
    partial = false,
  ) {
    const title =
      typeof payload.title === 'string'
        ? this.requiredString(payload.title, 'Titlul anunțului este obligatoriu.')
        : existing?.row?.title || '';
    const bodyValue = payload.body ?? payload.content;
    const body =
      typeof bodyValue === 'string'
        ? this.requiredString(bodyValue, 'Conținutul anunțului este obligatoriu.')
        : existing?.row?.content || '';
    if (!partial && !title) throw new BadRequestException('Titlul anunțului este obligatoriu.');
    if (!partial && !body) throw new BadRequestException('Conținutul anunțului este obligatoriu.');

    const category =
      payload.category !== undefined
        ? this.normalizeAnnouncementCategory(payload.category)
        : existing?.meta.category || 'GENERAL';
    const priority =
      payload.priority !== undefined
        ? this.normalizeAnnouncementPriority(payload.priority)
        : existing?.meta.priority || 'NORMAL';
    const status =
      payload.status !== undefined
        ? this.normalizeAnnouncementStatus(payload.status)
        : existing?.meta.status || 'DRAFT';
    const visibilityType =
      payload.visibilityType !== undefined
        ? this.normalizeAnnouncementVisibility(payload.visibilityType)
        : existing?.meta.visibilityType || 'ALL_RESIDENTS';
    const publishAt =
      payload.publishAt !== undefined
        ? this.optionalIsoDate(payload.publishAt, 'Data publicării nu este validă.')
        : existing?.meta.publishAt || null;
    const expiresAt =
      payload.expiresAt !== undefined
        ? this.optionalIsoDate(payload.expiresAt, 'Data expirării nu este validă.')
        : existing?.meta.expiresAt || null;
    if (publishAt && expiresAt && new Date(publishAt) > new Date(expiresAt)) {
      throw new BadRequestException('Data publicării nu poate fi după data expirării.');
    }
    if (status === 'SCHEDULED' && !publishAt) {
      throw new BadRequestException('Data publicării este obligatorie pentru anunțurile programate.');
    }

    const staircaseIds =
      payload.staircaseIds !== undefined || payload.staircases !== undefined
        ? this.normalizeStringList(payload.staircaseIds ?? payload.staircases)
        : existing?.meta.staircaseIds || [];
    const apartmentIds =
      payload.apartmentIds !== undefined
        ? this.normalizeStringList(payload.apartmentIds)
        : existing?.meta.apartmentIds || [];
    const roles =
      payload.roles !== undefined
        ? this.normalizeRoles(payload.roles)
        : existing?.meta.roles || [];

    if (visibilityType === 'BY_STAIRCASE' && !staircaseIds.length) {
      throw new BadRequestException('Selectează cel puțin o scară.');
    }
    if (visibilityType === 'BY_APARTMENTS' && !apartmentIds.length) {
      throw new BadRequestException('Selectează cel puțin un apartament.');
    }
    if (visibilityType === 'BY_ROLE' && !roles.length) {
      throw new BadRequestException('Selectează cel puțin un rol.');
    }

    const publishedAt =
      status === 'PUBLISHED'
        ? existing?.meta.publishedAt || new Date().toISOString()
        : status === 'DRAFT' || status === 'SCHEDULED'
          ? null
          : existing?.meta.publishedAt || null;
    const archivedAt = status === 'ARCHIVED' ? existing?.meta.archivedAt || new Date().toISOString() : existing?.meta.archivedAt || null;

    return {
      title,
      body,
      metadata: {
        excerpt: typeof payload.excerpt === 'string' ? payload.excerpt.trim() : existing?.meta.excerpt || '',
        category,
        priority,
        status,
        visibilityType,
        visibleToResidents:
          payload.visibleToResidents !== undefined ? Boolean(payload.visibleToResidents) : existing?.meta.visibleToResidents ?? true,
        pinned: payload.pinned !== undefined ? Boolean(payload.pinned) : payload.isPinned !== undefined ? Boolean(payload.isPinned) : existing?.meta.pinned ?? false,
        publishAt,
        publishedAt,
        publishedById: status === 'PUBLISHED' ? existing?.meta.publishedById || null : null,
        expiresAt,
        archivedAt,
        archivedById: status === 'ARCHIVED' ? existing?.meta.archivedById || null : null,
        staircaseIds,
        apartmentIds,
        roles,
        createdById: existing?.meta.createdById || null,
      } satisfies AnnouncementMetadata,
    };
  }

  private async findAdminAnnouncement(user: MvpUser, id: string) {
    const announcement = await this.prisma.announcement.findFirst({
      where: { id, ...this.organizationWhere(user) },
      select: this.announcementSelect(),
    });
    if (!announcement) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    this.assertOrganizationAccess(user, announcement.organizationId);
    return announcement;
  }

  private async findResidentAnnouncement(user: MvpUser, id: string) {
    const organizationId = user.organizationId;
    const store = await this.readAnnouncementMetadata(organizationId);
    const scope = await this.residentScope(organizationId, user.id);
    const announcement = await this.prisma.announcement.findFirst({
      where: { id, organizationId },
      select: this.announcementSelect(),
    });
    if (!announcement) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    const meta = this.announcementMeta(announcement, store);
    if (!this.isAnnouncementVisibleToResident(announcement, meta, scope)) {
      throw new NotFoundException('Înregistrarea nu a fost găsită.');
    }
    return { announcement, store, scope };
  }

  private async ensureOrganizationExists(organizationId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!organization) throw new NotFoundException('Înregistrarea nu a fost găsită.');
  }

  private async getOrganizationBadge(organizationId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true, legalName: true, address: true, currency: true },
    });
    if (!organization) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    const codeMatch = `${organization.name || ''} ${organization.legalName || ''}`.match(/A\d{4}-\d{4}/);
    return {
      id: organization.id,
      shortName: organization.name || organization.legalName || 'A.P.C.',
      legalName: organization.legalName || organization.name || 'Asociația de Proprietari din Condominiu',
      associationCode: codeMatch?.[0] || null,
      address: organization.address || null,
      currency: organization.currency || 'MDL',
    };
  }

  private positiveInt(value: unknown, fallback: number) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 1) return fallback;
    return Math.floor(parsed);
  }

  private async mapAnnouncementsWithCounts(rows: any[], store: AnnouncementMetadataStore) {
    const mapped = [];
    for (const row of rows) {
      const meta = this.announcementMeta(row, store);
      mapped.push(this.toAnnouncement(row, store, null, await this.targetedResidentCount(row.organizationId, row, meta)));
    }
    return mapped;
  }

  private filterAdminAnnouncements(items: any[], query: Record<string, string | undefined>) {
    const search = (query.search || '').trim().toLowerCase();
    const status = query.status ? this.normalizeAnnouncementStatus(query.status) : null;
    const category = query.category ? this.normalizeAnnouncementCategory(query.category) : null;
    const priority = query.priority ? this.normalizeAnnouncementPriority(query.priority) : null;
    const visibilityType = query.visibilityType ? this.normalizeAnnouncementVisibility(query.visibilityType) : null;
    const dateFrom = query.dateFrom ? new Date(query.dateFrom) : null;
    const dateTo = query.dateTo ? new Date(query.dateTo) : null;
    return items.filter((item) => {
      if (search && !`${item.title} ${item.body} ${item.createdBy?.name || ''} ${item.category}`.toLowerCase().includes(search)) return false;
      if (status && item.status !== status) return false;
      if (category && item.category !== category) return false;
      if (priority && item.priority !== priority) return false;
      if (visibilityType && item.visibilityType !== visibilityType) return false;
      const created = new Date(item.createdAt);
      if (dateFrom && created < dateFrom) return false;
      if (dateTo && created > dateTo) return false;
      return true;
    });
  }

  private sortAdminAnnouncements(items: any[], sortBy?: string, sortDirection?: string) {
    const direction = sortDirection === 'asc' ? 1 : -1;
    const priorityWeight: Record<string, number> = { URGENT: 4, HIGH: 3, NORMAL: 2, LOW: 1 };
    return [...items].sort((a, b) => {
      if (sortBy === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortBy === 'priority') return (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
      if (sortBy === 'status') return String(a.status).localeCompare(String(b.status)) * direction;
      if (sortBy === 'publishedAt') return (new Date(a.publishedAt || a.createdAt).getTime() - new Date(b.publishedAt || b.createdAt).getTime()) * direction;
      return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * direction;
    });
  }

  private announcementStats(items: any[]) {
    const now = new Date();
    const lastPublished = items
      .filter((item) => item.status === 'PUBLISHED')
      .sort((a, b) => new Date(b.publishedAt || b.createdAt).getTime() - new Date(a.publishedAt || a.createdAt).getTime())[0];
    return {
      total: items.length,
      published: items.filter((item) => item.status === 'PUBLISHED').length,
      draft: items.filter((item) => item.status === 'DRAFT').length,
      scheduled: items.filter((item) => item.status === 'SCHEDULED').length,
      archived: items.filter((item) => item.status === 'ARCHIVED').length,
      urgent: items.filter((item) => item.priority === 'URGENT' || item.priority === 'HIGH').length,
      important: items.filter((item) => item.priority === 'URGENT' || item.priority === 'HIGH').length,
      pinned: items.filter((item) => item.pinned).length,
      expired: items.filter((item) => item.expiresAt && new Date(item.expiresAt) < now).length,
      totalReads: items.reduce((sum, item) => sum + Number(item.readCount || 0), 0),
      lastPublishedAt: lastPublished?.publishedAt || lastPublished?.createdAt || null,
    };
  }

  private readStatsFor(row: any, store: AnnouncementMetadataStore, targetedResidents: number) {
    const readCount = Object.keys(store.reads[row.id] || {}).length;
    const unreadCount = Math.max(targetedResidents - readCount, 0);
    return {
      totalResidentsTargeted: targetedResidents,
      targetedResidents,
      readCount,
      unreadCount,
      readRate: targetedResidents > 0 ? Math.round((readCount / targetedResidents) * 10000) / 100 : 0,
    };
  }

  private async targetedResidentCount(organizationId: string, row: any, meta: AnnouncementMetadata) {
    const residents = await this.prisma.residentProfile.findMany({
      where: { organizationId },
      select: {
        id: true,
        userId: true,
        type: true,
        apartment: { select: { id: true, buildingId: true, staircaseId: true, staircase: { select: { name: true } } } },
        apartmentResidents: {
          select: {
            role: true,
            apartment: { select: { id: true, buildingId: true, staircaseId: true, staircase: { select: { name: true } } } },
          },
        },
      },
    });
    let count = 0;
    for (const resident of residents) {
      const scope: ResidentAnnouncementScope = {
        residentIds: [resident.id],
        apartmentIds: [
          ...(resident.apartment?.id ? [resident.apartment.id] : []),
          ...resident.apartmentResidents.map((relation) => relation.apartment?.id).filter(Boolean),
        ] as string[],
        buildingIds: [
          ...(resident.apartment?.buildingId ? [resident.apartment.buildingId] : []),
          ...resident.apartmentResidents.map((relation) => relation.apartment?.buildingId).filter(Boolean),
        ] as string[],
        staircaseIds: [
          ...(resident.apartment?.staircaseId ? [resident.apartment.staircaseId] : []),
          ...resident.apartmentResidents.map((relation) => relation.apartment?.staircaseId).filter(Boolean),
        ] as string[],
        staircaseNames: [
          ...(resident.apartment?.staircase?.name ? [resident.apartment.staircase.name] : []),
          ...resident.apartmentResidents.map((relation) => relation.apartment?.staircase?.name).filter(Boolean),
        ] as string[],
        roles: [
          ...(resident.type ? [String(resident.type).toUpperCase()] : []),
          ...resident.apartmentResidents.map((relation) => String(relation.role || '').toUpperCase()).filter(Boolean),
        ],
      };
      if (this.isAnnouncementVisibleToResident(row, meta, scope)) count += 1;
    }
    return count;
  }

  private async residentAnnouncementsResult(user: MvpUser, query: Record<string, string | undefined>) {
    const organizationId = user.organizationId;
    const association = await this.getOrganizationBadge(organizationId);
    const store = await this.readAnnouncementMetadata(organizationId);
    const scope = await this.residentScope(organizationId, user.id);
    const readKey = this.readKeyForScope(scope, user.id);
    const rows = await this.prisma.announcement.findMany({
      where: { organizationId, status: AnnouncementStatus.ACTIVE },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      select: this.announcementSelect(),
    });
    const visible = rows
      .filter((row) => this.isAnnouncementVisibleToResident(row, this.announcementMeta(row, store), scope))
      .map((row) => this.toAnnouncement(row, store, store.reads[row.id]?.[readKey] || null));
    const search = (query.search || '').trim().toLowerCase();
    const category = query.category ? this.normalizeAnnouncementCategory(query.category) : null;
    const unreadOnly = query.unreadOnly === 'true';
    const importantOnly = query.importantOnly === 'true';
    const filtered = visible.filter((item) => {
      if (search && !`${item.title} ${item.body}`.toLowerCase().includes(search)) return false;
      if (category && item.category !== category) return false;
      if (unreadOnly && item.isRead) return false;
      if (importantOnly && item.priority !== 'HIGH' && item.priority !== 'URGENT' && !item.pinned) return false;
      return true;
    });
    const sorted = this.sortResidentAnnouncements(filtered, query.sortBy, query.sortDirection);
    const page = this.positiveInt(query.page, 1);
    const limit = Math.min(this.positiveInt(query.limit, 20), 100);
    const start = (page - 1) * limit;
    return {
      items: sorted.slice(start, start + limit),
      meta: { page, limit, total: sorted.length },
      stats: {
        total: visible.length,
        unread: visible.filter((item) => !item.isRead).length,
        urgent: visible.filter((item) => item.priority === 'URGENT').length,
        pinned: visible.filter((item) => item.pinned).length,
      },
      association,
    };
  }

  private sortResidentAnnouncements(items: any[], sortBy?: string, sortDirection?: string) {
    const direction = sortDirection === 'asc' || sortBy === 'oldest' ? 1 : -1;
    const priorityWeight: Record<string, number> = { URGENT: 4, HIGH: 3, NORMAL: 2, LOW: 1 };
    return [...items].sort((a, b) => {
      if (sortBy === 'priority') {
        const diff = (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
        if (diff !== 0) return diff;
      }
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return (new Date(a.publishedAt || a.createdAt).getTime() - new Date(b.publishedAt || b.createdAt).getTime()) * direction;
    });
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
