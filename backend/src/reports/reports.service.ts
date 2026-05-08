import { BadRequestException, Injectable } from '@nestjs/common';
import { ApartmentResidentRole, InvoiceStatus, PaymentMethod, PaymentStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { MvpUser } from '../security/mvp-auth.guard';

type ReportQuery = Record<string, unknown>;

type MoneyInvoice = {
  id: string;
  apartmentId: string | null;
  month: number | null;
  year: number | null;
  amount: number | null;
  finalAmount: number | null;
  status: InvoiceStatus;
  dueDate: Date;
  issuedAt?: Date | null;
  createdAt?: Date | null;
};

type MoneyPayment = {
  id: string;
  apartmentId: string;
  amount: number;
  status: PaymentStatus;
  method: PaymentMethod;
  note: string | null;
  month: string;
  paidAt: Date | null;
  confirmedAt: Date | null;
  createdAt: Date;
};

type CsvColumn = {
  key: string;
  label: string;
};

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async adminDebts(user: MvpUser, query: ReportQuery = {}) {
    const organizationId = this.resolveOrganizationId(user, query);
    const rows = await this.buildDebtRows(organizationId, query);
    const filteredRows = this.filterDebtRows(rows, query);

    return {
      summary: {
        totalDebt: this.money(filteredRows.reduce((sum, row) => sum + row.totalDebt, 0)),
        totalInvoiced: this.money(filteredRows.reduce((sum, row) => sum + row.totalInvoiced, 0)),
        totalPaid: this.money(filteredRows.reduce((sum, row) => sum + row.totalPaid, 0)),
        apartmentsWithDebt: filteredRows.filter((row) => row.totalDebt > 0).length,
        overdueApartments: filteredRows.filter((row) => row.overdueInvoicesCount > 0).length,
        rowsCount: filteredRows.length,
        currency: 'MDL',
      },
      rows: filteredRows,
    };
  }

  async adminPayments(user: MvpUser, query: ReportQuery = {}) {
    const organizationId = this.resolveOrganizationId(user, query);
    const where = this.paymentWhere(organizationId, query);
    const rows = await this.prisma.payment.findMany({
      where,
      orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        apartment: {
          select: {
            id: true,
            number: true,
            floor: true,
            building: { select: { id: true, name: true } },
            staircase: { select: { id: true, name: true } },
            apartmentResidents: {
              where: { role: ApartmentResidentRole.OWNER },
              take: 1,
              include: { resident: { select: this.residentSelect() } },
            },
          },
        },
        invoice: { select: { id: true, invoiceNumber: true, month: true, year: true, totalDue: true, status: true } },
      },
    });

    const mappedRows = rows.map((payment) => ({
      id: payment.id,
      apartmentId: payment.apartmentId,
      apartmentNumber: payment.apartment?.number || '-',
      staircase: payment.apartment?.staircase?.name || '-',
      building: payment.apartment?.building?.name || '-',
      residentName: this.residentName(payment.apartment?.apartmentResidents?.[0]?.resident),
      amount: this.money(payment.amount),
      method: payment.method,
      methodLabel: this.paymentMethodLabel(payment.method),
      status: payment.status,
      paidAt: payment.paidAt || payment.confirmedAt || payment.createdAt,
      createdAt: payment.createdAt,
      invoiceMonth: payment.invoice?.month ?? this.monthFromPaymentMonth(payment.month),
      invoiceYear: payment.invoice?.year ?? this.yearFromPaymentMonth(payment.month),
      invoiceNumber: payment.invoice?.invoiceNumber ?? this.invoiceIdFromNote(payment.note),
      note: payment.note,
    }));

    return {
      summary: {
        totalPaid: this.money(mappedRows.filter((row) => row.status === PaymentStatus.CONFIRMED).reduce((sum, row) => sum + row.amount, 0)),
        paymentsCount: mappedRows.length,
        currency: 'MDL',
      },
      rows: mappedRows,
    };
  }

  async adminMonthly(user: MvpUser, query: ReportQuery = {}) {
    const organizationId = this.resolveOrganizationId(user, query);
    const { month, year } = this.parseMonthYear(query);
    const invoices = await this.prisma.invoice.findMany({
      where: { organizationId, month, year },
      orderBy: [{ issuedAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        apartment: {
          select: {
            id: true,
            number: true,
            building: { select: { id: true, name: true } },
            staircase: { select: { id: true, name: true } },
          },
        },
      },
    });
    const payments = invoices.length
      ? await this.prisma.payment.findMany({
          where: {
            organizationId,
            status: PaymentStatus.CONFIRMED,
            OR: invoices.map((invoice) => ({ note: this.invoicePaymentNote(invoice.id) })),
          },
        })
      : [];

    const rows = invoices.map((invoice) => {
      const linkedPayments = payments.filter((payment) => payment.note === this.invoicePaymentNote(invoice.id));
      return this.toInvoiceReportRow(invoice, linkedPayments);
    });
    const totalIssued = this.money(rows.reduce((sum, row) => sum + row.amount, 0));
    const totalPaid = this.money(rows.reduce((sum, row) => sum + row.paidAmount, 0));
    const totalDebt = this.money(rows.reduce((sum, row) => sum + row.remainingAmount, 0));

    return {
      month,
      year,
      summary: {
        totalIssued,
        totalPaid,
        totalDebt,
        invoicesCount: rows.length,
        paidCount: rows.filter((row) => row.status === InvoiceStatus.PAID).length,
        unpaidCount: rows.filter((row) => row.status === InvoiceStatus.UNPAID).length,
        overdueCount: rows.filter((row) => row.status === InvoiceStatus.OVERDUE).length,
        collectionRate: totalIssued > 0 ? this.money((totalPaid / totalIssued) * 100) : 0,
        currency: 'MDL',
      },
      rows,
      invoices: rows,
    };
  }

  async adminApartments(user: MvpUser, query: ReportQuery = {}) {
    const organizationId = this.resolveOrganizationId(user, query);
    const rows = await this.buildDebtRows(organizationId, query);
    const search = this.optionalString(query.search).toLowerCase();
    const filteredRows = search
      ? rows.filter((row) => `${row.apartmentNumber} ${row.staircase} ${row.ownerResident}`.toLowerCase().includes(search))
      : rows;

    return {
      summary: {
        apartmentsCount: filteredRows.length,
        totalAreaM2: this.money(filteredRows.reduce((sum, row) => sum + row.areaM2, 0)),
        totalDebt: this.money(filteredRows.reduce((sum, row) => sum + row.totalDebt, 0)),
        currency: 'MDL',
      },
      rows: filteredRows.map((row) => ({
        apartmentId: row.apartmentId,
        apartmentNumber: row.apartmentNumber,
        staircase: row.staircase,
        building: row.building,
        floor: row.floor,
        areaM2: row.areaM2,
        rooms: row.rooms,
        status: row.apartmentStatus,
        residentsCount: row.residentsCount,
        ownerName: row.ownerResident,
        metersCount: row.metersCount,
        totalDebt: row.totalDebt,
      })),
    };
  }

  async adminCharges(user: MvpUser, query: ReportQuery = {}) {
    const organizationId = this.resolveOrganizationId(user, query);
    const { month, year } = this.parseMonthYear(query);
    const charges = await this.prisma.monthlyCharge.findMany({
      where: { organizationId, month, year },
      orderBy: [{ apartment: { number: 'asc' } }, { tariffName: 'asc' }],
      include: {
        apartment: {
          select: {
            id: true,
            number: true,
            staircase: { select: { id: true, name: true } },
            building: { select: { id: true, name: true } },
          },
        },
      },
    });

    return charges.map((charge) => ({
      id: charge.id,
      apartment: charge.apartment?.number || '-',
      apartmentId: charge.apartmentId,
      staircase: charge.apartment?.staircase?.name || '-',
      building: charge.apartment?.building?.name || '-',
      tariffName: charge.tariffName,
      amount: this.money(charge.amount),
      status: String(charge.status || '').toUpperCase() === 'PAID' ? 'PAID' : 'UNPAID_PARTIAL',
      currency: 'MDL',
      month: charge.month,
      year: charge.year,
    }));
  }

  async adminResidents(user: MvpUser, query: ReportQuery = {}) {
    const organizationId = this.resolveOrganizationId(user, query);
    const search = this.optionalString(query.search).toLowerCase();
    const residents = await this.prisma.residentProfile.findMany({
      where: {
        organizationId,
        ...(search
          ? {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      include: {
        apartmentResidents: {
          include: {
            apartment: {
              select: {
                id: true,
                number: true,
                building: { select: { id: true, name: true } },
                staircase: { select: { id: true, name: true } },
              },
            },
          },
        },
        apartment: {
          select: {
            id: true,
            number: true,
            building: { select: { id: true, name: true } },
            staircase: { select: { id: true, name: true } },
          },
        },
      },
    });
    const debtRows = await this.buildDebtRows(organizationId, {});
    const debtByApartmentId = new Map(debtRows.map((row) => [row.apartmentId, row.totalDebt]));
    const rows = residents.map((resident) => {
      const relations = resident.apartmentResidents.length
        ? resident.apartmentResidents
        : resident.apartment
          ? [{ role: resident.type as unknown as ApartmentResidentRole, apartment: resident.apartment }]
          : [];
      const apartmentIds = Array.from(new Set(relations.map((relation) => relation.apartment?.id).filter(Boolean))) as string[];
      return {
        residentId: resident.id,
        fullName: this.residentName(resident),
        phone: resident.phone,
        email: resident.email,
        accountStatus: resident.accountStatus,
        apartments: relations
          .map((relation) => relation.apartment)
          .filter(Boolean)
          .map((apartment) => ({
            id: apartment.id,
            number: apartment.number,
            building: apartment.building?.name || '-',
            staircase: apartment.staircase?.name || '-',
          })),
        role: relations[0]?.role || resident.type,
        totalDebt: this.money(apartmentIds.reduce((sum, apartmentId) => sum + Number(debtByApartmentId.get(apartmentId) || 0), 0)),
      };
    });

    return {
      summary: {
        residentsCount: rows.length,
        withAccounts: rows.filter((row) => row.accountStatus === 'CREATED').length,
        totalDebt: this.money(rows.reduce((sum, row) => sum + row.totalDebt, 0)),
        currency: 'MDL',
      },
      rows,
    };
  }

  async adminDebtsCsv(user: MvpUser, query: ReportQuery = {}) {
    const report = await this.adminDebts(user, query);
    return this.toCsv(report.rows, [
      { key: 'apartmentNumber', label: 'Apartament' },
      { key: 'staircase', label: 'Scara' },
      { key: 'ownerResident', label: 'Locatar' },
      { key: 'totalInvoiced', label: 'Total facturat' },
      { key: 'totalPaid', label: 'Total achitat' },
      { key: 'totalDebt', label: 'Datorie' },
      { key: 'unpaidInvoicesCount', label: 'Facturi neachitate' },
      { key: 'overdueInvoicesCount', label: 'Facturi întârziate' },
      { key: 'lastPaymentDate', label: 'Ultima plată' },
      { key: 'financialStatus', label: 'Status' },
    ]);
  }

  async adminPaymentsCsv(user: MvpUser, query: ReportQuery = {}) {
    const report = await this.adminPayments(user, query);
    return this.toCsv(report.rows, [
      { key: 'paidAt', label: 'Data' },
      { key: 'apartmentNumber', label: 'Apartament' },
      { key: 'staircase', label: 'Scara' },
      { key: 'residentName', label: 'Locatar' },
      { key: 'amount', label: 'Suma' },
      { key: 'methodLabel', label: 'Metodă' },
      { key: 'invoiceNumber', label: 'Factură' },
    ]);
  }

  async adminMonthlyCsv(user: MvpUser, query: ReportQuery = {}) {
    const report = await this.adminMonthly(user, query);
    return this.toCsv(report.rows, [
      { key: 'apartmentNumber', label: 'Apartament' },
      { key: 'staircase', label: 'Scara' },
      { key: 'month', label: 'Luna' },
      { key: 'year', label: 'Anul' },
      { key: 'amount', label: 'Suma' },
      { key: 'paidAmount', label: 'Achitat' },
      { key: 'remainingAmount', label: 'Datorie' },
      { key: 'dueDate', label: 'Data scadentă' },
      { key: 'statusLabel', label: 'Status' },
    ]);
  }

  async adminApartmentsCsv(user: MvpUser, query: ReportQuery = {}) {
    const report = await this.adminApartments(user, query);
    return this.toCsv(report.rows, [
      { key: 'apartmentNumber', label: 'Apartament' },
      { key: 'staircase', label: 'Scara' },
      { key: 'floor', label: 'Etaj' },
      { key: 'areaM2', label: 'Suprafață m²' },
      { key: 'rooms', label: 'Camere' },
      { key: 'status', label: 'Status' },
      { key: 'residentsCount', label: 'Locatari' },
      { key: 'ownerName', label: 'Proprietar' },
      { key: 'metersCount', label: 'Contoare' },
      { key: 'totalDebt', label: 'Datorie' },
    ]);
  }

  async adminResidentsCsv(user: MvpUser, query: ReportQuery = {}) {
    const report = await this.adminResidents(user, query);
    const rows = report.rows.map((row) => ({
      ...row,
      apartmentsText: row.apartments.map((apartment) => `${apartment.staircase} / ${apartment.number}`).join('; '),
    }));
    return this.toCsv(rows, [
      { key: 'fullName', label: 'Locatar' },
      { key: 'phone', label: 'Telefon' },
      { key: 'email', label: 'Email' },
      { key: 'accountStatus', label: 'Status cont' },
      { key: 'apartmentsText', label: 'Apartamente' },
      { key: 'role', label: 'Rol' },
      { key: 'totalDebt', label: 'Datorie' },
    ]);
  }

  private async buildDebtRows(organizationId: string, query: ReportQuery) {
    const where: Prisma.ApartmentWhereInput = {
      organizationId,
      ...(this.optionalString(query.buildingId) ? { buildingId: this.optionalString(query.buildingId) } : {}),
      ...(this.optionalString(query.staircaseId) ? { staircaseId: this.optionalString(query.staircaseId) } : {}),
      ...(query.floor !== undefined && query.floor !== '' ? { floor: Number(query.floor) } : {}),
    };
    const apartments = await this.prisma.apartment.findMany({
      where,
      orderBy: [{ staircase: { name: 'asc' } }, { number: 'asc' }],
      include: {
        building: { select: { id: true, name: true } },
        staircase: { select: { id: true, name: true } },
        apartmentResidents: {
          include: { resident: { select: this.residentSelect() } },
        },
        ownerResident: { select: this.residentSelect() },
        _count: { select: { apartmentResidents: true, meters: true } },
      },
    });
    const apartmentIds = apartments.map((apartment) => apartment.id);
    const [invoices, payments] = apartmentIds.length
      ? await Promise.all([
          this.prisma.invoice.findMany({ where: { organizationId, apartmentId: { in: apartmentIds } } }),
          this.prisma.payment.findMany({ where: { organizationId, apartmentId: { in: apartmentIds }, status: PaymentStatus.CONFIRMED } }),
        ])
      : [[], []];
    const invoicesByApartment = this.groupBy(invoices, (invoice) => invoice.apartmentId || '');
    const paymentsByApartment = this.groupBy(payments, (payment) => payment.apartmentId);

    return apartments.map((apartment) => {
      const apartmentInvoices = invoicesByApartment.get(apartment.id) || [];
      const apartmentPayments = paymentsByApartment.get(apartment.id) || [];
      const totalInvoiced = this.money(apartmentInvoices.reduce((sum, invoice) => sum + this.invoiceAmount(invoice), 0));
      const totalPaid = this.money(apartmentPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0));
      const invoiceStatusRows = apartmentInvoices.map((invoice) =>
        this.invoiceStatus(invoice, apartmentPayments.filter((payment) => payment.note === this.invoicePaymentNote(invoice.id))),
      );
      const owner = this.ownerForApartment(apartment);
      const totalDebt = this.money(Math.max(totalInvoiced - totalPaid, 0));
      const overdueInvoicesCount = invoiceStatusRows.filter((status) => status === InvoiceStatus.OVERDUE).length;
      return {
        apartmentId: apartment.id,
        apartmentNumber: apartment.number,
        building: apartment.building?.name || '-',
        staircase: apartment.staircase?.name || '-',
        floor: apartment.floor,
        areaM2: Number(apartment.areaM2 || 0),
        rooms: apartment.rooms,
        apartmentStatus: apartment.status,
        ownerResident: this.residentName(owner),
        residentsCount: apartment._count.apartmentResidents,
        metersCount: apartment._count.meters,
        totalInvoiced,
        totalPaid,
        totalDebt,
        currentDebt: totalDebt,
        unpaidInvoicesCount: invoiceStatusRows.filter((status) => status !== InvoiceStatus.PAID).length,
        overdueInvoicesCount,
        lastPaymentDate: this.latestDate(apartmentPayments.map((payment) => payment.paidAt || payment.confirmedAt || payment.createdAt)),
        lastInvoiceMonth: this.lastInvoiceMonth(apartmentInvoices),
        financialStatus: overdueInvoicesCount > 0 ? 'Întârziat' : totalDebt > 0 ? 'Datornic' : 'Achitat',
      };
    });
  }

  private filterDebtRows(rows: any[], query: ReportQuery) {
    const minDebt = query.minDebt !== undefined && query.minDebt !== '' ? Number(query.minDebt) : null;
    const onlyOverdue = this.booleanParam(query.onlyOverdue);
    const search = this.optionalString(query.search).toLowerCase();
    return rows.filter((row) => {
      if (Number.isFinite(minDebt) && row.totalDebt < Number(minDebt)) return false;
      if (onlyOverdue && row.overdueInvoicesCount <= 0) return false;
      if (search && !`${row.apartmentNumber} ${row.staircase} ${row.ownerResident}`.toLowerCase().includes(search)) return false;
      return true;
    });
  }

  private paymentWhere(organizationId: string, query: ReportQuery): Prisma.PaymentWhereInput {
    const from = this.optionalDate(query.from);
    const to = this.optionalDate(query.to);
    const where: Prisma.PaymentWhereInput = {
      organizationId,
      ...(this.optionalString(query.method) ? { method: this.optionalString(query.method) as PaymentMethod } : {}),
      ...(this.optionalString(query.apartmentId) ? { apartmentId: this.optionalString(query.apartmentId) } : {}),
      ...(this.optionalString(query.staircaseId) ? { apartment: { staircaseId: this.optionalString(query.staircaseId) } } : {}),
    };
    if (from || to) {
      const dateFilter: Prisma.DateTimeFilter = {};
      if (from) dateFilter.gte = from;
      if (to) dateFilter.lte = this.endOfDay(to);
      where.OR = [{ paidAt: dateFilter }, { paidAt: null, createdAt: dateFilter }];
    }
    return where;
  }

  private toInvoiceReportRow(invoice: MoneyInvoice & { apartment?: any }, payments: MoneyPayment[]) {
    const amount = this.invoiceAmount(invoice);
    const paidAmount = this.money(payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0));
    const remainingAmount = this.money(Math.max(amount - paidAmount, 0));
    const status = this.invoiceStatus(invoice, payments);
    return {
      id: invoice.id,
      invoiceId: invoice.id,
      apartmentId: invoice.apartmentId,
      apartmentNumber: invoice.apartment?.number || '-',
      building: invoice.apartment?.building?.name || '-',
      staircase: invoice.apartment?.staircase?.name || '-',
      month: invoice.month,
      year: invoice.year,
      amount,
      paidAmount,
      remainingAmount,
      status,
      statusLabel: this.invoiceStatusLabel(status),
      dueDate: invoice.dueDate,
      issuedAt: invoice.issuedAt || invoice.createdAt,
    };
  }

  private invoiceStatus(invoice: MoneyInvoice, payments: MoneyPayment[] = []) {
    const amount = this.invoiceAmount(invoice);
    const paidAmount = this.money(payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0));
    if (invoice.status === InvoiceStatus.PAID || paidAmount >= amount) return InvoiceStatus.PAID;
    if (invoice.dueDate && new Date(invoice.dueDate) < new Date()) return InvoiceStatus.OVERDUE;
    return InvoiceStatus.UNPAID;
  }

  private invoiceAmount(invoice: Pick<MoneyInvoice, 'amount' | 'finalAmount'>) {
    return this.money(Number(invoice.finalAmount || invoice.amount || 0));
  }

  private invoicePaymentNote(invoiceId: string) {
    return `Invoice ${invoiceId}`;
  }

  private invoiceIdFromNote(note?: string | null) {
    if (!note) return null;
    return note.startsWith('Invoice ') ? note.slice('Invoice '.length) : null;
  }

  private resolveOrganizationId(user: MvpUser, query: ReportQuery) {
    if (String(user.role).toUpperCase() !== Role.SUPERADMIN) return user.organizationId;
    return this.optionalString(query.organizationId) || user.organizationId;
  }

  private residentSelect() {
    return {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      accountStatus: true,
      type: true,
    } satisfies Prisma.ResidentProfileSelect;
  }

  private ownerForApartment(apartment: any) {
    if (apartment.ownerResident) return apartment.ownerResident;
    const ownerRelation =
      apartment.apartmentResidents?.find((relation: any) => relation.role === ApartmentResidentRole.OWNER && relation.isPrimary) ||
      apartment.apartmentResidents?.find((relation: any) => relation.role === ApartmentResidentRole.OWNER) ||
      apartment.apartmentResidents?.find((relation: any) => relation.isPrimary) ||
      apartment.apartmentResidents?.[0];
    return ownerRelation?.resident || null;
  }

  private residentName(resident?: { firstName?: string | null; lastName?: string | null; email?: string | null } | null) {
    if (!resident) return '-';
    return `${resident.firstName || ''} ${resident.lastName || ''}`.trim() || resident.email || '-';
  }

  private latestDate(dates: Array<Date | null | undefined>) {
    const timestamps = dates.map((date) => (date ? new Date(date).getTime() : 0)).filter(Boolean);
    if (!timestamps.length) return null;
    return new Date(Math.max(...timestamps)).toISOString();
  }

  private lastInvoiceMonth(invoices: MoneyInvoice[]) {
    const sorted = invoices
      .filter((invoice) => invoice.month && invoice.year)
      .sort((a, b) => Number(b.year) - Number(a.year) || Number(b.month) - Number(a.month));
    const first = sorted[0];
    return first ? `${String(first.month).padStart(2, '0')}.${first.year}` : null;
  }

  private parseMonthYear(query: ReportQuery) {
    const now = new Date();
    const month = query.month !== undefined && query.month !== '' ? Number(query.month) : now.getMonth() + 1;
    const year = query.year !== undefined && query.year !== '' ? Number(query.year) : now.getFullYear();
    if (!Number.isInteger(month) || month < 1 || month > 12) throw new BadRequestException('Luna nu este validă.');
    if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new BadRequestException('Anul nu este valid.');
    return { month, year };
  }

  private paymentMethodLabel(method: PaymentMethod) {
    const labels: Record<string, string> = {
      CASH: 'Numerar',
      BANK: 'Transfer bancar',
      BANK_TRANSFER: 'Transfer bancar',
      CARD: 'Card',
      ONLINE: 'Online',
    };
    return labels[method] || 'Altă metodă';
  }

  private invoiceStatusLabel(status: InvoiceStatus) {
    return status === InvoiceStatus.PAID ? 'Achitat' : status === InvoiceStatus.OVERDUE ? 'Întârziat' : 'Neachitat';
  }

  private monthFromPaymentMonth(month?: string | null) {
    const match = String(month || '').match(/^(\d{4})-(\d{2})$/);
    return match ? Number(match[2]) : null;
  }

  private yearFromPaymentMonth(month?: string | null) {
    const match = String(month || '').match(/^(\d{4})-(\d{2})$/);
    return match ? Number(match[1]) : null;
  }

  private optionalString(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : '';
  }

  private optionalDate(value: unknown) {
    if (typeof value !== 'string' || !value.trim()) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private endOfDay(date: Date) {
    const next = new Date(date);
    next.setHours(23, 59, 59, 999);
    return next;
  }

  private booleanParam(value: unknown) {
    return value === true || value === 'true' || value === '1' || value === 1;
  }

  private money(value: number) {
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
  }

  private groupBy<T>(items: T[], getKey: (item: T) => string) {
    const map = new Map<string, T[]>();
    for (const item of items) {
      const key = getKey(item);
      if (!key) continue;
      map.set(key, [...(map.get(key) || []), item]);
    }
    return map;
  }

  private toCsv(rows: Array<Record<string, any>>, columns: CsvColumn[]) {
    const header = columns.map((column) => this.csvCell(column.label)).join(',');
    const body = rows.map((row) => columns.map((column) => this.csvCell(this.csvValue(row[column.key]))).join(','));
    return `\ufeff${[header, ...body].join('\n')}`;
  }

  private csvValue(value: unknown) {
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.join('; ');
    if (value === null || value === undefined) return '';
    return String(value);
  }

  private csvCell(value: unknown) {
    const text = this.csvValue(value).replace(/"/g, '""');
    return /[",\n\r]/.test(text) ? `"${text}"` : text;
  }
}
