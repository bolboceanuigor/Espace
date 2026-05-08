import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ContentTargetType, FileAssetEntityType, NotificationType, Prisma, Role } from '@prisma/client';
import { ActivityMvpService } from '../activity-mvp/activity-mvp.service';
import { PrismaService } from '../prisma/prisma.service';
import type { MvpUser } from '../security/mvp-auth.guard';

type DocumentCategory = 'STATUT' | 'PROCES_VERBAL' | 'HOTARARE' | 'CONTRACT' | 'FINANCIAR' | 'TEHNIC' | 'ANUNT' | 'ALTUL';
type DocumentVisibility = 'ADMIN_ONLY' | 'RESIDENT_VISIBLE';

const CATEGORIES: DocumentCategory[] = ['STATUT', 'PROCES_VERBAL', 'HOTARARE', 'CONTRACT', 'FINANCIAR', 'TEHNIC', 'ANUNT', 'ALTUL'];
const VISIBILITIES: DocumentVisibility[] = ['ADMIN_ONLY', 'RESIDENT_VISIBLE'];
const META_PREFIX = 'registry';

@Injectable()
export class DocumentsMvpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityMvpService,
  ) {}

  async listAdminDocuments(user: MvpUser, query: Record<string, unknown> = {}) {
    const where: Prisma.DocumentWhereInput = {
      ...this.organizationWhere(user),
      ...this.filterWhere(query),
    };
    const documents = await this.prisma.document.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: this.documentInclude(),
    });
    return this.withFileAssetIds(user, documents);
  }

  async getAdminDocument(user: MvpUser, id: string) {
    const document = await this.prisma.document.findFirst({
      where: { id, ...this.organizationWhere(user) },
      include: this.documentInclude(),
    });
    if (!document) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    return (await this.withFileAssetIds(user, [document]))[0];
  }

  async createAdminDocument(user: MvpUser, body: unknown) {
    const input = this.parseCreateBody(body);
    const organizationId = this.isSuperadmin(user) && input.organizationId ? input.organizationId : user.organizationId;
    this.assertOrganizationAccess(user, organizationId);
    await this.assertOrganizationExists(organizationId);

    const document = await this.prisma.document.create({
      data: {
        organizationId,
        title: input.title,
        description: input.description,
        fileUrl: input.fileUrl,
        fileName: input.fileName,
        fileType: this.packMetadata(input.category, input.visibility, input.mimeType),
        targetType: ContentTargetType.ORGANIZATION,
        uploadedByUserId: user.id,
      },
      include: this.documentInclude(),
    });

    await this.activity.createActivity({
      organizationId,
      actorUserId: user.id,
      type: 'DOCUMENT_CREATED',
      title: 'Document salvat',
      message: `Documentul „${document.title}” a fost salvat în registrul A.P.C.`,
      targetType: 'DOCUMENT',
      targetId: document.id,
      link: '/admin/documents',
    });

    if (input.visibility === 'RESIDENT_VISIBLE') {
      await this.activity.notifyOrganizationResidents({
        organizationId,
        type: NotificationType.DOCUMENT,
        title: 'Document nou publicat',
        message: `A fost publicat un document nou: ${document.title}.`,
        link: '/resident/documents',
      });
    }

    return (await this.withFileAssetIds(user, [document]))[0];
  }

  async updateAdminDocument(user: MvpUser, id: string, body: unknown) {
    const existing = await this.prisma.document.findFirst({
      where: { id, ...this.organizationWhere(user) },
      include: this.documentInclude(),
    });
    if (!existing) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    this.assertOrganizationAccess(user, existing.organizationId);

    const current = this.unpackMetadata(existing.fileType);
    const input = this.parseUpdateBody(body, current);
    const updated = await this.prisma.document.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.fileUrl !== undefined ? { fileUrl: input.fileUrl } : {}),
        ...(input.fileName !== undefined ? { fileName: input.fileName } : {}),
        fileType: this.packMetadata(input.category, input.visibility, input.mimeType),
      },
      include: this.documentInclude(),
    });

    await this.activity.createActivity({
      organizationId: updated.organizationId,
      actorUserId: user.id,
      type: 'DOCUMENT_UPDATED',
      title: 'Document actualizat',
      message: `Documentul „${updated.title}” a fost actualizat.`,
      targetType: 'DOCUMENT',
      targetId: updated.id,
      link: '/admin/documents',
    });

    return (await this.withFileAssetIds(user, [updated]))[0];
  }

  async listResidentDocuments(user: MvpUser, query: Record<string, unknown> = {}) {
    const where: Prisma.DocumentWhereInput = {
      organizationId: user.organizationId,
      fileType: { contains: `:${'RESIDENT_VISIBLE'}:` },
      ...this.filterWhere(query, { residentOnly: true }),
    };
    const documents = await this.prisma.document.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: this.documentInclude(),
    });
    return this.withFileAssetIds(user, documents);
  }

  async getResidentDocument(user: MvpUser, id: string) {
    const document = await this.prisma.document.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
        fileType: { contains: `:${'RESIDENT_VISIBLE'}:` },
      },
      include: this.documentInclude(),
    });
    if (!document) throw new NotFoundException('Înregistrarea nu a fost găsită.');
    return (await this.withFileAssetIds(user, [document]))[0];
  }

  private documentInclude() {
    return {
      uploadedBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      building: { select: { id: true, name: true } },
      staircase: { select: { id: true, name: true } },
      apartment: { select: { id: true, number: true } },
    } satisfies Prisma.DocumentInclude;
  }

  private async withFileAssetIds(user: MvpUser, documents: any[]) {
    if (!documents.length) return [];
    const organizationIds = Array.from(new Set(documents.map((document) => document.organizationId)));
    const fileUrls = Array.from(new Set(documents.map((document) => document.fileUrl).filter(Boolean)));
    const assets = await this.prisma.fileAsset.findMany({
      where: {
        organizationId: this.isSuperadmin(user) ? { in: organizationIds } : user.organizationId,
        entityType: FileAssetEntityType.DOCUMENT,
        OR: [{ entityId: { in: documents.map((document) => document.id) } }, { fileUrl: { in: fileUrls } }],
      },
      select: { id: true, entityId: true, fileUrl: true, mimeType: true, sizeBytes: true },
    });
    const byEntityId = new Map(assets.filter((asset) => asset.entityId).map((asset) => [asset.entityId as string, asset]));
    const byUrl = new Map(assets.map((asset) => [asset.fileUrl, asset]));

    return documents.map((document) => {
      const meta = this.unpackMetadata(document.fileType);
      const asset = byEntityId.get(document.id) || byUrl.get(document.fileUrl) || null;
      return {
        id: document.id,
        organizationId: document.organizationId,
        title: document.title,
        description: document.description,
        category: meta.category,
        visibility: meta.visibility,
        fileUrl: document.fileUrl,
        fileName: document.fileName,
        mimeType: asset?.mimeType || meta.mimeType,
        fileType: meta.mimeType,
        sizeBytes: asset?.sizeBytes ?? null,
        fileAssetId: asset?.id ?? null,
        targetType: document.targetType,
        createdById: document.uploadedByUserId,
        createdBy: document.uploadedBy
          ? {
              id: document.uploadedBy.id,
              name: this.fullName(document.uploadedBy),
              email: document.uploadedBy.email,
            }
          : null,
        createdAt: document.createdAt,
        updatedAt: document.updatedAt,
      };
    });
  }

  private filterWhere(query: Record<string, unknown>, options?: { residentOnly?: boolean }): Prisma.DocumentWhereInput {
    const where: Prisma.DocumentWhereInput = {};
    const and: Prisma.DocumentWhereInput[] = [];
    const category = this.optionalCategory(query.category, null);
    const visibility = options?.residentOnly ? null : this.optionalVisibility(query.visibility, null);
    const search = typeof query.search === 'string' ? query.search.trim() : '';
    if (category) and.push({ fileType: { contains: `${META_PREFIX}:${category}:` } });
    if (visibility) and.push({ fileType: { contains: `:${visibility}:` } });
    if (search) {
      and.push({
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { fileName: { contains: search, mode: 'insensitive' } },
        ],
      });
    }
    if (and.length) where.AND = and;
    return where;
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

  private async assertOrganizationExists(organizationId: string) {
    const organization = await this.prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } });
    if (!organization) throw new NotFoundException('Înregistrarea nu a fost găsită.');
  }

  private parseCreateBody(body: unknown) {
    const payload = this.payload(body);
    const fileUrl = this.requiredString(payload.fileUrl, 'Linkul fișierului este obligatoriu.');
    this.assertSafeFileUrl(fileUrl);
    return {
      organizationId: typeof payload.organizationId === 'string' ? payload.organizationId.trim() : '',
      title: this.requiredString(payload.title, 'Titlul este obligatoriu.'),
      description: this.optionalString(payload.description) || null,
      category: this.optionalCategory(payload.category, 'ALTUL'),
      visibility: this.optionalVisibility(payload.visibility, 'ADMIN_ONLY'),
      fileUrl,
      fileName: this.optionalString(payload.fileName) || this.fileNameFromUrl(fileUrl),
      mimeType: this.optionalString(payload.mimeType ?? payload.fileType) || 'application/octet-stream',
    };
  }

  private parseUpdateBody(body: unknown, current: { category: DocumentCategory; visibility: DocumentVisibility; mimeType: string }) {
    const payload = this.payload(body);
    const fileUrl = payload.fileUrl === undefined ? undefined : this.requiredString(payload.fileUrl, 'Linkul fișierului este obligatoriu.');
    if (fileUrl) this.assertSafeFileUrl(fileUrl);
    return {
      title: payload.title === undefined ? undefined : this.requiredString(payload.title, 'Titlul este obligatoriu.'),
      description: payload.description === undefined ? undefined : this.optionalString(payload.description) || null,
      category: this.optionalCategory(payload.category, current.category),
      visibility: this.optionalVisibility(payload.visibility, current.visibility),
      fileUrl,
      fileName: payload.fileName === undefined ? undefined : this.optionalString(payload.fileName) || (fileUrl ? this.fileNameFromUrl(fileUrl) : 'document'),
      mimeType: this.optionalString(payload.mimeType ?? payload.fileType) || current.mimeType,
    };
  }

  private packMetadata(category: DocumentCategory, visibility: DocumentVisibility, mimeType: string) {
    return `${META_PREFIX}:${category}:${visibility}:${mimeType || 'application/octet-stream'}`;
  }

  private unpackMetadata(fileType?: string | null): { category: DocumentCategory; visibility: DocumentVisibility; mimeType: string } {
    const value = String(fileType || '');
    if (value.startsWith(`${META_PREFIX}:`)) {
      const [, category, visibility, ...mimeParts] = value.split(':');
      return {
        category: CATEGORIES.includes(category as DocumentCategory) ? (category as DocumentCategory) : 'ALTUL',
        visibility: VISIBILITIES.includes(visibility as DocumentVisibility) ? (visibility as DocumentVisibility) : 'ADMIN_ONLY',
        mimeType: mimeParts.join(':') || 'application/octet-stream',
      };
    }
    return {
      category: CATEGORIES.includes(value as DocumentCategory) ? (value as DocumentCategory) : 'ALTUL',
      visibility: 'ADMIN_ONLY',
      mimeType: value || 'application/octet-stream',
    };
  }

  private payload(body: unknown) {
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  }

  private requiredString(value: unknown, message: string) {
    if (typeof value !== 'string' || !value.trim()) throw new BadRequestException(message);
    return value.trim();
  }

  private optionalString(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : '';
  }

  private optionalCategory(value: unknown, fallback: DocumentCategory | null): DocumentCategory {
    if (value === undefined || value === null || value === '') return fallback || 'ALTUL';
    const normalized = this.requiredString(value, 'Categoria documentului nu este validă.').toUpperCase() as DocumentCategory;
    if (!CATEGORIES.includes(normalized)) throw new BadRequestException('Categoria documentului nu este validă.');
    return normalized;
  }

  private optionalVisibility(value: unknown, fallback: DocumentVisibility | null): DocumentVisibility {
    if (value === undefined || value === null || value === '') return fallback || 'ADMIN_ONLY';
    const normalized = this.requiredString(value, 'Vizibilitatea documentului nu este validă.').toUpperCase() as DocumentVisibility;
    if (!VISIBILITIES.includes(normalized)) throw new BadRequestException('Vizibilitatea documentului nu este validă.');
    return normalized;
  }

  private assertSafeFileUrl(fileUrl: string) {
    if (/^https?:\/\//i.test(fileUrl) || fileUrl.startsWith('/')) return;
    throw new BadRequestException('Linkul fișierului trebuie să fie un URL valid.');
  }

  private fileNameFromUrl(fileUrl: string) {
    const clean = fileUrl.split('?')[0]?.split('#')[0] || 'document';
    return decodeURIComponent(clean.split('/').filter(Boolean).pop() || 'document');
  }

  private fullName(user: { firstName?: string | null; lastName?: string | null; email?: string | null }) {
    return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Administrator';
  }

  private isSuperadmin(user: MvpUser) {
    return String(user.role).toUpperCase() === Role.SUPERADMIN;
  }
}
