import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getOrgScope } from '../common/org-scope';

@Injectable()
export class RbacDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSuperadminOverview(user: { role?: string; organizationId?: string | null }, requestedOrgId?: string) {
    const role = String(user.role || '').toUpperCase();
    if (role !== 'SUPERADMIN' && role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Super admin access required');
    }

    const [totalOrganizations, totalApartments, totalAdmins, totalResidents, revenueAggregate, unpaidOrganizations] =
      await Promise.all([
        this.prisma.organization.count(),
        this.prisma.apartment.count(),
        this.prisma.user.count({ where: { role: { in: ['ADMIN'] }, deletedAt: null } }),
        this.prisma.user.count({ where: { role: { in: ['RESIDENT', 'TENANT'] }, deletedAt: null } }),
        this.prisma.payment.aggregate({
          where: {
            status: 'CONFIRMED',
            createdAt: {
              gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            },
          },
          _sum: { amount: true },
        }),
        this.prisma.organization.count({
          where: {
            OR: [
              { subscriptionStatus: { in: ['PAST_DUE', 'UNPAID'] } },
              { subscription: { is: { status: { in: ['PAST_DUE', 'EXPIRED'] } } } },
            ],
          },
        }),
      ]);

    return {
      supportOrganizationId: getOrgScope(user, requestedOrgId),
      totalOrganizations,
      totalApartments,
      totalAdmins,
      totalResidents,
      monthlyRevenue: Number(revenueAggregate._sum.amount || 0),
      unpaidOrganizations,
    };
  }

  async getSuperadminCommandCenter(user: { role?: string; organizationId?: string | null }, requestedOrgId?: string) {
    const role = String(user.role || '').toUpperCase();
    if (role !== 'SUPERADMIN' && role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Super admin access required');
    }
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const soonThreshold = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const [
      mrrAggregate,
      paidInvoicesCount,
      unpaidInvoicesCount,
      overdueInvoicesAggregate,
      organizationsTotal,
      organizationsActive,
      organizationsTrial,
      organizationsPastDue,
      organizationsSuspended,
      organizationsCancelled,
      totalApartments,
      totalResidents,
      totalAdmins,
      totalInvoicesGenerated,
      totalPaymentsRecorded,
      newLeads,
      demoRequests,
      trialsEndingSoonCount,
      trialsTotalCount,
      trialsConvertedCount,
      openFeedback,
      unresolvedSystemErrors,
      failedJobs,
      pendingFollowUps,
      trialsEndingSoonRows,
      overdueOrganizationsRows,
      pendingFollowUpsRows,
      recentLeadsRows,
    ] = await Promise.all([
      this.prisma.organizationSubscription.aggregate({
        where: { status: { in: ['ACTIVE', 'TRIAL', 'PAST_DUE'] } },
        _sum: { price: true },
      }),
      this.prisma.organizationInvoice.count({ where: { status: 'PAID' } }),
      this.prisma.organizationInvoice.count({ where: { status: 'UNPAID' } }),
      this.prisma.organizationInvoice.aggregate({
        where: { status: 'OVERDUE' },
        _sum: { amount: true },
      }),
      this.prisma.organization.count(),
      this.prisma.organizationSubscription.count({ where: { status: 'ACTIVE' } }),
      this.prisma.organizationSubscription.count({ where: { status: 'TRIAL' } }),
      this.prisma.organizationSubscription.count({ where: { status: 'PAST_DUE' } }),
      this.prisma.organizationSubscription.count({ where: { status: 'SUSPENDED' } }),
      this.prisma.organizationSubscription.count({ where: { status: 'CANCELLED' } }),
      this.prisma.apartment.count(),
      this.prisma.user.count({ where: { role: { in: ['RESIDENT', 'TENANT'] }, deletedAt: null } }),
      this.prisma.user.count({ where: { role: 'ADMIN', deletedAt: null } }),
      this.prisma.residentInvoice.count(),
      this.prisma.payment.count({ where: { status: 'CONFIRMED' } }),
      this.prisma.lead.count({ where: { createdAt: { gte: monthStart } } }),
      this.prisma.demoRequest.count({ where: { createdAt: { gte: monthStart } } }),
      this.prisma.organizationSubscription.count({
        where: { status: 'TRIAL', trialEndDate: { gte: now, lte: soonThreshold } },
      }),
      this.prisma.organizationSubscription.count({ where: { status: 'TRIAL' } }),
      this.prisma.organizationSubscription.count({ where: { status: 'ACTIVE', trialStartDate: { not: null } } }),
      this.prisma.feedback.count({ where: { status: { in: ['NEW', 'IN_PROGRESS'] } } }),
      this.prisma.systemErrorLog.count({ where: { resolved: false } }),
      this.prisma.systemErrorLog.count({ where: { resolved: false, source: 'JOB' } }),
      (this.prisma as any).clientNote.count({ where: { followUpAt: { not: null }, followUpDone: false } }),
      this.prisma.organizationSubscription.findMany({
        where: { status: 'TRIAL', trialEndDate: { gte: now, lte: soonThreshold } },
        include: { organization: { select: { id: true, name: true } } },
        orderBy: { trialEndDate: 'asc' },
        take: 8,
      }),
      this.prisma.organizationSubscription.findMany({
        where: { status: { in: ['PAST_DUE', 'SUSPENDED'] } },
        include: { organization: { select: { id: true, name: true } } },
        orderBy: [{ outstandingAmount: 'desc' }, { updatedAt: 'desc' }],
        take: 8,
      }),
      (this.prisma as any).clientNote.findMany({
        where: { followUpAt: { not: null }, followUpDone: false },
        include: { organization: { select: { id: true, name: true } } },
        orderBy: [{ followUpAt: 'asc' }, { createdAt: 'desc' }],
        take: 8,
      }),
      this.prisma.lead.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          associationName: true,
          status: true,
          createdAt: true,
        },
      }),
    ]);

    const dueTodayTasks = await (this.prisma as any).superAdminTask.count({
      where: {
        status: { in: ['TODO', 'IN_PROGRESS'] },
        dueDate: { gte: startOfDay, lte: endOfDay },
      },
    });
    const overdueTasks = await (this.prisma as any).superAdminTask.count({
      where: {
        status: { in: ['TODO', 'IN_PROGRESS'] },
        dueDate: { lt: startOfDay },
      },
    });

    return {
      supportOrganizationId: getOrgScope(user, requestedOrgId),
      revenue: {
        monthlyRecurringRevenueEstimate: Number(mrrAggregate._sum.price || 0),
        paidOrganizationInvoices: paidInvoicesCount,
        unpaidOrganizationInvoices: unpaidInvoicesCount,
        overdueAmount: Number(overdueInvoicesAggregate._sum.amount || 0),
      },
      organizations: {
        total: organizationsTotal,
        active: organizationsActive,
        trial: organizationsTrial,
        pastDue: organizationsPastDue,
        suspended: organizationsSuspended,
        cancelled: organizationsCancelled,
      },
      usage: {
        totalApartments,
        totalResidents,
        totalAdmins,
        totalInvoicesGenerated,
        totalPaymentsRecorded,
      },
      sales: {
        newLeads,
        demoRequests,
        trialsEndingSoon: trialsEndingSoonCount,
        trialConversionRate: trialsTotalCount > 0 ? Math.round((trialsConvertedCount / (trialsConvertedCount + trialsTotalCount)) * 100) : 0,
      },
      support: {
        openFeedback,
        unresolvedSystemErrors,
        failedJobs,
        pendingFollowUps,
      },
      tasks: {
        dueToday: dueTodayTasks,
        overdue: overdueTasks,
      },
      tables: {
        trialsEndingSoon: trialsEndingSoonRows.map((row) => ({
          organizationId: row.organizationId,
          organizationName: row.organization?.name || '-',
          trialEndDate: row.trialEndDate,
          status: row.status,
        })),
        overdueOrganizations: overdueOrganizationsRows.map((row) => ({
          organizationId: row.organizationId,
          organizationName: row.organization?.name || '-',
          status: row.status,
          outstandingAmount: row.outstandingAmount,
          currency: row.currency,
          nextBillingDate: row.nextBillingDate,
        })),
        pendingFollowUps: pendingFollowUpsRows.map((row: any) => ({
          id: row.id,
          organizationId: row.organizationId,
          organizationName: row.organization?.name || '-',
          title: row.title,
          followUpAt: row.followUpAt,
          type: row.type,
        })),
        recentLeads: recentLeadsRows,
      },
    };
  }

  async getAdminOverview(user: { role?: string; organizationId?: string | null }) {
    const role = String(user.role || '').toUpperCase();
    if (!['ADMIN', 'SUPERADMIN', 'SUPER_ADMIN'].includes(role)) {
      throw new ForbiddenException('Admin access required');
    }
    const organizationId = getOrgScope(user);

    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const [organization, totalApartments, totalResidents, totalDebtAggregate, monthlyPaymentsAggregate, activeIssues, recentPayments] =
      await Promise.all([
        this.prisma.organization.findUnique({
          where: { id: organizationId },
          select: { id: true, name: true },
        }),
        this.prisma.apartment.count({ where: { organizationId } }),
        this.prisma.user.count({ where: { organizationId, role: { in: ['RESIDENT', 'TENANT'] }, deletedAt: null } }),
        this.prisma.payment.aggregate({
          where: { organizationId, status: { in: ['PENDING'] } },
          _sum: { amount: true },
        }),
        this.prisma.payment.aggregate({
          where: { organizationId, status: 'CONFIRMED', createdAt: { gte: monthStart } },
          _sum: { amount: true },
        }),
        this.prisma.issue.count({ where: { organizationId, status: { in: ['NEW', 'IN_PROGRESS', 'WAITING'] } } }),
        this.prisma.payment.findMany({
          where: { organizationId },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { id: true, amount: true, status: true, month: true, apartment: { select: { number: true } } },
        }),
      ]);

    return {
      organizationName: organization?.name || null,
      totalApartments,
      totalResidents,
      totalDebt: Number(totalDebtAggregate._sum.amount || 0),
      monthlyPayments: Number(monthlyPaymentsAggregate._sum.amount || 0),
      activeIssues,
      recentPayments: recentPayments.map((payment) => ({
        id: payment.id,
        apartmentNumber: payment.apartment.number,
        amount: payment.amount,
        status: payment.status,
        month: payment.month,
      })),
    };
  }

  async getResidentApartments(user: { role?: string; id?: string; sub?: string; organizationId?: string | null }) {
    const role = String(user.role || '').toUpperCase();
    if (!['RESIDENT', 'TENANT'].includes(role)) {
      throw new ForbiddenException('Resident access required');
    }
    const userId = user.id || user.sub;
    const organizationId = getOrgScope(user);

    const residentProfiles = await this.prisma.residentProfile.findMany({
      where: { userId, organizationId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      include: {
        apartment: {
          select: {
            id: true,
            number: true,
            floor: true,
            areaM2: true,
            building: { select: { name: true } },
            staircase: { select: { name: true } },
          },
        },
      },
    });
    return residentProfiles.map((profile) => ({
      id: profile.id,
      apartmentId: profile.apartmentId,
      type: profile.type,
      isPrimary: profile.isPrimary,
      phone: profile.phone,
      apartment: profile.apartment,
    }));
  }

  async getResidentOverview(
    user: { role?: string; id?: string; sub?: string; organizationId?: string | null },
    requestedApartmentId?: string,
  ) {
    const role = String(user.role || '').toUpperCase();
    if (!['RESIDENT', 'TENANT'].includes(role)) {
      throw new ForbiddenException('Resident access required');
    }
    const userId = user.id || user.sub;
    const organizationId = getOrgScope(user);
    const residentProfiles = await this.getResidentApartments(user);
    if (!residentProfiles.length) {
      return {
        apartments: [],
        selectedApartmentId: null,
        currentDebt: 0,
        lastPayments: [],
        announcements: [],
        myIssues: [],
      };
    }
    const allowedApartmentIds = residentProfiles.map((profile) => profile.apartmentId);
    const activeApartmentId =
      requestedApartmentId && allowedApartmentIds.includes(requestedApartmentId)
        ? requestedApartmentId
        : residentProfiles[0].apartmentId;

    const [apartment, debtAggregate, lastPayments, myIssues, announcements] = await Promise.all([
      this.prisma.apartment.findFirst({
        where: { id: activeApartmentId, organizationId },
        select: { id: true, number: true, floor: true, areaM2: true, building: { select: { name: true } } },
      }),
      this.prisma.payment.aggregate({
        where: { organizationId, apartmentId: activeApartmentId, status: { in: ['PENDING'] } },
        _sum: { amount: true },
      }),
      this.prisma.payment.findMany({
        where: { organizationId, apartmentId: activeApartmentId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      this.prisma.issue.findMany({
        where: { organizationId, apartmentId: activeApartmentId, createdByUserId: userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.announcement.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, title: true, content: true, createdAt: true },
      }),
    ]);

    return {
      apartments: residentProfiles,
      selectedApartmentId: apartment?.id || activeApartmentId,
      apartmentNumber: apartment?.number || null,
      currentDebt: Number(debtAggregate._sum.amount || 0),
      lastPayments,
      announcements,
      myIssues,
    };
  }
}
