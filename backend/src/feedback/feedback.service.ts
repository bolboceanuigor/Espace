import { ForbiddenException, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { UpdateFeedbackDto } from './dto/update-feedback.dto';

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    organizationId: string | undefined,
    userId: string,
    userRole: string,
    dto: CreateFeedbackDto,
  ) {
    return this.prisma.feedback.create({
      data: {
        organizationId: organizationId || null,
        userId,
        userRole: userRole.toUpperCase(),
        pageUrl: dto.pageUrl || null,
        type: dto.type,
        title: dto.title.trim(),
        message: dto.message.trim(),
        status: 'NEW',
        priority: 'MEDIUM',
        screenshotUrl: dto.screenshotUrl || null,
      },
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        pageUrl: true,
        status: true,
        priority: true,
        createdAt: true,
      },
    });
  }

  async list(organizationId: string, role: Role) {
    if (role !== Role.ADMIN && role !== Role.SUPERADMIN) {
      throw new ForbiddenException('Only admins can view feedback');
    }
    return this.prisma.feedback.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        status: true,
        priority: true,
        pageUrl: true,
        screenshotUrl: true,
        createdAt: true,
        user: {
          select: { id: true, email: true },
        },
      },
    });
  }

  async listForSuperadmin(filters: {
    organizationId?: string;
    type?: 'BUG' | 'IDEA' | 'QUESTION' | 'COMPLAINT';
    status?: 'NEW' | 'REVIEWED' | 'IN_PROGRESS' | 'RESOLVED' | 'REJECTED';
    priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  }) {
    return this.prisma.feedback.findMany({
      where: {
        organizationId: filters.organizationId || undefined,
        type: filters.type || undefined,
        status: filters.status || undefined,
        priority: filters.priority || undefined,
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        status: true,
        priority: true,
        pageUrl: true,
        screenshotUrl: true,
        userRole: true,
        createdAt: true,
        updatedAt: true,
        organization: {
          select: { id: true, name: true },
        },
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async updateBySuperadmin(id: string, dto: UpdateFeedbackDto) {
    return this.prisma.feedback.update({
      where: { id },
      data: {
        status: dto.status,
        priority: dto.priority,
      },
      select: {
        id: true,
        status: true,
        priority: true,
        updatedAt: true,
      },
    });
  }
}
