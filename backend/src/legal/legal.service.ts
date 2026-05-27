import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import {
  LegalContactRequestStatus,
  LegalDocumentAudience,
  LegalDocumentStatus,
  LegalDocumentType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  LegalContactNoteDto,
  LegalContactRequestDto,
  LegalContactStatusDto,
  UpdateLegalDocumentDto,
  UpsertLegalDocumentDto,
} from './dto/legal.dto';
import { LEGAL_DOCUMENT_SEEDS } from './legal.seed';

type Actor = { id?: string; role?: string; organizationId?: string; associationId?: string };

@Injectable()
export class LegalService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedLegalDocuments();
  }

  async seedLegalDocuments() {
    for (const document of LEGAL_DOCUMENT_SEEDS) {
      await this.prisma.legalDocument.upsert({
        where: {
          slug_locale_version: {
            slug: document.slug,
            locale: document.locale,
            version: document.version,
          },
        },
        update: {
          title: document.title,
          description: document.description,
          type: document.type,
          audience: document.audience,
          body: document.body,
          status: LegalDocumentStatus.PUBLISHED,
          isActive: true,
          publishedAt: new Date(),
        },
        create: {
          ...document,
          status: LegalDocumentStatus.PUBLISHED,
          isActive: true,
          publishedAt: new Date(),
        },
      });
    }
  }

  async publicDocuments(query: Record<string, string | undefined>) {
    const locale = query.locale || 'ro';
    const where: Prisma.LegalDocumentWhereInput = {
      locale,
      status: LegalDocumentStatus.PUBLISHED,
      isActive: true,
      audience: { in: [LegalDocumentAudience.PUBLIC, LegalDocumentAudience.ALL] },
      ...(query.type ? { type: query.type as LegalDocumentType } : {}),
    };
    const items = await this.prisma.legalDocument.findMany({
      where,
      orderBy: [{ type: 'asc' }, { updatedAt: 'desc' }],
    });
    return { items };
  }

  async publicBySlug(slug: string, locale = 'ro') {
    const document = await this.prisma.legalDocument.findFirst({
      where: {
        slug,
        locale,
        status: LegalDocumentStatus.PUBLISHED,
        isActive: true,
        audience: { in: [LegalDocumentAudience.PUBLIC, LegalDocumentAudience.ALL] },
      },
      orderBy: { publishedAt: 'desc' },
    });
    if (!document) throw new NotFoundException('Documentul legal nu a fost gasit.');
    return { document, related: await this.relatedPublicDocuments(document.id, locale) };
  }

  async publicActive(type: LegalDocumentType, locale = 'ro') {
    const document = await this.prisma.legalDocument.findFirst({
      where: {
        type,
        locale,
        status: LegalDocumentStatus.PUBLISHED,
        isActive: true,
        audience: { in: [LegalDocumentAudience.PUBLIC, LegalDocumentAudience.ALL] },
      },
      orderBy: { publishedAt: 'desc' },
    });
    if (!document) throw new NotFoundException('Documentul legal nu a fost gasit.');
    return { document };
  }

  async createContactRequest(dto: LegalContactRequestDto, actor?: Actor) {
    if (!dto.consent) throw new BadRequestException('Consimtamantul este obligatoriu.');
    if (dto.website?.trim()) throw new BadRequestException('Cererea nu a putut fi trimisa.');
    if (!dto.email?.trim() && !dto.phone?.trim()) {
      throw new BadRequestException('Completeaza email sau telefon.');
    }
    const request = await this.prisma.legalContactRequest.create({
      data: {
        fullName: dto.fullName.trim(),
        email: dto.email?.trim().toLowerCase() || null,
        phone: dto.phone?.trim() || null,
        subject: dto.subject.trim(),
        message: dto.message.trim(),
        requestType: dto.requestType,
        source: dto.source || 'PUBLIC_LEGAL',
        userId: actor?.id || null,
        associationId: actor?.organizationId || actor?.associationId || null,
      },
    });
    return { success: true, message: 'Cererea a fost trimisa.', requestId: request.id };
  }

  async superadminListDocuments(query: Record<string, string | undefined>) {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 30)));
    const search = query.search?.trim();
    const where: Prisma.LegalDocumentWhereInput = {
      ...(query.type ? { type: query.type as LegalDocumentType } : {}),
      ...(query.status ? { status: query.status as LegalDocumentStatus } : {}),
      ...(query.audience ? { audience: query.audience as LegalDocumentAudience } : {}),
      ...(query.locale ? { locale: query.locale } : {}),
      ...(query.activeOnly === 'true' ? { isActive: true } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { slug: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
              { body: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.legalDocument.findMany({
        where,
        include: {
          createdBy: { select: { id: true, email: true, fullName: true } },
          updatedBy: { select: { id: true, email: true, fullName: true } },
        },
        orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.legalDocument.count({ where }),
    ]);
    return { items, meta: { page, limit, total } };
  }

  async superadminGetDocument(id: string) {
    const document = await this.prisma.legalDocument.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, email: true, fullName: true } },
        updatedBy: { select: { id: true, email: true, fullName: true } },
      },
    });
    if (!document) throw new NotFoundException('Documentul legal nu a fost gasit.');
    const versions = await this.prisma.legalDocument.findMany({
      where: { slug: document.slug, locale: document.locale },
      orderBy: { createdAt: 'desc' },
      select: { id: true, version: true, status: true, isActive: true, publishedAt: true, archivedAt: true, createdAt: true },
    });
    return { document, versions };
  }

  async superadminCreateDocument(dto: UpsertLegalDocumentDto, actor?: Actor) {
    const document = await this.prisma.legalDocument.create({
      data: {
        title: dto.title.trim(),
        slug: this.normalizeSlug(dto.slug),
        description: dto.description?.trim() || null,
        type: dto.type,
        audience: dto.audience,
        status: dto.status || LegalDocumentStatus.DRAFT,
        locale: dto.locale || 'ro',
        body: dto.body,
        version: dto.version.trim(),
        isActive: false,
        publishedAt: dto.status === LegalDocumentStatus.PUBLISHED ? new Date() : null,
        createdById: actor?.id || null,
        updatedById: actor?.id || null,
      },
    });
    if (dto.isActive || dto.status === LegalDocumentStatus.PUBLISHED) {
      return this.publishDocument(document.id, actor);
    }
    return document;
  }

  async superadminUpdateDocument(id: string, dto: UpdateLegalDocumentDto, actor?: Actor) {
    await this.ensureDocument(id);
    const updated = await this.prisma.legalDocument.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.slug !== undefined ? { slug: this.normalizeSlug(dto.slug) } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.audience !== undefined ? { audience: dto.audience } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.locale !== undefined ? { locale: dto.locale || 'ro' } : {}),
        ...(dto.body !== undefined ? { body: dto.body } : {}),
        ...(dto.version !== undefined ? { version: dto.version.trim() } : {}),
        updatedById: actor?.id || null,
      },
    });
    if (dto.isActive || dto.status === LegalDocumentStatus.PUBLISHED) {
      return this.publishDocument(updated.id, actor);
    }
    return updated;
  }

  async publishDocument(id: string, actor?: Actor) {
    const document = await this.ensureDocument(id);
    const now = new Date();
    await this.prisma.legalDocument.updateMany({
      where: {
        id: { not: id },
        type: document.type,
        audience: document.audience,
        locale: document.locale,
        isActive: true,
      },
      data: {
        isActive: false,
        status: LegalDocumentStatus.ARCHIVED,
        archivedAt: now,
      },
    });
    return this.prisma.legalDocument.update({
      where: { id },
      data: {
        status: LegalDocumentStatus.PUBLISHED,
        isActive: true,
        publishedAt: document.publishedAt || now,
        archivedAt: null,
        updatedById: actor?.id || null,
      },
    });
  }

  async archiveDocument(id: string, actor?: Actor) {
    await this.ensureDocument(id);
    return this.prisma.legalDocument.update({
      where: { id },
      data: {
        status: LegalDocumentStatus.ARCHIVED,
        isActive: false,
        archivedAt: new Date(),
        updatedById: actor?.id || null,
      },
    });
  }

  async duplicateDocument(id: string, actor?: Actor) {
    const document = await this.ensureDocument(id);
    return this.prisma.legalDocument.create({
      data: {
        title: `${document.title} (draft)`,
        slug: `${document.slug}-draft-${Date.now()}`,
        description: document.description,
        type: document.type,
        audience: document.audience,
        status: LegalDocumentStatus.DRAFT,
        locale: document.locale,
        body: document.body,
        version: this.nextVersion(document.version),
        isActive: false,
        createdById: actor?.id || null,
        updatedById: actor?.id || null,
      },
    });
  }

  async superadminListContactRequests(query: Record<string, string | undefined>) {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 30)));
    const search = query.search?.trim();
    const where: Prisma.LegalContactRequestWhereInput = {
      ...(query.status ? { status: query.status as LegalContactRequestStatus } : {}),
      ...(query.requestType ? { requestType: query.requestType as any } : {}),
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
              { subject: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.legalContactRequest.findMany({
        where,
        include: {
          user: { select: { id: true, email: true, fullName: true } },
          association: { select: { id: true, name: true, legalName: true } },
          handledBy: { select: { id: true, email: true, fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.legalContactRequest.count({ where }),
    ]);
    return { items, meta: { page, limit, total } };
  }

  async superadminGetContactRequest(id: string) {
    const request = await this.prisma.legalContactRequest.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, fullName: true } },
        association: { select: { id: true, name: true, legalName: true } },
        handledBy: { select: { id: true, email: true, fullName: true } },
      },
    });
    if (!request) throw new NotFoundException('Cererea legal/contact nu a fost gasita.');
    return request;
  }

  async updateContactStatus(id: string, dto: LegalContactStatusDto, actor?: Actor) {
    await this.superadminGetContactRequest(id);
    const isHandled =
      dto.status === LegalContactRequestStatus.RESOLVED ||
      dto.status === LegalContactRequestStatus.CLOSED ||
      dto.status === LegalContactRequestStatus.SPAM;
    return this.prisma.legalContactRequest.update({
      where: { id },
      data: {
        status: dto.status,
        handledById: actor?.id || null,
        handledAt: isHandled ? new Date() : undefined,
      },
    });
  }

  async addContactNote(id: string, dto: LegalContactNoteDto) {
    const existing = await this.superadminGetContactRequest(id);
    const stamped = `[${new Date().toISOString()}] ${dto.note.trim()}`;
    return this.prisma.legalContactRequest.update({
      where: { id },
      data: { internalNotes: [existing.internalNotes, stamped].filter(Boolean).join('\n\n') },
    });
  }

  async stats() {
    const [published, drafts, archived, latest, contactNew] = await Promise.all([
      this.prisma.legalDocument.count({ where: { status: LegalDocumentStatus.PUBLISHED } }),
      this.prisma.legalDocument.count({ where: { status: LegalDocumentStatus.DRAFT } }),
      this.prisma.legalDocument.count({ where: { status: LegalDocumentStatus.ARCHIVED } }),
      this.prisma.legalDocument.findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
      this.prisma.legalContactRequest.count({ where: { status: LegalContactRequestStatus.NEW } }),
    ]);
    return { published, drafts, archived, latestUpdatedAt: latest?.updatedAt || null, contactNew };
  }

  private async relatedPublicDocuments(currentId: string, locale: string) {
    return this.prisma.legalDocument.findMany({
      where: {
        id: { not: currentId },
        locale,
        isActive: true,
        status: LegalDocumentStatus.PUBLISHED,
        audience: { in: [LegalDocumentAudience.PUBLIC, LegalDocumentAudience.ALL] },
      },
      take: 5,
      orderBy: { title: 'asc' },
      select: { id: true, slug: true, title: true, description: true, type: true },
    });
  }

  private async ensureDocument(id: string) {
    const document = await this.prisma.legalDocument.findUnique({ where: { id } });
    if (!document) throw new NotFoundException('Documentul legal nu a fost gasit.');
    return document;
  }

  private normalizeSlug(value: string) {
    return value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 160);
  }

  private nextVersion(version: string) {
    const parts = version.split('.');
    const last = Number(parts.pop() || 0);
    if (Number.isFinite(last)) return [...parts, String(last + 1)].join('.');
    return `${version}-draft`;
  }
}
