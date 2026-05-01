import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { HelpCategory } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertHelpArticleDto } from './dto/upsert-help-article.dto';

@Injectable()
export class HelpService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeRole(role: string | undefined): 'SUPER_ADMIN' | 'ADMIN' | 'RESIDENT' {
    const upper = String(role || '').toUpperCase();
    if (upper === 'SUPERADMIN' || upper === 'SUPER_ADMIN') return 'SUPER_ADMIN';
    if (upper === 'ADMIN' || upper === 'MANAGER') return 'ADMIN';
    return 'RESIDENT';
  }

  async listForUser(role: string, params?: { category?: string; search?: string }) {
    const normalizedRole = this.normalizeRole(role);
    const category =
      params?.category && (Object.values(HelpCategory) as string[]).includes(params.category)
        ? (params.category as HelpCategory)
        : undefined;
    return this.prisma.helpArticle.findMany({
      where: {
        isPublished: true,
        targetRole: { in: ['ALL', normalizedRole] },
        category,
        OR: params?.search
          ? [
              { title: { contains: params.search, mode: 'insensitive' } },
              { content: { contains: params.search, mode: 'insensitive' } },
            ]
          : undefined,
      },
      orderBy: [{ category: 'asc' }, { updatedAt: 'desc' }],
    });
  }

  async getBySlugForUser(role: string, slug: string) {
    const normalizedRole = this.normalizeRole(role);
    const article = await this.prisma.helpArticle.findUnique({ where: { slug } });
    if (!article || !article.isPublished) {
      throw new NotFoundException('Article not found');
    }
    if (article.targetRole !== 'ALL' && article.targetRole !== normalizedRole) {
      throw new ForbiddenException('Article not available for your role');
    }
    return article;
  }

  async superadminListAll() {
    return this.prisma.helpArticle.findMany({
      orderBy: [{ updatedAt: 'desc' }],
    });
  }

  async superadminCreate(dto: UpsertHelpArticleDto) {
    return this.prisma.helpArticle.create({
      data: {
        title: dto.title.trim(),
        slug: dto.slug.trim().toLowerCase(),
        content: dto.content,
        targetRole: dto.targetRole,
        category: dto.category,
        isPublished: dto.isPublished ?? false,
      },
    });
  }

  async superadminUpdate(id: string, dto: Partial<UpsertHelpArticleDto>) {
    const existing = await this.prisma.helpArticle.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException('Article not found');
    return this.prisma.helpArticle.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.slug !== undefined ? { slug: dto.slug.trim().toLowerCase() } : {}),
        ...(dto.content !== undefined ? { content: dto.content } : {}),
        ...(dto.targetRole !== undefined ? { targetRole: dto.targetRole } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.isPublished !== undefined ? { isPublished: dto.isPublished } : {}),
      },
    });
  }

  async superadminDelete(id: string) {
    const existing = await this.prisma.helpArticle.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException('Article not found');
    await this.prisma.helpArticle.delete({ where: { id } });
    return { ok: true };
  }
}

