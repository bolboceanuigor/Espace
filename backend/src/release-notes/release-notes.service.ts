import { ForbiddenException, Injectable } from '@nestjs/common';
import { ReleaseNoteTargetRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateReleaseNoteDto,
  ReleaseNotesFiltersDto,
  UpdateReleaseNoteDto,
} from './dto/release-notes.dto';

type AuthUser = { id?: string; sub?: string; role?: string };

@Injectable()
export class ReleaseNotesService {
  constructor(private readonly prisma: PrismaService) {}

  private userId(user: AuthUser) {
    return user.id || user.sub || '';
  }

  private normalizedRole(user: AuthUser): 'SUPER_ADMIN' | 'ADMIN' | 'RESIDENT' {
    const role = String(user.role || '').toUpperCase();
    if (role === 'SUPERADMIN' || role === 'SUPER_ADMIN') return 'SUPER_ADMIN';
    if (role === 'RESIDENT' || role === 'TENANT') return 'RESIDENT';
    return 'ADMIN';
  }

  private assertSuperAdmin(user: AuthUser) {
    if (this.normalizedRole(user) !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Super admin access required');
    }
  }

  private visibleRolesForUser(user: AuthUser): ReleaseNoteTargetRole[] {
    const role = this.normalizedRole(user);
    if (role === 'SUPER_ADMIN') return [ReleaseNoteTargetRole.ALL, ReleaseNoteTargetRole.SUPER_ADMIN];
    if (role === 'ADMIN') return [ReleaseNoteTargetRole.ALL, ReleaseNoteTargetRole.ADMIN];
    return [ReleaseNoteTargetRole.ALL, ReleaseNoteTargetRole.RESIDENT];
  }

  async listForUser(user: AuthUser) {
    const userId = this.userId(user);
    const roles = this.visibleRolesForUser(user);
    return this.prisma.releaseNote.findMany({
      where: {
        isPublished: true,
        targetRole: { in: roles },
      },
      include: {
        releaseReads: { where: { userId }, select: { id: true, readAt: true }, take: 1 },
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    });
  }

  async listUnreadForUser(user: AuthUser) {
    const userId = this.userId(user);
    const roles = this.visibleRolesForUser(user);
    return this.prisma.releaseNote.findMany({
      where: {
        isPublished: true,
        targetRole: { in: roles },
        releaseReads: { none: { userId } },
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: 30,
    });
  }

  async markRead(user: AuthUser, id: string) {
    const userId = this.userId(user);
    const roles = this.visibleRolesForUser(user);
    const note = await this.prisma.releaseNote.findFirst({
      where: { id, isPublished: true, targetRole: { in: roles } },
      select: { id: true },
    });
    if (!note) throw new ForbiddenException('Release note not visible');
    await this.prisma.releaseNoteRead.upsert({
      where: { releaseNoteId_userId: { releaseNoteId: id, userId } },
      create: { releaseNoteId: id, userId },
      update: { readAt: new Date() },
    });
    return { ok: true };
  }

  async superadminList(user: AuthUser, filters: ReleaseNotesFiltersDto) {
    this.assertSuperAdmin(user);
    return this.prisma.releaseNote.findMany({
      where: {
        ...(filters.targetRole ? { targetRole: filters.targetRole as ReleaseNoteTargetRole } : {}),
        ...(filters.isPublished !== undefined ? { isPublished: filters.isPublished } : {}),
      },
      include: { _count: { select: { releaseReads: true } } },
      orderBy: [{ createdAt: 'desc' }],
      take: 500,
    });
  }

  async superadminCreate(user: AuthUser, dto: CreateReleaseNoteDto) {
    this.assertSuperAdmin(user);
    return this.prisma.releaseNote.create({
      data: {
        title: dto.title.trim(),
        content: dto.content.trim(),
        version: dto.version?.trim() || null,
        targetRole: (dto.targetRole as ReleaseNoteTargetRole | undefined) || ReleaseNoteTargetRole.ALL,
      },
    });
  }

  async superadminUpdate(user: AuthUser, id: string, dto: UpdateReleaseNoteDto) {
    this.assertSuperAdmin(user);
    return this.prisma.releaseNote.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.content !== undefined ? { content: dto.content.trim() } : {}),
        ...(dto.version !== undefined ? { version: dto.version?.trim() || null } : {}),
        ...(dto.targetRole !== undefined ? { targetRole: dto.targetRole as ReleaseNoteTargetRole } : {}),
        ...(dto.isPublished !== undefined ? { isPublished: dto.isPublished } : {}),
      },
    });
  }

  async superadminDelete(user: AuthUser, id: string) {
    this.assertSuperAdmin(user);
    await this.prisma.releaseNote.delete({ where: { id } });
    return { ok: true };
  }

  async superadminPublish(user: AuthUser, id: string) {
    this.assertSuperAdmin(user);
    return this.prisma.releaseNote.update({
      where: { id },
      data: { isPublished: true, publishedAt: new Date() },
    });
  }
}
