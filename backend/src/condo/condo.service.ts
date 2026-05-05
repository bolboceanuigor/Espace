import { ForbiddenException, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAnnualSummaryDto } from './dto/create-annual-summary.dto';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';

function isAdminScope(role: Role) {
  return role === Role.ADMIN || role === Role.SUPERADMIN;
}

@Injectable()
export class CondoService {
  constructor(private readonly prisma: PrismaService) {}

  async getOwnerDashboard(organizationId: string, userId: string, role: Role) {
    if (!organizationId) {
      throw new ForbiddenException('Organization context missing');
    }
    if (
      role !== Role.RESIDENT &&
      role !== Role.ADMIN &&
      role !== Role.SUPERADMIN
    ) {
      throw new ForbiddenException('Access denied');
    }

    const [organization, latestSummary, announcements, ownedUnits] = await Promise.all([
      this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { id: true, name: true, defaultLocale: true, weekStart: true },
      }),
      this.prisma.annualSummary.findFirst({
        where: { organizationId, status: 'PUBLISHED' },
        orderBy: [{ year: 'desc' }, { publishedAt: 'desc' }],
      }),
      this.prisma.condoAnnouncement.findMany({
        where: {
          organizationId,
          visibility: { in: ['OWNERS', 'ALL'] },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.condoUnit.findMany({
        where: { organizationId, ownerUserId: userId },
        include: { building: { select: { id: true, name: true, address: true } } },
        orderBy: [{ building: { name: 'asc' } }, { number: 'asc' }],
      }),
    ]);

    const totalMonthlyFeeMdl = ownedUnits.reduce((sum, unit) => sum + Number(unit.monthlyFeeMdl || 0), 0);
    const totalDebtMdl = ownedUnits.reduce((sum, unit) => sum + Number(unit.debtMdl || 0), 0);
    const totalRepairFundMdl = ownedUnits.reduce((sum, unit) => sum + Number(unit.repairFundMdl || 0), 0);

    return {
      organization,
      summary: latestSummary
        ? {
            year: latestSummary.year,
            adminName: latestSummary.adminName,
            totalBudgetMdl: latestSummary.totalBudgetMdl,
            totalExpensesMdl: latestSummary.totalExpensesMdl,
            repairFundMdl: latestSummary.repairFundMdl,
            debtTotalMdl: latestSummary.debtTotalMdl,
            publishedAt: latestSummary.publishedAt,
            notes: latestSummary.notes,
          }
        : null,
      announcements: announcements.map((item) => ({
        id: item.id,
        title: item.title,
        body: item.body,
        visibility: item.visibility,
        createdAt: item.createdAt,
      })),
      units: ownedUnits.map((unit) => ({
        id: unit.id,
        buildingName: unit.building.name,
        buildingAddress: unit.building.address,
        unitNumber: unit.number,
        floor: unit.floor,
        areaSqm: unit.areaSqm,
        monthlyFeeMdl: unit.monthlyFeeMdl,
        repairFundMdl: unit.repairFundMdl,
        debtMdl: unit.debtMdl,
      })),
      totals: {
        totalMonthlyFeeMdl,
        totalDebtMdl,
        totalRepairFundMdl,
      },
    };
  }

  async listAnnualSummaries(organizationId: string, role: Role) {
    if (!isAdminScope(role)) {
      throw new ForbiddenException('Only admins can manage annual summary');
    }
    return this.prisma.annualSummary.findMany({
      where: { organizationId },
      orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createAnnualSummary(
    organizationId: string,
    userId: string,
    role: Role,
    dto: CreateAnnualSummaryDto,
  ) {
    if (!isAdminScope(role)) {
      throw new ForbiddenException('Only admins can manage annual summary');
    }
    return this.prisma.annualSummary.upsert({
      where: {
        organizationId_year: {
          organizationId,
          year: dto.year,
        },
      },
      update: {
        adminName: dto.adminName.trim(),
        totalBudgetMdl: dto.totalBudgetMdl,
        totalExpensesMdl: dto.totalExpensesMdl,
        repairFundMdl: dto.repairFundMdl,
        debtTotalMdl: dto.debtTotalMdl,
        notes: dto.notes?.trim() || null,
        status: 'DRAFT',
        publishedAt: null,
      },
      create: {
        organizationId,
        year: dto.year,
        adminName: dto.adminName.trim(),
        totalBudgetMdl: dto.totalBudgetMdl,
        totalExpensesMdl: dto.totalExpensesMdl,
        repairFundMdl: dto.repairFundMdl,
        debtTotalMdl: dto.debtTotalMdl,
        notes: dto.notes?.trim() || null,
        status: 'DRAFT',
        createdById: userId,
      },
    });
  }

  async publishAnnualSummary(organizationId: string, role: Role, id: string) {
    if (!isAdminScope(role)) {
      throw new ForbiddenException('Only admins can publish annual summary');
    }
    return this.prisma.annualSummary.updateMany({
      where: { id, organizationId },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });
  }

  async listAnnouncements(organizationId: string) {
    return this.prisma.condoAnnouncement.findMany({
      where: { organizationId, visibility: { in: ['OWNERS', 'ALL'] } },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
  }

  async createAnnouncement(organizationId: string, userId: string, role: Role, dto: CreateAnnouncementDto) {
    if (!isAdminScope(role)) {
      throw new ForbiddenException('Only admins can publish announcements');
    }
    return this.prisma.condoAnnouncement.create({
      data: {
        organizationId,
        title: dto.title.trim(),
        body: dto.body.trim(),
        visibility: dto.visibility || 'OWNERS',
        createdById: userId,
      },
    });
  }
}
