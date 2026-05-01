import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BillingCurrency,
  ImportedPaymentBatchStatus,
  ImportedPaymentSource,
  ImportedPaymentStatus,
  PaymentMatchStatus,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
} from '@prisma/client';
import * as XLSX from 'xlsx';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ApplyMappingDto,
  BatchMatchesQueryDto,
  CreateMappingTemplateDto,
  UpdateMappingTemplateDto,
} from './dto/reconciliation.dto';
import { buildPaginationMeta, resolvePagination } from '../common/pagination';

type AuthUser = { id?: string; sub?: string; role?: string; organizationId?: string | null };

@Injectable()
export class ReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private readonly REQUIRED_LOGICAL_FIELDS = ['amount', 'paymentDate'] as const;

  private userId(user: AuthUser) {
    return user.id || user.sub || '';
  }

  private chunk<T>(items: T[], size: number) {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
      chunks.push(items.slice(i, i + size));
    }
    return chunks;
  }

  private assertAdmin(user: AuthUser) {
    if (String(user.role || '').toUpperCase() !== 'ADMIN') throw new ForbiddenException('Admin access required');
    if (!user.organizationId) throw new ForbiddenException('Organization context missing');
    return { organizationId: user.organizationId, userId: this.userId(user) };
  }

  private normalizeHeader(header: string) {
    return String(header || '').trim().toLowerCase();
  }

  private defaultMappingForHeaders(headers: string[]) {
    const map = new Map(headers.map((header) => [this.normalizeHeader(header), header]));
    const pick = (...aliases: string[]) => {
      for (const alias of aliases) {
        const hit = map.get(this.normalizeHeader(alias));
        if (hit) return hit;
      }
      return undefined;
    };
    return {
      amount: pick('amount', 'sum', 'total', 'value', 'suma', 'payment amount'),
      paymentDate: pick('paymentdate', 'payment_date', 'date', 'data', 'transactiondate', 'transaction_date'),
      payerName: pick('payername', 'payer_name', 'name', 'fullname', 'platitor', 'ownername'),
      payerIban: pick('payeriban', 'payer_iban', 'iban', 'senderiban', 'fromiban'),
      apartmentNumber: pick('apartmentnumber', 'apartment_number', 'apartment', 'apartament', 'flat', 'unit'),
      buildingName: pick('buildingname', 'building_name', 'building', 'bloc', 'block'),
      invoiceNumber: pick('invoicenumber', 'invoice_number', 'invoice', 'factura', 'facturanr', 'billnumber'),
      accountNumber: pick('accountnumber', 'account_number', 'account', 'iban', 'cont'),
      transactionType: pick('transactiontype', 'transaction_type', 'type', 'debitcredit', 'dc', 'operationtype'),
      referenceNumber: pick('referencenumber', 'reference_number', 'reference', 'ref', 'transactionid'),
      currency: pick('currency', 'valuta', 'moneda', 'ccy'),
      description: pick('description', 'details', 'detalii', 'comment', 'reference'),
    } as Record<string, string | undefined>;
  }

  private parseFile(fileBuffer: Buffer) {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const firstSheet = workbook.SheetNames[0];
    if (!firstSheet) throw new BadRequestException('No worksheet found');
    const sheet = workbook.Sheets[firstSheet];
    return XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
  }

  private parseMappedRow(row: Record<string, any>, mapping: Record<string, string>) {
    const get = (logicalField: string) => {
      const header = mapping[logicalField];
      if (!header) return '';
      return row[header];
    };
    const amountRaw = get('amount');
    const amount = Number(String(amountRaw || '').replace(',', '.'));
    const currency = String(get('currency') || 'MDL').toUpperCase();
    const paymentDateRaw = get('paymentDate');
    const paymentDate = paymentDateRaw ? new Date(String(paymentDateRaw)) : new Date();
    return {
      payerName: String(get('payerName') || '').trim() || null,
      payerIban: String(get('payerIban') || '').trim() || null,
      apartmentNumber: String(get('apartmentNumber') || '').trim() || null,
      buildingName: String(get('buildingName') || '').trim() || null,
      invoiceNumber: String(get('invoiceNumber') || '').trim() || null,
      accountNumber: String(get('accountNumber') || '').trim() || null,
      transactionType: String(get('transactionType') || '').trim() || null,
      referenceNumber: String(get('referenceNumber') || '').trim() || null,
      amount: Number.isFinite(amount) ? amount : NaN,
      currency: ['MDL', 'EUR', 'USD'].includes(currency) ? (currency as BillingCurrency) : BillingCurrency.MDL,
      paymentDate: Number.isNaN(paymentDate.getTime()) ? new Date() : paymentDate,
      description: String(get('description') || '').trim() || null,
    };
  }

  private isIncomingTransaction(parsed: {
    amount: number;
    transactionType?: string | null;
  }) {
    if (parsed.amount < 0) return false;
    if (!parsed.transactionType) return parsed.amount > 0;
    const type = parsed.transactionType.toLowerCase();
    if (type.includes('credit') || type.includes('incoming') || type.includes('incasare') || type.includes('in')) return true;
    if (type.includes('debit') || type.includes('outgoing') || type.includes('payment out') || type.includes('out')) return false;
    return parsed.amount > 0;
  }

  private extractCandidateFromText(text: string | null | undefined, kind: 'invoice' | 'apartment') {
    const content = String(text || '');
    if (!content) return null;
    if (kind === 'invoice') {
      const invoiceMatch = content.match(/\bINV[-\s]?\d{4,}\b/i) || content.match(/\b\d{6,}\b/);
      return invoiceMatch ? invoiceMatch[0].replace(/\s+/g, '').toUpperCase() : null;
    }
    const aptMatch = content.match(/\bAPT[-\s]?\d{1,5}\b/i) || content.match(/\bAP\.?\s?\d{1,5}\b/i) || content.match(/\b\d{1,5}\b/);
    if (!aptMatch) return null;
    return aptMatch[0].replace(/apt|ap\.?/gi, '').replace(/[-\s]/g, '').trim();
  }

  async upload(user: AuthUser, source: ImportedPaymentSource, fileName: string, fileBuffer: Buffer) {
    const { organizationId, userId } = this.assertAdmin(user);
    const rows = this.parseFile(fileBuffer);
    const headers = Array.from(
      new Set(rows.flatMap((row) => Object.keys(row || {}).map((k) => String(k).trim())).filter(Boolean)),
    );
    const suggestedTemplate = await this.prisma.importMappingTemplate.findFirst({
      where: { organizationId, source, isDefault: true },
      orderBy: { updatedAt: 'desc' },
    });
    const autoMapping = (suggestedTemplate?.mappingJson as Record<string, string>) || this.defaultMappingForHeaders(headers);
    const batch = await this.prisma.importedPaymentBatch.create({
      data: {
        organizationId,
        fileName,
        source,
        status: ImportedPaymentBatchStatus.UPLOADED,
        totalRows: rows.length,
        mappingTemplateId: suggestedTemplate?.id || null,
        errorsJson: {
          headers,
          previewRows: rows.slice(0, 10),
          autoMapping,
        },
        uploadedByUserId: userId,
      },
    });
    if (rows.length) {
      for (const group of this.chunk(rows, 500)) {
        await this.prisma.importedPayment.createMany({
          data: group.map((row) => ({
            organizationId,
            batchId: batch.id,
            rawDataJson: row,
            amount: 0,
            currency: BillingCurrency.MDL,
            paymentDate: new Date(),
            status: ImportedPaymentStatus.NEW,
          })),
        });
      }
    }
    return this.getBatch(user, batch.id);
  }

  async listMappingTemplates(user: AuthUser, source?: ImportedPaymentSource) {
    const { organizationId } = this.assertAdmin(user);
    return this.prisma.importMappingTemplate.findMany({
      where: { organizationId, ...(source ? { source } : {}) },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  async createMappingTemplate(user: AuthUser, dto: CreateMappingTemplateDto) {
    const { organizationId, userId } = this.assertAdmin(user);
    if (dto.isDefault) {
      await this.prisma.importMappingTemplate.updateMany({
        where: { organizationId, source: dto.source, isDefault: true },
        data: { isDefault: false },
      });
    }
    return this.prisma.importMappingTemplate.create({
      data: {
        organizationId,
        source: dto.source,
        name: dto.name,
        mappingJson: dto.mappingJson,
        isDefault: !!dto.isDefault,
        createdByUserId: userId,
      },
    });
  }

  async updateMappingTemplate(user: AuthUser, id: string, dto: UpdateMappingTemplateDto) {
    const { organizationId } = this.assertAdmin(user);
    const existing = await this.prisma.importMappingTemplate.findFirst({
      where: { id, organizationId },
      select: { id: true, source: true },
    });
    if (!existing) throw new NotFoundException('Mapping template not found');
    if (dto.isDefault) {
      await this.prisma.importMappingTemplate.updateMany({
        where: { organizationId, source: existing.source, isDefault: true },
        data: { isDefault: false },
      });
    }
    return this.prisma.importMappingTemplate.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.mappingJson !== undefined ? { mappingJson: dto.mappingJson } : {}),
        ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
      },
    });
  }

  async deleteMappingTemplate(user: AuthUser, id: string) {
    const { organizationId } = this.assertAdmin(user);
    const existing = await this.prisma.importMappingTemplate.findFirst({ where: { id, organizationId }, select: { id: true } });
    if (!existing) throw new NotFoundException('Mapping template not found');
    await this.prisma.importMappingTemplate.delete({ where: { id } });
    return { ok: true };
  }

  async listBatches(user: AuthUser, query: BatchMatchesQueryDto) {
    const { organizationId } = this.assertAdmin(user);
    const where = { organizationId };
    const usePagination = query.page !== undefined || query.limit !== undefined;
    const { page, limit, skip } = resolvePagination(query, 20, 100);
    const [rows, total] = await Promise.all([
      this.prisma.importedPaymentBatch.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      ...(usePagination ? { skip, take: limit } : {}),
    }),
      this.prisma.importedPaymentBatch.count({ where }),
    ]);
    if (!usePagination) return rows;
    return { data: rows, ...buildPaginationMeta(page, limit, total) };
  }

  async getBatch(user: AuthUser, id: string) {
    const { organizationId } = this.assertAdmin(user);
    const batch = await this.prisma.importedPaymentBatch.findFirst({
      where: { id, organizationId },
      include: { _count: { select: { payments: true } }, mappingTemplate: true },
    });
    if (!batch) throw new NotFoundException('Batch not found');
    return batch;
  }

  async getBatchHeaders(user: AuthUser, id: string) {
    const { organizationId } = this.assertAdmin(user);
    const batch = await this.prisma.importedPaymentBatch.findFirst({
      where: { id, organizationId },
      include: { mappingTemplate: true },
    });
    if (!batch) throw new NotFoundException('Batch not found');
    const headers = ((batch.errorsJson as any)?.headers || []) as string[];
    const previewRows = ((batch.errorsJson as any)?.previewRows || []) as Array<Record<string, any>>;
    const autoMapping = ((batch.errorsJson as any)?.autoMapping || {}) as Record<string, string>;
    return {
      id: batch.id,
      source: batch.source,
      headers,
      previewRows,
      mappingJson: (batch.mappingJson as Record<string, string>) || null,
      defaultTemplate: batch.mappingTemplate || null,
      autoMapping,
    };
  }

  async applyBatchMapping(user: AuthUser, id: string, dto: ApplyMappingDto) {
    const { organizationId, userId } = this.assertAdmin(user);
    const batch = await this.prisma.importedPaymentBatch.findFirst({
      where: { id, organizationId },
      select: { id: true, source: true, errorsJson: true },
    });
    if (!batch) throw new NotFoundException('Batch not found');
    const mapping = dto.mappingJson || {};
    for (const required of this.REQUIRED_LOGICAL_FIELDS) {
      if (!mapping[required]) throw new BadRequestException(`Missing required mapping field: ${required}`);
    }

    let mappingTemplateId: string | null = null;
    if (dto.saveAsTemplate) {
      const name = dto.templateName?.trim() || `${batch.source} mapping`;
      if (dto.isDefault) {
        await this.prisma.importMappingTemplate.updateMany({
          where: { organizationId, source: batch.source, isDefault: true },
          data: { isDefault: false },
        });
      }
      const createdTemplate = await this.prisma.importMappingTemplate.create({
        data: {
          organizationId,
          source: batch.source,
          name,
          mappingJson: mapping,
          isDefault: !!dto.isDefault,
          createdByUserId: userId,
        },
      });
      mappingTemplateId = createdTemplate.id;
    }

    const imported = await this.prisma.importedPayment.findMany({
      where: { organizationId, batchId: id },
      select: { id: true, rawDataJson: true },
    });
    const errors: Array<{ rowId: string; message: string }> = [];
    for (const group of this.chunk(imported, 200)) {
      await Promise.all(
        group.map(async (row) => {
          const parsed = this.parseMappedRow((row.rawDataJson || {}) as Record<string, any>, mapping);
          if (!Number.isFinite(parsed.amount) || parsed.amount <= 0) {
            errors.push({ rowId: row.id, message: 'Invalid amount after mapping' });
            return;
          }
          await this.prisma.importedPayment.update({
            where: { id: row.id },
            data: {
              payerName: parsed.payerName,
              payerIban: parsed.payerIban,
              apartmentNumber: parsed.apartmentNumber,
              buildingName: parsed.buildingName,
              invoiceNumber: parsed.invoiceNumber,
              accountNumber: parsed.accountNumber,
              transactionType: parsed.transactionType,
              referenceNumber: parsed.referenceNumber,
              amount: parsed.amount,
              currency: parsed.currency,
              paymentDate: parsed.paymentDate,
              description: parsed.description,
              status: this.isIncomingTransaction(parsed) ? ImportedPaymentStatus.NEW : ImportedPaymentStatus.IGNORED,
              matchedPaymentId: null,
            },
          });
        }),
      );
    }

    await this.prisma.paymentMatch.deleteMany({
      where: { organizationId, importedPayment: { batchId: id } },
    });
    await this.prisma.importedPaymentBatch.update({
      where: { id },
      data: {
        mappingJson: mapping,
        mappingTemplateId,
        status: errors.length ? ImportedPaymentBatchStatus.FAILED : ImportedPaymentBatchStatus.PARSED,
        ignoredRows: await this.prisma.importedPayment.count({
          where: { organizationId, batchId: id, status: ImportedPaymentStatus.IGNORED },
        }),
        errorsJson: {
          ...((batch.errorsJson as any) || {}),
          mappingErrors: errors,
        },
      },
    });
    return this.getBatch(user, id);
  }

  private async detectDuplicate(organizationId: string, row: {
    amount: number;
    paymentDate: Date;
    invoiceId?: string | null;
    apartmentId?: string | null;
    accountNumber?: string | null;
    description?: string | null;
  }) {
    const dateStart = new Date(row.paymentDate);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(row.paymentDate);
    dateEnd.setHours(23, 59, 59, 999);
    const duplicatePayment = await this.prisma.payment.findFirst({
      where: {
        organizationId,
        amount: row.amount,
        createdAt: { gte: dateStart, lte: dateEnd },
        ...(row.invoiceId ? { invoiceId: row.invoiceId } : {}),
        ...(row.apartmentId ? { apartmentId: row.apartmentId } : {}),
      },
      select: { id: true },
    });
    if (duplicatePayment) return true;

    const duplicateImported = await this.prisma.importedPayment.findFirst({
      where: {
        organizationId,
        amount: row.amount,
        paymentDate: { gte: dateStart, lte: dateEnd },
        status: { in: [ImportedPaymentStatus.MATCHED, ImportedPaymentStatus.DUPLICATE] },
        ...(row.accountNumber ? { accountNumber: row.accountNumber } : {}),
        ...(row.description ? { description: row.description } : {}),
      },
      select: { id: true },
    });
    return !!duplicateImported;
  }

  private async createConfirmedPayment(params: {
    organizationId: string;
    apartmentId: string;
    invoiceId?: string | null;
    amount: number;
    currency: BillingCurrency;
    paymentDate: Date;
    provider: ImportedPaymentSource;
    note?: string | null;
  }) {
    const month = `${params.paymentDate.getFullYear()}-${String(params.paymentDate.getMonth() + 1).padStart(2, '0')}`;
    const method =
      params.provider === ImportedPaymentSource.MAIB ||
      params.provider === ImportedPaymentSource.OPLATA ||
      params.provider === ImportedPaymentSource.PAYNET
        ? PaymentMethod.ONLINE
        : PaymentMethod.BANK_TRANSFER;
    const providerMap: Record<ImportedPaymentSource, PaymentProvider | null> = {
      INFOCOM: null,
      BANK_STATEMENT: PaymentProvider.MANUAL_BANK_TRANSFER,
      MAIB_BANK_STATEMENT: PaymentProvider.MAIB,
      VICTORIABANK_STATEMENT: PaymentProvider.MANUAL_BANK_TRANSFER,
      MOLDINDCONBANK_STATEMENT: PaymentProvider.MANUAL_BANK_TRANSFER,
      OPLATA: PaymentProvider.OPLATA,
      PAYNET: PaymentProvider.PAYNET,
      MAIB: PaymentProvider.MAIB,
      OTHER_BANK_STATEMENT: PaymentProvider.MANUAL_BANK_TRANSFER,
      OTHER: null,
    };
    const existing = await this.prisma.payment.findFirst({
      where: {
        organizationId: params.organizationId,
        apartmentId: params.apartmentId,
        invoiceId: params.invoiceId || null,
        amount: params.amount,
        month,
        status: PaymentStatus.CONFIRMED,
      },
    });
    if (existing) return existing;
    const payment = await this.prisma.payment.create({
      data: {
        organizationId: params.organizationId,
        apartmentId: params.apartmentId,
        invoiceId: params.invoiceId || null,
        amount: params.amount,
        currency: params.currency,
        method,
        status: PaymentStatus.CONFIRMED,
        provider: providerMap[params.provider],
        note: params.note || 'Imported reconciliation payment',
        confirmedAt: params.paymentDate,
        month,
      },
    });
    const organization = await this.prisma.organization.findUnique({
      where: { id: params.organizationId },
      select: { receiptPrefix: true },
    });
    const stamp = params.paymentDate.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = (organization?.receiptPrefix || 'RCPT').trim().toUpperCase();
    await this.prisma.receipt.upsert({
      where: { paymentId: payment.id },
      create: {
        organizationId: payment.organizationId,
        apartmentId: payment.apartmentId,
        paymentId: payment.id,
        receiptNumber: `${prefix}-${stamp}-${payment.id.slice(0, 8).toUpperCase()}`,
        amount: payment.amount,
        paymentDate: payment.confirmedAt || new Date(),
      },
      update: {},
    });
    if (payment.invoiceId) {
      const invoice = await this.prisma.residentInvoice.findUnique({ where: { id: payment.invoiceId } });
      if (invoice) {
        const confirmed = await this.prisma.payment.aggregate({
          where: {
            organizationId: invoice.organizationId,
            apartmentId: invoice.apartmentId,
            invoiceId: invoice.id,
            status: PaymentStatus.CONFIRMED,
          },
          _sum: { amount: true },
        });
        const paid = Number(confirmed._sum.amount || 0);
        const totalDue = Math.max(invoice.previousDebt + invoice.currentCharges - paid, 0);
        await this.prisma.residentInvoice.update({
          where: { id: invoice.id },
          data: {
            paymentsAmount: paid,
            totalDue,
            status: totalDue <= 0 ? 'PAID' : paid > 0 ? 'PARTIAL' : invoice.status,
          },
        });
      }
    }
    return payment;
  }

  private async createMatch(params: {
    organizationId: string;
    importedPaymentId: string;
    invoiceId?: string | null;
    apartmentId?: string | null;
    confidenceScore: number;
    status: PaymentMatchStatus;
    reason: string;
  }) {
    return this.prisma.paymentMatch.create({
      data: {
        organizationId: params.organizationId,
        importedPaymentId: params.importedPaymentId,
        invoiceId: params.invoiceId || null,
        apartmentId: params.apartmentId || null,
        confidenceScore: params.confidenceScore,
        status: params.status,
        reason: params.reason,
      },
    });
  }

  async runBatch(user: AuthUser, batchId: string) {
    const { organizationId, userId } = this.assertAdmin(user);
    const batch = await this.prisma.importedPaymentBatch.findFirst({
      where: { id: batchId, organizationId },
      select: { id: true, source: true, mappingJson: true },
    });
    if (!batch) throw new NotFoundException('Batch not found');
    if (!batch.mappingJson) throw new BadRequestException('Mapping must be applied before reconciliation');
    await this.prisma.paymentMatch.deleteMany({
      where: { organizationId, importedPayment: { batchId } },
    });
    const imported = await this.prisma.importedPayment.findMany({
      where: { organizationId, batchId, status: { not: ImportedPaymentStatus.IGNORED } },
      orderBy: { createdAt: 'asc' },
    });

    let matchedRows = 0;
    let reviewRows = 0;
    let duplicateRows = 0;

    for (const row of imported) {
      let confidenceScore = 0;
      let reason = 'No reliable match';
      let invoiceId: string | null = null;
      let apartmentId: string | null = null;

      const searchableText = `${row.description || ''} ${row.referenceNumber || ''}`;
      const invoiceFromText = this.extractCandidateFromText(searchableText, 'invoice');
      const apartmentFromText = this.extractCandidateFromText(searchableText, 'apartment');

      if (row.invoiceNumber || invoiceFromText) {
        const normalizedInvoiceSearch = (row.invoiceNumber || invoiceFromText || '').trim();
        const invoice = await this.prisma.residentInvoice.findFirst({
          where: { organizationId, invoiceNumber: { equals: normalizedInvoiceSearch, mode: 'insensitive' } as any },
          select: { id: true, apartmentId: true, totalDue: true, month: true, year: true },
        });
        if (invoice) {
          confidenceScore = 100;
          reason = 'Invoice number found in description/reference';
          invoiceId = invoice.id;
          apartmentId = invoice.apartmentId;
        }
      }

      if (!apartmentId && (row.apartmentNumber || apartmentFromText)) {
        const aptNo = (row.apartmentNumber || apartmentFromText || '').trim();
        const apartment = await this.prisma.apartment.findFirst({
          where: {
            organizationId,
            number: aptNo,
            ...(row.buildingName ? { building: { name: row.buildingName } } : {}),
          },
          select: { id: true },
        });
        if (apartment) {
          apartmentId = apartment.id;
          const month = row.paymentDate.getMonth() + 1;
          const year = row.paymentDate.getFullYear();
          const monthInvoices = await this.prisma.residentInvoice.findMany({
            where: { organizationId, apartmentId, month, year },
            orderBy: { createdAt: 'desc' },
            take: 1,
          });
          if (monthInvoices[0]) {
            invoiceId = monthInvoices[0].id;
            if (Math.abs(Number(monthInvoices[0].totalDue) - Number(row.amount)) < 0.01) {
              confidenceScore = Math.max(confidenceScore, 90);
              reason = 'Apartment in description + exact amount';
            } else if (Math.abs(Number(monthInvoices[0].totalDue) - Number(row.amount)) <= 20) {
              confidenceScore = Math.max(confidenceScore, 75);
              reason = 'Apartment in description + close amount';
            }
          } else {
            confidenceScore = Math.max(confidenceScore, 75);
            reason = 'Apartment in description + close amount';
          }
        }
      }

      if (confidenceScore < 70 && row.payerName) {
        const profile = await this.prisma.residentProfile.findFirst({
          where: {
            organizationId,
            user: {
              OR: [
                { fullName: { contains: row.payerName, mode: 'insensitive' } },
                { firstName: { contains: row.payerName.split(' ')[0] || row.payerName, mode: 'insensitive' } },
                { lastName: { contains: row.payerName.split(' ').slice(-1)[0] || row.payerName, mode: 'insensitive' } },
              ],
            },
          },
          select: { apartmentId: true },
        });
        if (profile) {
          apartmentId = apartmentId || profile.apartmentId;
          const month = row.paymentDate.getMonth() + 1;
          const year = row.paymentDate.getFullYear();
          const monthInvoice = await this.prisma.residentInvoice.findFirst({
            where: { organizationId, apartmentId: profile.apartmentId, month, year },
            orderBy: { createdAt: 'desc' },
          });
          if (monthInvoice && Math.abs(Number(monthInvoice.totalDue) - Number(row.amount)) < 0.01) {
            invoiceId = invoiceId || monthInvoice.id;
            confidenceScore = Math.max(confidenceScore, 70);
            reason = 'Payer name matches resident + exact amount';
          } else {
            confidenceScore = Math.max(confidenceScore, 60);
            reason = 'Payer name matches resident + close amount';
          }
        }
      }

      const isDuplicate = await this.detectDuplicate(organizationId, {
        amount: row.amount,
        paymentDate: row.paymentDate,
        invoiceId,
        apartmentId,
        accountNumber: row.accountNumber,
        description: row.description,
      });
      if (isDuplicate) {
        await this.prisma.importedPayment.update({
          where: { id: row.id },
          data: { status: ImportedPaymentStatus.DUPLICATE },
        });
        await this.createMatch({
          organizationId,
          importedPaymentId: row.id,
          invoiceId,
          apartmentId,
          confidenceScore: 10,
          status: PaymentMatchStatus.NEEDS_REVIEW,
          reason: 'Potential duplicate payment',
        });
        duplicateRows += 1;
        continue;
      }

      if (confidenceScore >= 90 && apartmentId) {
        const payment = await this.createConfirmedPayment({
          organizationId,
          apartmentId,
          invoiceId,
          amount: row.amount,
          currency: row.currency,
          paymentDate: row.paymentDate,
          provider: batch.source,
          note: row.description,
        });
        await this.prisma.importedPayment.update({
          where: { id: row.id },
          data: {
            status: ImportedPaymentStatus.MATCHED,
            matchedPaymentId: payment.id,
          },
        });
        await this.createMatch({
          organizationId,
          importedPaymentId: row.id,
          invoiceId,
          apartmentId,
          confidenceScore,
          status: PaymentMatchStatus.AUTO_MATCHED,
          reason,
        });
        matchedRows += 1;
      } else {
        await this.prisma.importedPayment.update({
          where: { id: row.id },
          data: { status: ImportedPaymentStatus.NEEDS_REVIEW },
        });
        await this.createMatch({
          organizationId,
          importedPaymentId: row.id,
          invoiceId,
          apartmentId,
          confidenceScore,
          status: PaymentMatchStatus.NEEDS_REVIEW,
          reason,
        });
        reviewRows += 1;
      }
    }

    await this.prisma.importedPaymentBatch.update({
      where: { id: batchId },
      data: {
        status: ImportedPaymentBatchStatus.RECONCILED,
        matchedRows,
        reviewRows,
        duplicateRows,
        ignoredRows: await this.prisma.importedPayment.count({
          where: { organizationId, batchId, status: ImportedPaymentStatus.IGNORED },
        }),
      },
    });
    await this.auditService.logAction({
      organizationId,
      userId,
      action: 'RECONCILIATION_BATCH_RUN',
      entityType: 'IMPORTED_PAYMENT_BATCH',
      entityId: batchId,
      description: `Reconciliation batch processed: matched=${matchedRows}, review=${reviewRows}, duplicate=${duplicateRows}`,
      newValuesJson: { matchedRows, reviewRows, duplicateRows },
    });

    return this.getBatch(user, batchId);
  }

  async listBatchMatches(user: AuthUser, batchId: string, query: BatchMatchesQueryDto) {
    const { organizationId } = this.assertAdmin(user);
    const batch = await this.prisma.importedPaymentBatch.findFirst({ where: { id: batchId, organizationId }, select: { id: true } });
    if (!batch) throw new NotFoundException('Batch not found');
    const where = {
        organizationId,
        batchId,
        ...(query.status ? { status: query.status as ImportedPaymentStatus } : {}),
      };
    const usePagination = query.page !== undefined || query.limit !== undefined;
    const { page, limit, skip } = resolvePagination(query, 20, 100);
    const [rows, total] = await Promise.all([
      this.prisma.importedPayment.findMany({
      where,
      include: {
        matches: {
          orderBy: { confidenceScore: 'desc' },
          include: { invoice: true, apartment: { include: { building: true, staircase: true } } },
        },
        matchedPayment: true,
      },
      orderBy: { createdAt: 'asc' },
      ...(usePagination ? { skip, take: limit } : {}),
    }),
      this.prisma.importedPayment.count({ where }),
    ]);
    if (!usePagination) return rows;
    return { data: rows, ...buildPaginationMeta(page, limit, total) };
  }

  async confirmMatch(user: AuthUser, matchId: string) {
    const { organizationId, userId } = this.assertAdmin(user);
    const match = await this.prisma.paymentMatch.findFirst({
      where: { id: matchId, organizationId },
      include: { importedPayment: { include: { batch: true } } },
    });
    if (!match) throw new NotFoundException('Match not found');
    if (!match.apartmentId) throw new BadRequestException('No apartment resolved for this match');
    const payment = await this.createConfirmedPayment({
      organizationId,
      apartmentId: match.apartmentId,
      invoiceId: match.invoiceId,
      amount: match.importedPayment.amount,
      currency: match.importedPayment.currency,
      paymentDate: match.importedPayment.paymentDate,
      provider: match.importedPayment.batch.source,
      note: match.importedPayment.description,
    });
    await this.prisma.paymentMatch.update({
      where: { id: match.id },
      data: { status: PaymentMatchStatus.CONFIRMED },
    });
    await this.prisma.importedPayment.update({
      where: { id: match.importedPaymentId },
      data: { status: ImportedPaymentStatus.MATCHED, matchedPaymentId: payment.id },
    });
    await this.auditService.logAction({
      organizationId,
      userId,
      action: 'RECONCILIATION_MATCH_CONFIRMED',
      entityType: 'PAYMENT_MATCH',
      entityId: match.id,
      description: `Confirmed reconciliation match ${match.id}`,
      newValuesJson: {
        importedPaymentId: match.importedPaymentId,
        invoiceId: match.invoiceId,
        apartmentId: match.apartmentId,
        confidenceScore: match.confidenceScore,
      },
    });
    return { ok: true, paymentId: payment.id };
  }

  async rejectMatch(user: AuthUser, matchId: string) {
    const { organizationId, userId } = this.assertAdmin(user);
    const match = await this.prisma.paymentMatch.findFirst({
      where: { id: matchId, organizationId },
      select: { id: true, importedPaymentId: true },
    });
    if (!match) throw new NotFoundException('Match not found');
    await this.prisma.paymentMatch.update({
      where: { id: match.id },
      data: { status: PaymentMatchStatus.REJECTED },
    });
    await this.prisma.importedPayment.update({
      where: { id: match.importedPaymentId },
      data: { status: ImportedPaymentStatus.NEEDS_REVIEW },
    });
    await this.auditService.logAction({
      organizationId,
      userId,
      action: 'RECONCILIATION_MATCH_REJECTED',
      entityType: 'PAYMENT_MATCH',
      entityId: match.id,
      description: `Rejected reconciliation match ${match.id}`,
      newValuesJson: { importedPaymentId: match.importedPaymentId },
    });
    return { ok: true };
  }

  async ignoreImportedPayment(user: AuthUser, importedPaymentId: string) {
    const { organizationId } = this.assertAdmin(user);
    const row = await this.prisma.importedPayment.findFirst({ where: { id: importedPaymentId, organizationId }, select: { id: true } });
    if (!row) throw new NotFoundException('Imported payment not found');
    await this.prisma.importedPayment.update({
      where: { id: importedPaymentId },
      data: { status: ImportedPaymentStatus.IGNORED },
    });
    return { ok: true };
  }
}

