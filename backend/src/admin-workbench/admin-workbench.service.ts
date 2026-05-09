import { Injectable } from '@nestjs/common';
import {
  InvoiceStatus,
  IssuePriority,
  IssueStatus,
  MaintenanceTaskStatus,
  MeterStatus,
  PaymentStatus,
  ResidentAccountStatus,
  Role,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { MvpUser } from '../security/mvp-auth.guard';

@Injectable()
export class AdminWorkbenchService {
  constructor(private readonly prisma: PrismaService) {}

  async getWorkbench(user: MvpUser, scopedOrganizationId?: string) {
    const organizationId = this.resolveOrganizationId(user, scopedOrganizationId);

    const [organization, finance, issues, meters, residents, payments, tasks, activity] = await Promise.all([
      this.safe(this.emptyOrganization(organizationId), () => this.getOrganization(organizationId)),
      this.safe(this.emptyFinance(), () => this.getFinance(organizationId)),
      this.safe(this.emptyIssues(), () => this.getIssues(organizationId)),
      this.safe(this.emptyMeters(), () => this.getMeters(organizationId)),
      this.safe(this.emptyResidents(), () => this.getResidents(organizationId)),
      this.safe(this.emptyPayments(), () => this.getRecentPayments(organizationId)),
      this.safe(this.emptyTasks(), async () => this.emptyTasks()),
      this.safe(this.emptyActivity(), () => this.getActivity(organizationId)),
    ]);

    return {
      organization,
      finance,
      issues,
      meters,
      residents,
      payments,
      tasks,
      activity,
    };
  }

  async getResidentCrm(user: MvpUser, scopedOrganizationId?: string) {
    const organizationId = this.resolveOrganizationId(user, scopedOrganizationId);
    const [
      organization,
      finance,
      issues,
      urgentIssues,
      meters,
      payments,
      activity,
      totalApartments,
      totalResidents,
      residentsWithoutAccount,
      priorityResidents,
      priorityApartments,
      tasks,
    ] =
      await Promise.all([
        this.safe(this.emptyOrganization(organizationId), () => this.getOrganization(organizationId)),
        this.safe(this.emptyFinance(), () => this.getFinance(organizationId)),
        this.safe(this.emptyIssues(), () => this.getIssues(organizationId)),
        this.safe([], () => this.getUrgentIssues(organizationId)),
        this.safe(this.emptyMeters(), () => this.getMeters(organizationId)),
        this.safe(this.emptyPayments(), () => this.getRecentPayments(organizationId)),
        this.safe(this.emptyActivity(), () => this.getActivity(organizationId)),
        this.safe(0, () => this.prisma.apartment.count({ where: { organizationId } })),
        this.safe(0, () => this.prisma.residentProfile.count({ where: { organizationId } })),
        this.safe(0, () =>
          this.prisma.residentProfile.count({
            where: {
              organizationId,
              OR: [{ userId: null }, { accountStatus: ResidentAccountStatus.NO_ACCOUNT }],
            },
          }),
        ),
        this.safe([], () => this.getPriorityResidents(organizationId)),
        this.safe([], () => this.getPriorityApartments(organizationId)),
        this.safe([], () => this.getAdminTasks(organizationId)),
      ]);

    return {
      organization,
      kpis: {
        totalApartments,
        totalResidents,
        residentsWithoutAccount,
        apartmentsWithDebt: finance.apartmentsWithDebt,
        totalDebt: finance.totalDebt,
        openIssues: issues.newCount + issues.inProgressCount,
        urgentIssues: issues.urgentCount,
        missingMeterReadings: meters.missingReadings,
      },
      priorityResidents,
      priorityApartments,
      urgentIssues,
      missingReadings: meters.latestMissing,
      recentPayments: payments.recent,
      tasks,
      activity: activity.recent,
    };
  }

  private resolveOrganizationId(user: MvpUser, scopedOrganizationId?: string) {
    if (this.isSuperadmin(user) && typeof scopedOrganizationId === 'string' && scopedOrganizationId.trim()) {
      return scopedOrganizationId.trim();
    }
    return user.organizationId;
  }

  private async getOrganization(organizationId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        legalName: true,
        fiscalCode: true,
        address: true,
        city: true,
        country: true,
        currency: true,
      },
    });

    if (!organization) return this.emptyOrganization(organizationId);
    const associationCode = this.stringValue(organization.fiscalCode);

    return {
      id: organization.id,
      shortName: this.stringValue(organization.name) || (associationCode ? `A.P.C. ${associationCode}` : 'A.P.C.'),
      legalName:
        this.stringValue(organization.legalName) ||
        (associationCode ? `Asociația de Proprietari din Condominiu ${associationCode}` : 'Asociația de Proprietari din Condominiu'),
      associationCode: associationCode || null,
      associationNumber: this.associationNumberFromCode(associationCode),
      address: organization.address,
      city: organization.city,
      country: organization.country || 'MD',
      currency: organization.currency || 'MDL',
    };
  }

  private async getFinance(organizationId: string) {
    const [invoices, payments] = await Promise.all([
      this.prisma.invoice.findMany({
        where: { organizationId },
        select: {
          id: true,
          apartmentId: true,
          amount: true,
          finalAmount: true,
          status: true,
          dueDate: true,
        },
      }),
      this.prisma.payment.findMany({
        where: { organizationId, status: PaymentStatus.CONFIRMED },
        select: {
          apartmentId: true,
          amount: true,
          status: true,
          note: true,
        },
      }),
    ]);

    const now = new Date();
    const totalIssued = this.money(invoices.reduce((sum, invoice) => sum + this.invoiceAmount(invoice), 0));
    const totalPaid = this.confirmedPaymentTotal(payments);
    const totalDebt = this.money(Math.max(totalIssued - totalPaid, 0));
    const invoicesWithDebt = invoices.filter((invoice) => {
      const linkedPayments = payments.filter((payment) => payment.note === this.invoicePaymentNote(invoice.id));
      return this.remainingDebtForInvoice(invoice, linkedPayments) > 0;
    });
    const overdueInvoices = invoicesWithDebt.filter((invoice) => invoice.dueDate && new Date(invoice.dueDate) < now).length;
    const apartmentsWithDebt = new Set(invoicesWithDebt.map((invoice) => invoice.apartmentId).filter(Boolean)).size;
    const collectionRate = totalIssued > 0 ? this.money((totalPaid / totalIssued) * 100) : 0;

    return {
      totalDebt,
      totalIssued,
      totalPaid,
      overdueInvoices,
      apartmentsWithDebt,
      collectionRate,
    };
  }

  private async getIssues(organizationId: string) {
    const activeStatuses = [IssueStatus.NEW, IssueStatus.IN_PROGRESS, IssueStatus.WAITING];
    const urgentPriorities = [IssuePriority.URGENT, IssuePriority.IMPORTANT, IssuePriority.HIGH];
    const [newCount, urgentCount, inProgressCount, latest] = await Promise.all([
      this.prisma.issue.count({ where: { organizationId, status: IssueStatus.NEW } }),
      this.prisma.issue.count({
        where: {
          organizationId,
          status: { in: activeStatuses },
          priority: { in: urgentPriorities },
        },
      }),
      this.prisma.issue.count({ where: { organizationId, status: IssueStatus.IN_PROGRESS } }),
      this.prisma.issue.findMany({
        where: { organizationId, status: { in: activeStatuses } },
        orderBy: [{ createdAt: 'desc' }],
        take: 6,
        select: {
          id: true,
          title: true,
          category: true,
          priority: true,
          status: true,
          createdAt: true,
          apartment: { select: { id: true, number: true, staircase: { select: { id: true, name: true } } } },
          resident: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
    ]);

    return {
      newCount,
      urgentCount,
      inProgressCount,
      latest: latest.map((issue) => ({
        id: issue.id,
        title: issue.title,
        category: issue.category,
        priority: issue.priority,
        status: issue.status,
        createdAt: issue.createdAt,
        apartmentNumber: issue.apartment?.number ?? null,
        staircaseName: issue.apartment?.staircase?.name ?? null,
        residentName: this.fullName(issue.resident),
        link: `/admin/issues/${issue.id}`,
      })),
    };
  }

  private async getUrgentIssues(organizationId: string) {
    const activeStatuses = [IssueStatus.NEW, IssueStatus.IN_PROGRESS, IssueStatus.WAITING];
    const urgentPriorities = [IssuePriority.URGENT, IssuePriority.IMPORTANT, IssuePriority.HIGH];
    const rows = await this.prisma.issue.findMany({
      where: {
        organizationId,
        status: { in: activeStatuses },
        priority: { in: urgentPriorities },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      take: 8,
      select: {
        id: true,
        title: true,
        category: true,
        priority: true,
        status: true,
        createdAt: true,
        apartment: { select: { id: true, number: true, staircase: { select: { id: true, name: true } } } },
        resident: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    return rows.map((issue) => ({
      id: issue.id,
      title: issue.title,
      category: issue.category,
      priority: issue.priority,
      status: issue.status,
      createdAt: issue.createdAt,
      apartmentNumber: issue.apartment?.number ?? null,
      staircaseName: issue.apartment?.staircase?.name ?? null,
      residentName: this.fullName(issue.resident),
      link: `/admin/issues/${issue.id}`,
    }));
  }

  private async getMeters(organizationId: string) {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const meters = await this.prisma.meter.findMany({
      where: { organizationId },
      orderBy: [{ updatedAt: 'desc' }],
      take: 500,
      select: {
        id: true,
        type: true,
        status: true,
        serialNumber: true,
        apartment: {
          select: {
            id: true,
            number: true,
            staircase: { select: { id: true, name: true } },
          },
        },
        readings: {
          orderBy: { readingDate: 'desc' },
          take: 1,
          select: { value: true, readingDate: true },
        },
      },
    });

    const missing = meters.filter((meter) => {
      const lastReadingDate = meter.readings?.[0]?.readingDate;
      return meter.status === MeterStatus.MISSING_READING || !lastReadingDate || lastReadingDate < monthStart;
    });
    const suspiciousReadings = meters.filter((meter) => meter.status === MeterStatus.SUSPICIOUS).length;

    return {
      missingReadings: missing.length,
      suspiciousReadings,
      latestMissing: missing.slice(0, 6).map((meter) => ({
        id: meter.id,
        type: meter.type,
        status: meter.status,
        serialNumber: meter.serialNumber ?? null,
        apartmentId: meter.apartment?.id ?? null,
        apartmentNumber: meter.apartment?.number ?? null,
        staircaseName: meter.apartment?.staircase?.name ?? null,
        lastReadingDate: meter.readings?.[0]?.readingDate ?? null,
        link: '/admin/meters',
      })),
    };
  }

  private async getPriorityResidents(organizationId: string) {
    const activeStatuses = [IssueStatus.NEW, IssueStatus.IN_PROGRESS, IssueStatus.WAITING];
    const residents = await this.prisma.residentProfile.findMany({
      where: { organizationId },
      orderBy: [{ updatedAt: 'desc' }],
      take: 500,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        accountStatus: true,
        userId: true,
        type: true,
        updatedAt: true,
        apartmentResidents: {
          select: {
            role: true,
            apartment: {
              select: {
                id: true,
                number: true,
                staircase: { select: { id: true, name: true } },
                invoices: { select: { amount: true, finalAmount: true, status: true, dueDate: true } },
                payments: {
                  where: { status: PaymentStatus.CONFIRMED },
                  select: { amount: true, paidAt: true, createdAt: true },
                },
                issues: {
                  where: { status: { in: activeStatuses } },
                  select: { id: true },
                },
              },
            },
          },
        },
        issues: {
          where: { status: { in: activeStatuses } },
          select: { id: true, updatedAt: true, createdAt: true },
        },
      },
    });

    return residents
      .map((resident) => {
        const apartmentRelations = resident.apartmentResidents || [];
        const apartments = apartmentRelations.map((relation) => relation.apartment).filter(Boolean);
        const invoices = apartments.flatMap((apartment) => apartment.invoices || []);
        const payments = apartments.flatMap((apartment) => apartment.payments || []);
        const totalInvoiced = invoices.reduce((sum, invoice) => sum + this.invoiceAmount(invoice), 0);
        const totalPaid = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
        const totalDebt = this.money(Math.max(totalInvoiced - totalPaid, 0));
        const openIssuesCount =
          (resident.issues || []).length + apartments.reduce((sum, apartment) => sum + (apartment.issues?.length || 0), 0);
        const accountStatus = resident.userId ? ResidentAccountStatus.CREATED : resident.accountStatus;
        const primaryRelation = apartmentRelations[0];
        const primaryApartment = primaryRelation?.apartment ?? null;
        const missingContact = !resident.phone || !resident.email;
        const needsFollowUp = totalDebt > 0 || accountStatus !== ResidentAccountStatus.CREATED || openIssuesCount > 0 || missingContact;

        return {
          id: resident.id,
          name: this.fullName(resident) || 'Locatar',
          phone: resident.phone,
          email: resident.email,
          accountStatus,
          role: primaryRelation?.role ?? resident.type,
          apartmentId: primaryApartment?.id ?? null,
          apartmentNumber: primaryApartment?.number ?? null,
          staircaseName: primaryApartment?.staircase?.name ?? null,
          apartments: apartments.map((apartment) => ({
            id: apartment.id,
            number: apartment.number,
            staircaseName: apartment.staircase?.name ?? null,
          })),
          totalDebt,
          openIssuesCount,
          missingContact,
          lastActivityAt: (resident.issues || [])
            .map((issue) => issue.updatedAt ?? issue.createdAt)
            .sort((left, right) => right.getTime() - left.getTime())[0] ?? resident.updatedAt,
          link: `/admin/residents/${resident.id}`,
          inviteLink: `/admin/residents/${resident.id}`,
          paymentLink: '/admin/payments',
          issueLink: '/admin/issues',
          needsFollowUp,
        };
      })
      .filter((resident) => resident.needsFollowUp)
      .sort((left, right) => {
        if (right.totalDebt !== left.totalDebt) return right.totalDebt - left.totalDebt;
        if (right.openIssuesCount !== left.openIssuesCount) return right.openIssuesCount - left.openIssuesCount;
        return Number(right.accountStatus !== ResidentAccountStatus.CREATED) - Number(left.accountStatus !== ResidentAccountStatus.CREATED);
      })
      .slice(0, 12);
  }

  private async getPriorityApartments(organizationId: string) {
    const now = new Date();
    const apartments = await this.prisma.apartment.findMany({
      where: { organizationId },
      orderBy: [{ updatedAt: 'desc' }],
      take: 500,
      select: {
        id: true,
        number: true,
        floor: true,
        areaM2: true,
        rooms: true,
        status: true,
        staircase: { select: { id: true, name: true } },
        invoices: { select: { id: true, amount: true, finalAmount: true, status: true, dueDate: true, month: true, year: true } },
        payments: {
          where: { status: PaymentStatus.CONFIRMED },
          orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
          select: { amount: true, paidAt: true, createdAt: true },
        },
        apartmentResidents: {
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
          take: 1,
          select: {
            role: true,
            resident: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
          },
        },
      },
    });

    return apartments
      .map((apartment) => {
        const totalInvoiced = apartment.invoices.reduce((sum, invoice) => sum + this.invoiceAmount(invoice), 0);
        const totalPaid = apartment.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
        const totalDebt = this.money(Math.max(totalInvoiced - totalPaid, 0));
        const unpaidInvoicesCount = apartment.invoices.filter((invoice) => invoice.status !== InvoiceStatus.PAID).length;
        const overdueInvoicesCount = apartment.invoices.filter(
          (invoice) => invoice.status !== InvoiceStatus.PAID && invoice.dueDate && invoice.dueDate < now,
        ).length;
        const primaryResident = apartment.apartmentResidents?.[0]?.resident ?? null;
        const lastPayment = apartment.payments?.[0];

        return {
          id: apartment.id,
          apartmentId: apartment.id,
          apartmentNumber: apartment.number,
          staircaseName: apartment.staircase?.name ?? null,
          floor: apartment.floor,
          areaM2: apartment.areaM2,
          rooms: apartment.rooms,
          status: apartment.status,
          residentId: primaryResident?.id ?? null,
          residentName: this.fullName(primaryResident),
          residentPhone: primaryResident?.phone ?? null,
          residentEmail: primaryResident?.email ?? null,
          totalInvoiced: this.money(totalInvoiced),
          totalPaid: this.money(totalPaid),
          totalDebt,
          unpaidInvoicesCount,
          overdueInvoicesCount,
          lastPaymentDate: lastPayment?.paidAt ?? lastPayment?.createdAt ?? null,
          link: `/admin/apartments/${apartment.id}`,
        };
      })
      .filter((apartment) => apartment.totalDebt > 0)
      .sort((left, right) => right.totalDebt - left.totalDebt)
      .slice(0, 12);
  }

  private async getAdminTasks(organizationId: string) {
    const tasks = await this.prisma.maintenanceTask.findMany({
      where: {
        organizationId,
        status: { notIn: [MaintenanceTaskStatus.COMPLETED, MaintenanceTaskStatus.CANCELLED] },
      },
      orderBy: [{ scheduledAt: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
      take: 10,
      select: {
        id: true,
        title: true,
        description: true,
        priority: true,
        status: true,
        scheduledAt: true,
        relatedIssueId: true,
        building: { select: { id: true, name: true } },
        staircase: { select: { id: true, name: true } },
      },
    });

    return tasks.map((task) => ({
      id: task.id,
      title: task.title,
      message: task.description || task.building?.name || task.staircase?.name || null,
      priority: task.priority,
      status: task.status,
      dueDate: task.scheduledAt,
      link: task.relatedIssueId ? `/admin/issues/${task.relatedIssueId}` : null,
    }));
  }

  private async getResidents(organizationId: string) {
    const withoutAccount = await this.prisma.residentProfile.count({
      where: {
        organizationId,
        OR: [{ userId: null }, { accountStatus: ResidentAccountStatus.NO_ACCOUNT }],
      },
    });

    const apartments = await this.prisma.apartment.findMany({
      where: { organizationId },
      select: {
        id: true,
        number: true,
        invoices: { select: { amount: true, finalAmount: true } },
        payments: {
          where: { status: PaymentStatus.CONFIRMED },
          select: { amount: true },
        },
        staircase: { select: { id: true, name: true } },
        apartmentResidents: {
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
          take: 1,
          select: {
            role: true,
            resident: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                accountStatus: true,
                userId: true,
              },
            },
          },
        },
      },
    });

    const withDebtRows = apartments
      .map((apartment) => {
        const totalInvoiced = apartment.invoices.reduce((sum, invoice) => sum + this.invoiceAmount(invoice), 0);
        const totalPaid = apartment.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
        const totalDebt = this.money(Math.max(totalInvoiced - totalPaid, 0));
        const relation = apartment.apartmentResidents?.[0];
        const resident = relation?.resident ?? null;

        return {
          id: apartment.id,
          apartmentId: apartment.id,
          apartmentNumber: apartment.number,
          staircaseName: apartment.staircase?.name ?? null,
          residentId: resident?.id ?? null,
          residentName: this.fullName(resident),
          residentPhone: resident?.phone ?? null,
          accountStatus: resident?.userId ? ResidentAccountStatus.CREATED : resident?.accountStatus ?? null,
          role: relation?.role ?? null,
          totalDebt,
          link: `/admin/apartments/${apartment.id}`,
        };
      })
      .filter((item) => item.totalDebt > 0)
      .sort((left, right) => right.totalDebt - left.totalDebt);

    return {
      withoutAccount,
      withDebt: withDebtRows.length,
      latestWithDebt: withDebtRows.slice(0, 6),
    };
  }

  private async getRecentPayments(organizationId: string) {
    const rows = await this.prisma.payment.findMany({
      where: { organizationId },
      orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
      take: 6,
      select: {
        id: true,
        amount: true,
        currency: true,
        method: true,
        status: true,
        paidAt: true,
        createdAt: true,
        apartment: { select: { id: true, number: true, staircase: { select: { id: true, name: true } } } },
        invoice: { select: { id: true, invoiceNumber: true, month: true, year: true } },
      },
    });

    return {
      recent: rows.map((payment) => ({
        id: payment.id,
        amount: Number(payment.amount || 0),
        currency: payment.currency || 'MDL',
        method: payment.method,
        status: payment.status,
        paidAt: payment.paidAt ?? payment.createdAt,
        apartmentId: payment.apartment?.id ?? null,
        apartmentNumber: payment.apartment?.number ?? null,
        staircaseName: payment.apartment?.staircase?.name ?? null,
        invoice: payment.invoice,
        link: `/admin/payments/${payment.id}/print`,
      })),
    };
  }

  private async getActivity(organizationId: string) {
    const rows = await this.prisma.auditLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 12,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    return {
      recent: rows.map((row) => {
        const payload = this.objectPayload(row.newValuesJson);
        return {
          id: row.id,
          type: row.action,
          title: this.stringValue(payload.title) || row.description || row.action,
          message: this.stringValue(payload.message) || row.description,
          actorName: this.fullName(row.user),
          targetType: row.entityType,
          targetId: row.entityId,
          link: this.stringValue(payload.link) || null,
          createdAt: row.createdAt,
        };
      }),
    };
  }

  private emptyOrganization(id: string) {
    return {
      id,
      shortName: 'A.P.C.',
      legalName: 'Asociația de Proprietari din Condominiu',
      associationCode: null,
      associationNumber: null,
      address: null,
      city: null,
      country: 'MD',
      currency: 'MDL',
    };
  }

  private emptyFinance() {
    return {
      totalDebt: 0,
      totalIssued: 0,
      totalPaid: 0,
      overdueInvoices: 0,
      apartmentsWithDebt: 0,
      collectionRate: 0,
    };
  }

  private emptyIssues() {
    return {
      newCount: 0,
      urgentCount: 0,
      inProgressCount: 0,
      latest: [],
    };
  }

  private emptyMeters() {
    return {
      missingReadings: 0,
      suspiciousReadings: 0,
      latestMissing: [],
    };
  }

  private emptyResidents() {
    return {
      withoutAccount: 0,
      withDebt: 0,
      latestWithDebt: [],
    };
  }

  private emptyPayments() {
    return {
      recent: [],
    };
  }

  private emptyTasks() {
    return {
      dueToday: 0,
      overdue: 0,
      items: [],
    };
  }

  private emptyActivity() {
    return {
      recent: [],
    };
  }

  private async safe<T>(fallback: T, producer: () => Promise<T>) {
    try {
      return await producer();
    } catch {
      return fallback;
    }
  }

  private isSuperadmin(user: MvpUser) {
    return String(user.role).toUpperCase() === Role.SUPERADMIN;
  }

  private invoicePaymentNote(invoiceId: string) {
    return `Invoice ${invoiceId}`;
  }

  private invoiceAmount(row: { finalAmount?: number | null; amount?: number | null }) {
    return Number(row.finalAmount || row.amount || 0);
  }

  private confirmedPaymentTotal(payments: Array<{ amount?: number | null; status?: PaymentStatus | string | null }>) {
    return this.money(
      (payments || [])
        .filter((payment) => !payment.status || payment.status === PaymentStatus.CONFIRMED || String(payment.status).toUpperCase() === 'CONFIRMED')
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    );
  }

  private remainingDebtForInvoice(
    invoice: { status?: InvoiceStatus | null; finalAmount?: number | null; amount?: number | null },
    payments: Array<{ amount?: number | null; status?: PaymentStatus | string | null }> = [],
  ) {
    if (invoice.status === InvoiceStatus.PAID) return 0;
    return this.money(Math.max(this.invoiceAmount(invoice) - this.confirmedPaymentTotal(payments), 0));
  }

  private associationNumberFromCode(code: string) {
    return code.match(/-(\d{4})$/)?.[1] || null;
  }

  private fullName(person?: { firstName?: string | null; lastName?: string | null; email?: string | null } | null) {
    const name = `${person?.firstName || ''} ${person?.lastName || ''}`.trim();
    return name || person?.email || null;
  }

  private objectPayload(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
  }

  private stringValue(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : '';
  }

  private money(value: number) {
    return Math.round((Number(value) || 0) * 100) / 100;
  }
}
