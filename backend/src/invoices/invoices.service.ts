import { ForbiddenException, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { AuditService } from '../audit/audit.service';
import { EmailTemplateService } from '../email/email-template.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { SaasLimitEnforcementService } from '../saas-usage/saas-limit-enforcement.service';
import { GenerateMonthlyInvoicesDto, InvoicesFilterDto, SendRemindersDto } from './dto/invoices.dto';
import { buildPaginationMeta, resolvePagination } from '../common/pagination';

type AuthUser = { id?: string; sub?: string; role?: string; organizationId?: string | null };

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly emailTemplateService: EmailTemplateService,
    private readonly saasLimits: SaasLimitEnforcementService,
  ) {}

  private userId(user: AuthUser) {
    return user.id || user.sub || '';
  }

  private assertAdmin(user: AuthUser) {
    if (String(user.role || '').toUpperCase() !== 'ADMIN') throw new ForbiddenException('Admin access required');
    if (!user.organizationId) throw new ForbiddenException('Organization context missing');
    return { organizationId: user.organizationId, userId: this.userId(user) };
  }

  private assertResidentOrTenant(user: AuthUser) {
    const role = String(user.role || '').toUpperCase();
    if (!['RESIDENT', 'RESIDENT'].includes(role)) throw new ForbiddenException('Resident access required');
    if (!user.organizationId) throw new ForbiddenException('Organization context missing');
    return { organizationId: user.organizationId, userId: this.userId(user) };
  }

  private assertSuperadmin(user: AuthUser) {
    const role = String(user.role || '').toUpperCase();
    if (!['SUPERADMIN', 'SUPER_ADMIN'].includes(role)) throw new ForbiddenException('Super admin access required');
  }

  private invoiceNumber(prefix: string | null | undefined, organizationId: string, apartmentNumber: string, month: number, year: number) {
    const safePrefix = (prefix || 'INV').trim().toUpperCase();
    return `${safePrefix}-${year}${String(month).padStart(2, '0')}-${organizationId.slice(0, 4).toUpperCase()}-${apartmentNumber}`;
  }

  private async calcInvoice(organizationId: string, apartmentId: string, month: number, year: number) {
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    const prevPayments = await this.prisma.payment.findMany({
      where: { organizationId, apartmentId, month: { lt: monthKey } },
    });
    const prevCharges = prevPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const prevPaid = prevPayments.filter((p) => p.status === 'CONFIRMED').reduce((s, p) => s + Number(p.amount || 0), 0);
    const initialBalance = await this.prisma.initialBalance.findUnique({
      where: { organizationId_apartmentId: { organizationId, apartmentId } },
    });
    const previousDebt = Math.max(prevCharges - prevPaid + Number(initialBalance?.initialDebt || 0) - Number(initialBalance?.initialAdvancePayment || 0), 0);

    const charges = await this.prisma.monthlyCharge.findMany({
      where: { organizationId, apartmentId, month, year },
    });
    const currentCharges = charges.reduce((s, c) => s + Number(c.amount || 0), 0);

    const monthPayments = await this.prisma.payment.findMany({
      where: { organizationId, apartmentId, month: monthKey, status: 'CONFIRMED' },
    });
    const paymentsAmount = monthPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const totalDue = Math.max(previousDebt + currentCharges - paymentsAmount, 0);
    return { previousDebt, currentCharges, paymentsAmount, totalDue };
  }

  async generateMonthly(user: AuthUser, dto: GenerateMonthlyInvoicesDto) {
    const { organizationId, userId } = this.assertAdmin(user);
    await this.saasLimits.assertCanFinalizeInvoices(organizationId, `${dto.year}-${String(dto.month).padStart(2, '0')}`, 1, user);
    if (dto.month < 1 || dto.month > 12 || dto.year < 2000 || dto.year > 2100) {
      throw new BadRequestException('Invalid billing period');
    }
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { invoicePrefix: true },
    });
    const apartments = await this.prisma.apartment.findMany({
      where: { organizationId },
      include: { building: true, staircase: true },
    });
    const created: any[] = [];
    for (const apartment of apartments) {
      const calculated = await this.calcInvoice(organizationId, apartment.id, dto.month, dto.year);
      if (calculated.previousDebt < 0 || calculated.currentCharges < 0 || calculated.paymentsAmount < 0 || calculated.totalDue < 0) {
        throw new BadRequestException('Calculated invoice values must be non-negative');
      }
      const invoice = await this.prisma.residentInvoice.upsert({
        where: { organizationId_apartmentId_month_year: { organizationId, apartmentId: apartment.id, month: dto.month, year: dto.year } },
        create: {
          organizationId,
          apartmentId: apartment.id,
          month: dto.month,
          year: dto.year,
          invoiceNumber: this.invoiceNumber(organization?.invoicePrefix, organizationId, apartment.number, dto.month, dto.year),
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          ...calculated,
        },
        update: {
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          ...calculated,
          status: calculated.totalDue <= 0 ? 'PAID' : 'DRAFT',
        },
      });
      created.push(invoice);
    }
    await this.auditService.logAction({
      userId,
      organizationId,
      action: 'GENERATE_MONTHLY_CHARGES',
      entityType: 'INVOICE',
      description: `Generated monthly invoices for ${dto.month}/${dto.year}`,
      newValuesJson: { count: created.length, month: dto.month, year: dto.year },
    });
    return { count: created.length };
  }

  async adminList(user: AuthUser, query: InvoicesFilterDto) {
    const { organizationId } = this.assertAdmin(user);
    const where = {
        organizationId,
        ...(query.month ? { month: query.month } : {}),
        ...(query.year ? { year: query.year } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.buildingId || query.staircaseId
          ? { apartment: { ...(query.buildingId ? { buildingId: query.buildingId } : {}), ...(query.staircaseId ? { staircaseId: query.staircaseId } : {}) } }
          : {}),
      };
    const usePagination = query.page !== undefined || query.limit !== undefined;
    const { page, limit, skip } = resolvePagination(query, 20, 100);
    const [rows, total] = await Promise.all([
      this.prisma.residentInvoice.findMany({
      where,
      include: {
        apartment: {
          select: { id: true, number: true, building: { select: { name: true } }, staircase: { select: { name: true } } },
        },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { createdAt: 'desc' }],
      ...(usePagination ? { skip, take: limit } : {}),
    }),
      this.prisma.residentInvoice.count({ where }),
    ]);
    if (!usePagination) return rows;
    return { data: rows, ...buildPaginationMeta(page, limit, total) };
  }

  async adminGetOne(user: AuthUser, id: string) {
    const { organizationId } = this.assertAdmin(user);
    const invoice = await this.prisma.residentInvoice.findFirst({
      where: { id, organizationId },
      include: {
        apartment: { include: { building: true, staircase: true } },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    const monthKey = `${invoice.year}-${String(invoice.month).padStart(2, '0')}`;
    const charges = await this.prisma.monthlyCharge.findMany({ where: { organizationId, apartmentId: invoice.apartmentId, month: invoice.month, year: invoice.year } });
    const payments = await this.prisma.payment.findMany({ where: { organizationId, apartmentId: invoice.apartmentId, month: monthKey }, orderBy: { createdAt: 'desc' } });
    return { ...invoice, charges, payments };
  }

  async issueInvoice(user: AuthUser, id: string) {
    const { organizationId, userId } = this.assertAdmin(user);
    const invoice = await this.prisma.residentInvoice.findFirst({ where: { id, organizationId } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    const updated = await this.prisma.residentInvoice.update({
      where: { id },
      data: { status: invoice.totalDue <= 0 ? 'PAID' : 'ISSUED', issuedAt: new Date() },
    });
    const residents = await this.prisma.residentProfile.findMany({
      where: { organizationId, apartmentId: invoice.apartmentId },
      select: { userId: true },
      distinct: ['userId'],
    });
    if (residents.length) {
      await this.notificationsService.notifyUsers({
        organizationId,
        userIds: residents.map((r) => r.userId),
        type: 'INVOICE' as any,
        title: `Factura emisa ${invoice.month}/${invoice.year}`,
        message: `Factura ${invoice.invoiceNumber} a fost emisa.`,
        link: `/resident/invoices/${invoice.id}`,
      });
      const users = await this.prisma.user.findMany({
        where: { id: { in: residents.map((r) => r.userId) }, deletedAt: null, isActive: true },
        select: { id: true, email: true, firstName: true },
      });
      const organization = await this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { name: true },
      });
      const apartment = await this.prisma.apartment.findUnique({
        where: { id: invoice.apartmentId },
        select: { number: true },
      });
      for (const resident of users) {
        await this.emailTemplateService.sendTemplateEmail({
          to: resident.email,
          key: 'invoice_issued',
          targetRole: 'RESIDENT',
          variables: {
            userName: resident.firstName || resident.email,
            organizationName: organization?.name || 'Espace',
            apartmentNumber: apartment?.number || '-',
            supportEmail: process.env.SUPPORT_EMAIL || 'support@espace.md',
          },
          inAppFallback: async () => {
            await this.notificationsService.createNotification({
              organizationId,
              userId: resident.id,
              type: 'INVOICE' as any,
              title: `Factura emisa ${invoice.month}/${invoice.year}`,
              message: `Factura ${invoice.invoiceNumber} a fost emisa.`,
              link: `/resident/invoices/${invoice.id}`,
            });
          },
        });
      }
    }
    await this.auditService.logUpdate(
      { userId, organizationId },
      'INVOICE',
      updated.id,
      invoice,
      updated,
      `Issued invoice ${updated.invoiceNumber}`,
    );
    return updated;
  }

  async regenerateInvoice(user: AuthUser, id: string) {
    const { organizationId, userId } = this.assertAdmin(user);
    const invoice = await this.prisma.residentInvoice.findFirst({ where: { id, organizationId } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    const calculated = await this.calcInvoice(organizationId, invoice.apartmentId, invoice.month, invoice.year);
    const updated = await this.prisma.residentInvoice.update({
      where: { id },
      data: {
        ...calculated,
        status: calculated.totalDue <= 0 ? 'PAID' : invoice.status === 'CANCELLED' ? 'CANCELLED' : 'DRAFT',
      },
    });
    await this.auditService.logUpdate(
      { userId, organizationId },
      'INVOICE',
      updated.id,
      invoice,
      updated,
      `Regenerated invoice ${updated.invoiceNumber}`,
    );
    return updated;
  }

  private async pdfForInvoice(invoiceId: string) {
    const invoice = await this.prisma.residentInvoice.findUnique({
      where: { id: invoiceId },
      include: {
        organization: true,
        apartment: { include: { building: true, staircase: true } },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    const charges = await this.prisma.monthlyCharge.findMany({
      where: { organizationId: invoice.organizationId, apartmentId: invoice.apartmentId, month: invoice.month, year: invoice.year },
    });
    const monthKey = `${invoice.year}-${String(invoice.month).padStart(2, '0')}`;
    const payments = await this.prisma.payment.findMany({
      where: { organizationId: invoice.organizationId, apartmentId: invoice.apartmentId, month: monthKey },
    });
    const doc = new PDFDocument({ margin: 36, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.fontSize(16).text('Resident Invoice', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Organization: ${invoice.organization.legalName || invoice.organization.name}`);
    if (invoice.organization.address) doc.text(`Address: ${invoice.organization.address}`);
    if (invoice.organization.fiscalCode) doc.text(`Fiscal code: ${invoice.organization.fiscalCode}`);
    if (invoice.organization.phone || invoice.organization.email) {
      doc.text(`Contact: ${invoice.organization.phone || '-'} | ${invoice.organization.email || '-'}`);
    }
    doc.text(`Invoice number: ${invoice.invoiceNumber}`);
    doc.text(`Apartment: #${invoice.apartment.number} (${invoice.apartment.building?.name || '-'} / ${invoice.apartment.staircase?.name || '-'})`);
    doc.text(`Period: ${invoice.month}/${invoice.year}`);
    doc.text(`Generated: ${invoice.updatedAt.toISOString()}`);
    if (invoice.dueDate) doc.text(`Due date: ${invoice.dueDate.toISOString().slice(0, 10)}`);
    doc.moveDown(1);
    doc.fontSize(11).text('Charges', { underline: true });
    charges.forEach((c) =>
      doc.fontSize(9).text(`${c.tariffName}: ${Number(c.amount).toFixed(2)} ${invoice.organization.defaultCurrency} (${c.status})`),
    );
    doc.moveDown(0.6);
    doc.fontSize(11).text('Payments', { underline: true });
    payments.forEach((p) =>
      doc
        .fontSize(9)
        .text(`${p.createdAt.toISOString().slice(0, 10)} - ${Number(p.amount).toFixed(2)} ${invoice.organization.defaultCurrency} (${p.status}, ${p.method})`),
    );
    doc.moveDown(0.8);
    doc.fontSize(10).text(`Previous debt: ${invoice.previousDebt.toFixed(2)} ${invoice.organization.defaultCurrency}`);
    doc.text(`Current charges: ${invoice.currentCharges.toFixed(2)} ${invoice.organization.defaultCurrency}`);
    doc.text(`Payments amount: ${invoice.paymentsAmount.toFixed(2)} ${invoice.organization.defaultCurrency}`);
    doc.fontSize(12).text(`Total due: ${invoice.totalDue.toFixed(2)} ${invoice.organization.defaultCurrency}`);
    if (invoice.organization.paymentInstructions) {
      doc.moveDown(0.6);
      doc.fontSize(10).text(`Payment instructions: ${invoice.organization.paymentInstructions}`);
    }
    if (invoice.organization.bankName || invoice.organization.bankAccountIban || invoice.organization.bankSwift) {
      doc.moveDown(0.4);
      doc.fontSize(10).text(`Bank: ${invoice.organization.bankName || '-'}`);
      doc.text(`IBAN: ${invoice.organization.bankAccountIban || '-'}`);
      doc.text(`SWIFT: ${invoice.organization.bankSwift || '-'}`);
    }
    doc.end();
    await new Promise<void>((resolve) => doc.on('end', () => resolve()));
    return Buffer.concat(chunks);
  }

  async adminInvoicePdf(user: AuthUser, id: string) {
    const { organizationId } = this.assertAdmin(user);
    const invoice = await this.prisma.residentInvoice.findFirst({ where: { id, organizationId }, select: { id: true } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return this.pdfForInvoice(id);
  }

  async residentList(user: AuthUser) {
    const { organizationId, userId } = this.assertResidentOrTenant(user);
    const apartmentIds = (await this.prisma.residentProfile.findMany({ where: { organizationId, userId }, select: { apartmentId: true } })).map((p) => p.apartmentId);
    return this.prisma.residentInvoice.findMany({
      where: { organizationId, apartmentId: { in: apartmentIds.length ? apartmentIds : ['__none__'] } },
      include: { apartment: { select: { id: true, number: true, building: { select: { name: true } }, staircase: { select: { name: true } } } } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  }

  async residentGetOne(user: AuthUser, id: string) {
    const { organizationId, userId } = this.assertResidentOrTenant(user);
    const apartmentIds = (await this.prisma.residentProfile.findMany({ where: { organizationId, userId }, select: { apartmentId: true } })).map((p) => p.apartmentId);
    const invoice = await this.prisma.residentInvoice.findFirst({
      where: { id, organizationId, apartmentId: { in: apartmentIds.length ? apartmentIds : ['__none__'] } },
      include: { apartment: { include: { building: true, staircase: true } } },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return this.adminGetOne({ role: 'ADMIN', organizationId, id: userId }, id);
  }

  async residentInvoicePdf(user: AuthUser, id: string) {
    await this.residentGetOne(user, id);
    return this.pdfForInvoice(id);
  }

  async sendReminders(user: AuthUser, dto: SendRemindersDto) {
    const { organizationId } = this.assertAdmin(user);
    const invoices = await this.prisma.residentInvoice.findMany({
      where: {
        organizationId,
        month: dto.month,
        year: dto.year,
        ...(dto.status ? { status: dto.status } : { status: { in: ['DRAFT', 'ISSUED'] } }),
        totalDue: { gt: 0 },
      },
    });
    const message = dto.message?.trim() || `Reminder: exista sold restant pentru ${dto.month}/${dto.year}.`;
    let created = 0;
    for (const invoice of invoices) {
      const recentReminder = await this.prisma.paymentReminder.findFirst({
        where: {
          organizationId,
          invoiceId: invoice.id,
          type: 'IN_APP',
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        select: { id: true },
      });
      if (recentReminder) {
        continue;
      }
      await this.prisma.paymentReminder.create({
        data: {
          organizationId,
          apartmentId: invoice.apartmentId,
          invoiceId: invoice.id,
          type: 'IN_APP',
          message,
          status: 'SENT',
          sentAt: new Date(),
        },
      });
      const residents = await this.prisma.residentProfile.findMany({
        where: { organizationId, apartmentId: invoice.apartmentId },
        select: { userId: true },
        distinct: ['userId'],
      });
      if (residents.length) {
        await this.notificationsService.notifyUsers({
          organizationId,
          userIds: residents.map((r) => r.userId),
          type: 'PAYMENT' as any,
          title: 'Reminder de plata',
          message,
          link: `/resident/invoices/${invoice.id}`,
        });
        const users = await this.prisma.user.findMany({
          where: { id: { in: residents.map((r) => r.userId) }, deletedAt: null, isActive: true },
          select: { id: true, email: true, firstName: true },
        });
        const organization = await this.prisma.organization.findUnique({
          where: { id: organizationId },
          select: { name: true },
        });
        const apartment = await this.prisma.apartment.findUnique({
          where: { id: invoice.apartmentId },
          select: { number: true },
        });
        for (const resident of users) {
          await this.emailTemplateService.sendTemplateEmail({
            to: resident.email,
            key: 'payment_reminder',
            targetRole: 'RESIDENT',
            variables: {
              userName: resident.firstName || resident.email,
              organizationName: organization?.name || 'Espace',
              apartmentNumber: apartment?.number || '-',
              supportEmail: process.env.SUPPORT_EMAIL || 'support@espace.md',
            },
            inAppFallback: async () => {
              await this.notificationsService.createNotification({
                organizationId,
                userId: resident.id,
                type: 'PAYMENT' as any,
                title: 'Reminder de plata',
                message,
                link: `/resident/invoices/${invoice.id}`,
              });
            },
          });
        }
      }
      created += 1;
    }
    return { sent: created };
  }

  async adminReminderHistory(user: AuthUser) {
    const { organizationId } = this.assertAdmin(user);
    return this.prisma.paymentReminder.findMany({
      where: { organizationId },
      include: { apartment: { select: { id: true, number: true, building: { select: { name: true } }, staircase: { select: { name: true } } } }, invoice: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async adminReceipts(user: AuthUser) {
    const { organizationId } = this.assertAdmin(user);
    return this.prisma.receipt.findMany({
      where: { organizationId },
      include: { apartment: { select: { id: true, number: true, building: { select: { name: true } }, staircase: { select: { name: true } } } }, payment: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async receiptPdf(receiptId: string) {
    const receipt = await this.prisma.receipt.findUnique({
      where: { id: receiptId },
      include: { organization: true, apartment: { include: { building: true, staircase: true } }, payment: true },
    });
    if (!receipt) throw new NotFoundException('Receipt not found');
    const doc = new PDFDocument({ margin: 36, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.fontSize(16).text('Payment Receipt', { underline: true });
    doc.fontSize(10).text(`Organization: ${receipt.organization.legalName || receipt.organization.name}`);
    if (receipt.organization.address) doc.text(`Address: ${receipt.organization.address}`);
    if (receipt.organization.fiscalCode) doc.text(`Fiscal code: ${receipt.organization.fiscalCode}`);
    doc.text(`Receipt number: ${receipt.receiptNumber}`);
    doc.text(`Apartment: #${receipt.apartment.number} (${receipt.apartment.building?.name || '-'} / ${receipt.apartment.staircase?.name || '-'})`);
    doc.text(`Amount: ${receipt.amount.toFixed(2)} ${receipt.organization.defaultCurrency}`);
    doc.text(`Payment method: ${receipt.payment.method}`);
    doc.text(`Payment date: ${receipt.paymentDate.toISOString().slice(0, 10)}`);
    doc.text(`Generated: ${receipt.updatedAt.toISOString()}`);
    doc.end();
    await new Promise<void>((resolve) => doc.on('end', () => resolve()));
    return Buffer.concat(chunks);
  }

  async adminReceiptPdf(user: AuthUser, id: string) {
    const { organizationId } = this.assertAdmin(user);
    const receipt = await this.prisma.receipt.findFirst({ where: { id, organizationId }, select: { id: true } });
    if (!receipt) throw new NotFoundException('Receipt not found');
    return this.receiptPdf(id);
  }

  async residentReceipts(user: AuthUser) {
    const { organizationId, userId } = this.assertResidentOrTenant(user);
    const apartmentIds = (await this.prisma.residentProfile.findMany({ where: { organizationId, userId }, select: { apartmentId: true } })).map((p) => p.apartmentId);
    return this.prisma.receipt.findMany({
      where: { organizationId, apartmentId: { in: apartmentIds.length ? apartmentIds : ['__none__'] } },
      include: { apartment: { select: { id: true, number: true, building: { select: { name: true } }, staircase: { select: { name: true } } } }, payment: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async residentReceiptPdf(user: AuthUser, id: string) {
    const { organizationId, userId } = this.assertResidentOrTenant(user);
    const apartmentIds = (await this.prisma.residentProfile.findMany({ where: { organizationId, userId }, select: { apartmentId: true } })).map((p) => p.apartmentId);
    const receipt = await this.prisma.receipt.findFirst({ where: { id, organizationId, apartmentId: { in: apartmentIds.length ? apartmentIds : ['__none__'] } }, select: { id: true } });
    if (!receipt) throw new NotFoundException('Receipt not found');
    return this.receiptPdf(id);
  }

  async superadminSupportInvoice(user: AuthUser, id: string) {
    this.assertSuperadmin(user);
    return this.prisma.residentInvoice.findUnique({ where: { id }, include: { apartment: true, organization: true } });
  }
}
