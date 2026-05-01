import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { BillingCurrency, OrganizationSubscriptionStatus, Role } from '@prisma/client';
import PDFDocument from 'pdfkit';
import * as XLSX from 'xlsx';
import { PrismaService } from '../prisma/prisma.service';
import { DebtsReportQueryDto, MonthlyReportQueryDto, PaymentsReportQueryDto, ResidentStatementQueryDto } from './dto/reports.dto';

type AuthUser = { id?: string; sub?: string; role?: string; organizationId?: string | null };

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private userId(user: AuthUser) {
    return user.id || user.sub || '';
  }

  private assertAdmin(user: AuthUser) {
    if (String(user.role || '').toUpperCase() !== 'ADMIN') throw new ForbiddenException('Admin access required');
    if (!user.organizationId) throw new ForbiddenException('Organization context missing');
    return user.organizationId;
  }

  private assertSuperadmin(user: AuthUser) {
    const role = String(user.role || '').toUpperCase();
    if (role !== 'SUPERADMIN' && role !== 'SUPER_ADMIN') throw new ForbiddenException('Super admin access required');
  }

  private assertResidentOrTenant(user: AuthUser) {
    const role = String(user.role || '').toUpperCase();
    if (!['RESIDENT', 'TENANT'].includes(role)) throw new ForbiddenException('Resident access required');
    if (!user.organizationId) throw new ForbiddenException('Organization context missing');
    return { organizationId: user.organizationId, userId: this.userId(user) };
  }

  private monthYearBounds(month?: string, year?: string) {
    const now = new Date();
    const m = month ? Number(month) : now.getMonth() + 1;
    const y = year ? Number(year) : now.getFullYear();
    const from = new Date(y, m - 1, 1);
    const to = new Date(y, m, 1);
    return { from, to, month: m, year: y };
  }

  private money(amount: number, currency = 'MDL') {
    return `${Number(amount || 0).toFixed(2)} ${currency}`;
  }

  private async organizationCurrency(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { defaultCurrency: true },
    });
    return String(org?.defaultCurrency || 'MDL');
  }

  async adminMonthly(user: AuthUser, query: MonthlyReportQueryDto) {
    const organizationId = this.assertAdmin(user);
    const { from, to, month, year } = this.monthYearBounds(query.month, query.year);
    const currency = await this.organizationCurrency(organizationId);

    const payments = await this.prisma.payment.findMany({
      where: { organizationId, createdAt: { gte: from, lt: to } },
      include: { apartment: { select: { id: true, number: true, areaM2: true, building: { select: { name: true } }, staircase: { select: { name: true } } } } },
    });

    const totalCharges = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const totalPayments = payments.filter((p) => p.status === 'CONFIRMED').reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const totalDebt = Math.max(totalCharges - totalPayments, 0);

    const byApartment = new Map<string, { apartment: any; charges: number; paid: number }>();
    for (const payment of payments) {
      const key = payment.apartmentId;
      const existing = byApartment.get(key) || { apartment: payment.apartment, charges: 0, paid: 0 };
      existing.charges += Number(payment.amount || 0);
      if (payment.status === 'CONFIRMED') existing.paid += Number(payment.amount || 0);
      byApartment.set(key, existing);
    }
    const debtRows = Array.from(byApartment.values()).map((row) => ({
      apartment: row.apartment,
      totalCharges: row.charges,
      totalPayments: row.paid,
      currentDebt: Math.max(row.charges - row.paid, 0),
    }));
    const unpaidApartmentsCount = debtRows.filter((row) => row.currentDebt > 0).length;
    const paidApartmentsCount = debtRows.filter((row) => row.currentDebt <= 0).length;
    const paymentsByMethod = payments
      .filter((p) => p.status === 'CONFIRMED')
      .reduce<Record<string, number>>((acc, p) => {
        acc[p.method] = (acc[p.method] || 0) + Number(p.amount || 0);
        return acc;
      }, {});
    const chargesByTariff = [{ tariffName: 'MONTHLY_ASSOCIATION_FEE', amount: totalCharges, currency }];
    const topDebtApartments = debtRows.sort((a, b) => b.currentDebt - a.currentDebt).slice(0, 10);

    return {
      period: { month, year, from, to },
      currency,
      totalCharges,
      totalPayments,
      totalDebt,
      unpaidApartmentsCount,
      paidApartmentsCount,
      paymentsByMethod: Object.entries(paymentsByMethod).map(([method, amount]) => ({ method, amount })),
      chargesByTariff,
      topDebtApartments: topDebtApartments.map((row) => ({
        apartmentNumber: row.apartment.number,
        building: row.apartment.building?.name || '-',
        staircase: row.apartment.staircase?.name || '-',
        areaM2: row.apartment.areaM2 || 0,
        currentDebt: row.currentDebt,
      })),
    };
  }

  async adminDebts(user: AuthUser, query: DebtsReportQueryDto) {
    const organizationId = this.assertAdmin(user);
    const apartments = await this.prisma.apartment.findMany({
      where: {
        organizationId,
        ...(query.buildingId ? { buildingId: query.buildingId } : {}),
        ...(query.staircaseId ? { staircaseId: query.staircaseId } : {}),
        ...(query.floor ? { floor: Number(query.floor) } : {}),
      },
      include: {
        building: { select: { name: true } },
        staircase: { select: { name: true } },
        residents: { where: { type: 'OWNER' }, include: { user: { select: { firstName: true, lastName: true, email: true } } } },
      },
    });
    const apartmentIds = apartments.map((a) => a.id);
    const payments = apartmentIds.length
      ? await this.prisma.payment.findMany({ where: { organizationId, apartmentId: { in: apartmentIds } } })
      : [];
    const paymentsMap = payments.reduce<Record<string, { charges: number; paid: number }>>((acc, p) => {
      const row = acc[p.apartmentId] || { charges: 0, paid: 0 };
      row.charges += Number(p.amount || 0);
      if (p.status === 'CONFIRMED') row.paid += Number(p.amount || 0);
      acc[p.apartmentId] = row;
      return acc;
    }, {});
    const rows = apartments.map((apartment) => {
      const totals = paymentsMap[apartment.id] || { charges: 0, paid: 0 };
      const debt = Math.max(totals.charges - totals.paid, 0);
      const owner = apartment.residents[0]?.user;
      return {
        apartmentId: apartment.id,
        apartmentNumber: apartment.number,
        building: apartment.building?.name || '-',
        staircase: apartment.staircase?.name || '-',
        floor: apartment.floor,
        ownerResident: owner ? `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || owner.email : '-',
        areaM2: apartment.areaM2 || 0,
        totalCharges: totals.charges,
        totalPayments: totals.paid,
        currentDebt: debt,
      };
    });
    const minDebt = query.minDebt ? Number(query.minDebt) : undefined;
    const maxDebt = query.maxDebt ? Number(query.maxDebt) : undefined;
    return rows.filter((r) => (minDebt === undefined || r.currentDebt >= minDebt) && (maxDebt === undefined || r.currentDebt <= maxDebt));
  }

  async adminPayments(user: AuthUser, query: PaymentsReportQueryDto) {
    const organizationId = this.assertAdmin(user);
    const from = query.from ? new Date(query.from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const to = query.to ? new Date(query.to) : new Date();
    return this.prisma.payment.findMany({
      where: { organizationId, createdAt: { gte: from, lte: to } },
      include: {
        apartment: {
          select: {
            number: true,
            building: { select: { name: true } },
            staircase: { select: { name: true } },
            residents: { where: { type: 'OWNER' }, include: { user: { select: { firstName: true, lastName: true, email: true } } }, take: 1 },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async adminCharges(user: AuthUser, query: MonthlyReportQueryDto) {
    const monthly = await this.adminMonthly(user, query);
    const debts = await this.adminDebts(user, {});
    return debts.map((row) => ({
      apartment: row.apartmentNumber,
      tariffName: 'MONTHLY_ASSOCIATION_FEE',
      amount: row.totalCharges,
      status: row.currentDebt > 0 ? 'UNPAID_PARTIAL' : 'PAID',
      currency: monthly.currency,
    }));
  }

  async residentStatement(user: AuthUser, query: ResidentStatementQueryDto) {
    const { organizationId, userId } = this.assertResidentOrTenant(user);
    const profiles = await this.prisma.residentProfile.findMany({
      where: { organizationId, userId },
      include: { apartment: { include: { building: true, staircase: true } } },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
    if (!profiles.length) throw new NotFoundException('No linked apartments');
    const apartmentId = query.apartmentId || profiles[0].apartmentId;
    const profile = profiles.find((p) => p.apartmentId === apartmentId);
    if (!profile) throw new ForbiddenException('Apartment is not linked to current user');

    const payments = await this.prisma.payment.findMany({
      where: { organizationId, apartmentId },
      orderBy: { createdAt: 'desc' },
    });
    const totalCharges = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const totalPayments = payments.filter((p) => p.status === 'CONFIRMED').reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const currentDebt = Math.max(totalCharges - totalPayments, 0);
    return {
      apartment: {
        id: profile.apartment.id,
        number: profile.apartment.number,
        floor: profile.apartment.floor,
        areaM2: profile.apartment.areaM2,
        building: profile.apartment.building?.name,
        staircase: profile.apartment.staircase?.name,
      },
      currentDebt,
      chargesHistory: payments.map((p) => ({ id: p.id, amount: p.amount, month: p.month, status: p.status, createdAt: p.createdAt })),
      paymentsHistory: payments
        .filter((p) => p.status === 'CONFIRMED')
        .map((p) => ({ id: p.id, amount: p.amount, method: p.method, note: p.note, month: p.month, createdAt: p.createdAt })),
    };
  }

  async superadminPlatform(user: AuthUser) {
    this.assertSuperadmin(user);
    const [
      totalOrganizations,
      activeOrganizations,
      trialOrganizations,
      pastDueOrganizations,
      suspendedOrganizations,
      totalApartments,
      expectedMonthlyRevenueAgg,
      paidInvoices,
      unpaidInvoices,
    ] = await Promise.all([
      this.prisma.organization.count(),
      this.prisma.organizationSubscription.count({ where: { status: OrganizationSubscriptionStatus.ACTIVE } }),
      this.prisma.organizationSubscription.count({ where: { status: OrganizationSubscriptionStatus.TRIAL } }),
      this.prisma.organizationSubscription.count({ where: { status: OrganizationSubscriptionStatus.PAST_DUE } }),
      this.prisma.organizationSubscription.count({ where: { status: OrganizationSubscriptionStatus.SUSPENDED } }),
      this.prisma.apartment.count(),
      this.prisma.organizationSubscription.aggregate({ _sum: { price: true } }),
      this.prisma.organizationInvoice.count({ where: { status: 'PAID' } }),
      this.prisma.organizationInvoice.count({ where: { status: { in: ['UNPAID', 'OVERDUE'] } } }),
    ]);
    return {
      totalOrganizations,
      activeOrganizations,
      trialOrganizations,
      pastDueOrganizations,
      suspendedOrganizations,
      totalApartmentsOnPlatform: totalApartments,
      expectedMonthlyRevenue: Number(expectedMonthlyRevenueAgg._sum.price || 0),
      paidInvoices,
      unpaidInvoices,
      currency: 'MDL',
    };
  }

  private async makePdf(
    title: string,
    organizationName: string,
    period: string,
    rows: Array<Record<string, any>>,
    organizationExtras?: { fiscalCode?: string | null; address?: string | null },
  ) {
    const doc = new PDFDocument({ margin: 36, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.fontSize(16).text(title, { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Organization: ${organizationName}`);
    if (organizationExtras?.fiscalCode) doc.text(`Fiscal code: ${organizationExtras.fiscalCode}`);
    if (organizationExtras?.address) doc.text(`Address: ${organizationExtras.address}`);
    doc.text(`Period: ${period}`);
    doc.text(`Generated at: ${new Date().toISOString()}`);
    doc.moveDown(1);
    rows.slice(0, 400).forEach((row) => {
      doc.fontSize(9).text(Object.entries(row).map(([k, v]) => `${k}: ${String(v)}`).join(' | '));
      doc.moveDown(0.3);
    });
    doc.end();
    await new Promise<void>((resolve) => doc.on('end', () => resolve()));
    return Buffer.concat(chunks);
  }

  private makeXlsx(sheetName: string, rows: Array<Record<string, any>>) {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    return XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }) as Buffer;
  }

  async exportAdminMonthlyPdf(user: AuthUser, query: MonthlyReportQueryDto) {
    const orgId = this.assertAdmin(user);
    const organization = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true, legalName: true, fiscalCode: true, address: true },
    });
    const monthly = await this.adminMonthly(user, query);
    const rows = monthly.topDebtApartments.map((r: any) => ({
      apartment: r.apartmentNumber,
      building: r.building,
      staircase: r.staircase,
      areaM2: r.areaM2,
      debt: this.money(r.currentDebt, monthly.currency),
    }));
    return this.makePdf(
      'Monthly Financial Report',
      organization?.legalName || organization?.name || '-',
      `${monthly.period.month}/${monthly.period.year}`,
      rows,
      { fiscalCode: organization?.fiscalCode, address: organization?.address },
    );
  }

  async exportAdminMonthlyXlsx(user: AuthUser, query: MonthlyReportQueryDto) {
    const monthly = await this.adminMonthly(user, query);
    const rows = monthly.topDebtApartments.map((r: any) => ({
      Apartment: r.apartmentNumber,
      Building: r.building,
      Staircase: r.staircase,
      AreaM2: r.areaM2,
      Debt: this.money(r.currentDebt, monthly.currency),
    }));
    return this.makeXlsx('Monthly', rows);
  }

  async exportAdminDebtsPdf(user: AuthUser, query: DebtsReportQueryDto) {
    const orgId = this.assertAdmin(user);
    const organization = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true, legalName: true, fiscalCode: true, address: true },
    });
    const rows = await this.adminDebts(user, query);
    return this.makePdf('Apartment Debt Report', organization?.legalName || organization?.name || '-', 'Filtered', rows, {
      fiscalCode: organization?.fiscalCode,
      address: organization?.address,
    });
  }

  async exportAdminDebtsXlsx(user: AuthUser, query: DebtsReportQueryDto) {
    const rows = await this.adminDebts(user, query);
    return this.makeXlsx('Debts', rows);
  }

  async exportAdminPaymentsXlsx(user: AuthUser, query: PaymentsReportQueryDto) {
    const payments = await this.adminPayments(user, query);
    const rows = payments.map((p) => ({
      PaymentDate: p.createdAt.toISOString(),
      Apartment: `#${p.apartment.number}`,
      Building: p.apartment.building?.name || '-',
      Staircase: p.apartment.staircase?.name || '-',
      Payer:
        p.apartment.residents[0]?.user
          ? `${p.apartment.residents[0].user.firstName || ''} ${p.apartment.residents[0].user.lastName || ''}`.trim() ||
            p.apartment.residents[0].user.email
          : '-',
      Amount: p.amount,
      Method: p.method,
      Note: p.note || '',
      Status: p.status,
      Month: p.month,
    }));
    return this.makeXlsx('Payments', rows);
  }

  async exportResidentStatementPdf(user: AuthUser, query: ResidentStatementQueryDto) {
    const statement = await this.residentStatement(user, query);
    const rows = [
      { apartment: statement.apartment.number, building: statement.apartment.building, staircase: statement.apartment.staircase, currentDebt: statement.currentDebt },
      ...statement.paymentsHistory.slice(0, 100).map((p) => ({ paymentMonth: p.month, amount: p.amount, method: p.method, date: p.createdAt.toISOString() })),
    ];
    return this.makePdf('Resident Statement', `Apartment #${statement.apartment.number}`, 'Current', rows);
  }

  async exportSuperadminPlatformXlsx(user: AuthUser) {
    const report = await this.superadminPlatform(user);
    return this.makeXlsx('Platform', [report]);
  }
}
