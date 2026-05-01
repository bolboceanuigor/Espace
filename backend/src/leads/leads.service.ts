import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { CreateLeadActivityDto } from './dto/create-lead-activity.dto';
import { ConvertLeadDto } from './dto/convert-lead.dto';

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  createPublicLead(dto: CreateLeadDto) {
    return this.prisma.lead.create({
      data: {
        name: dto.name.trim(),
        phone: dto.phone.trim(),
        email: dto.email.trim().toLowerCase(),
        associationName: dto.associationName?.trim() || null,
        apartmentsCount: dto.apartmentsCount ?? null,
        city: dto.city?.trim() || null,
        notes: dto.notes?.trim() || null,
        source: 'WEBSITE',
        status: 'NEW',
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
      },
    });
  }

  listForSuperadmin(filters?: { city?: string; source?: string; status?: string }) {
    return this.prisma.lead.findMany({
      where: {
        ...(filters?.city ? { city: filters.city } : {}),
        ...(filters?.source ? { source: filters.source as any } : {}),
        ...(filters?.status ? { status: filters.status as any } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: {
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
  }

  createForSuperadmin(dto: CreateLeadDto) {
    return this.prisma.lead.create({
      data: {
        name: dto.name.trim(),
        phone: dto.phone.trim(),
        email: dto.email.trim().toLowerCase(),
        associationName: dto.associationName?.trim() || null,
        apartmentsCount: dto.apartmentsCount ?? null,
        city: dto.city?.trim() || null,
        notes: dto.notes?.trim() || null,
        source: (dto.source as any) || 'MANUAL',
        status: 'NEW',
      },
    });
  }

  async getForSuperadmin(id: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      include: {
        organization: {
          select: { id: true, name: true, createdAt: true },
        },
        activities: {
          orderBy: { createdAt: 'desc' },
          include: {
            createdByUser: {
              select: { id: true, email: true, firstName: true, lastName: true },
            },
          },
        },
      },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }

  updateForSuperadmin(id: string, dto: UpdateLeadDto) {
    return this.prisma.lead.update({
      where: { id },
      data: {
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.source ? { source: dto.source as any } : {}),
        ...(dto.name !== undefined ? { name: dto.name?.trim() || '' } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone?.trim() || '' } : {}),
        ...(dto.email !== undefined ? { email: dto.email?.trim().toLowerCase() || '' } : {}),
        ...(dto.associationName !== undefined ? { associationName: dto.associationName?.trim() || null } : {}),
        ...(dto.apartmentsCount !== undefined ? { apartmentsCount: dto.apartmentsCount } : {}),
        ...(dto.city !== undefined ? { city: dto.city?.trim() || null } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
      },
    });
  }

  async deleteForSuperadmin(id: string) {
    const existing = await this.prisma.lead.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException('Lead not found');
    await this.prisma.lead.delete({ where: { id } });
    return { ok: true };
  }

  async addActivity(leadId: string, createdByUserId: string, dto: CreateLeadActivityDto) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId }, select: { id: true } });
    if (!lead) throw new NotFoundException('Lead not found');
    return this.prisma.leadActivity.create({
      data: {
        leadId,
        createdByUserId,
        type: dto.type as any,
        content: dto.content.trim(),
      },
    });
  }

  async convertToOrganization(leadId: string, dto: ConvertLeadDto) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, associationName: true, name: true, organizationId: true },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    if (lead.organizationId) {
      return this.prisma.organization.findUnique({ where: { id: lead.organizationId } });
    }
    const orgName = dto.organizationName?.trim() || lead.associationName?.trim() || `Asociatie ${lead.name}`;
    return this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: orgName,
          onboardingCompleted: false,
          onboardingStatus: 'NOT_STARTED',
          onboardingStep: 'ORGANIZATION_DETAILS',
          onboardingCompletedAt: null,
          defaultLocale: 'ro',
          weekStart: 'MONDAY',
        },
      });
      await tx.lead.update({
        where: { id: leadId },
        data: {
          organizationId: org.id,
          status: 'WON',
        },
      });
      return org;
    });
  }
}

