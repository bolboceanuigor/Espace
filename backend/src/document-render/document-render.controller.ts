import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { GeneratedDocumentType, Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { PermissionGuard } from '../auth/permission.guard';
import { MvpAuthGuard, MvpRolesGuard, MvpUser } from '../security/mvp-auth.guard';
import { DocumentRenderService } from './document-render.service';

@Controller()
export class DocumentRenderController {
  constructor(private readonly service: DocumentRenderService) {}

  @Get(['admin/invoices/:id/document', 'api/admin/invoices/:id/document'])
  @UseGuards(MvpAuthGuard, MvpRolesGuard, PermissionGuard)
  @Roles(Role.ADMIN)
  @RequirePermission('INVOICES', 'VIEW')
  adminInvoiceDocument(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.service.getAdminInternalInvoiceDocument(user, id);
  }

  @Get(['admin/invoices/:id/pdf', 'api/admin/invoices/:id/pdf'])
  @UseGuards(MvpAuthGuard, MvpRolesGuard, PermissionGuard)
  @Roles(Role.ADMIN)
  @RequirePermission('INVOICES', 'VIEW')
  adminInvoicePdf(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.service.pdfFallback(user, {
      documentType: GeneratedDocumentType.INTERNAL_INVOICE,
      entityType: 'INTERNAL_INVOICE',
      entityId: id,
      associationId: user.organizationId,
      fileName: this.service.buildDocumentFileName(GeneratedDocumentType.INTERNAL_INVOICE, id),
      printUrl: `/ro/admin/invoices/${id}/print`,
    });
  }

  @Get(['admin/payments/:id/receipt-document', 'api/admin/payments/:id/receipt-document'])
  @UseGuards(MvpAuthGuard, MvpRolesGuard, PermissionGuard)
  @Roles(Role.ADMIN)
  @RequirePermission('PAYMENTS', 'VIEW')
  adminPaymentReceiptDocument(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.service.getAdminPaymentReceiptDocument(user, id);
  }

  @Get(['admin/payments/:id/receipt-pdf', 'api/admin/payments/:id/receipt-pdf'])
  @UseGuards(MvpAuthGuard, MvpRolesGuard, PermissionGuard)
  @Roles(Role.ADMIN)
  @RequirePermission('PAYMENTS', 'VIEW')
  adminPaymentReceiptPdf(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.service.pdfFallback(user, {
      documentType: GeneratedDocumentType.PAYMENT_RECEIPT,
      entityType: 'PAYMENT',
      entityId: id,
      associationId: user.organizationId,
      fileName: this.service.buildDocumentFileName(GeneratedDocumentType.PAYMENT_RECEIPT, id),
      printUrl: `/ro/admin/payments/${id}/receipt/print`,
    });
  }

  @Get(['admin/reports/financial/monthly/document', 'api/admin/reports/financial/monthly/document'])
  @UseGuards(MvpAuthGuard, MvpRolesGuard, PermissionGuard)
  @Roles(Role.ADMIN)
  @RequirePermission('REPORTS', 'VIEW')
  adminFinancialReportDocument(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.service.getAdminFinancialReportDocument(user, query);
  }

  @Get(['admin/meter-readings/reports/document', 'api/admin/meter-readings/reports/document'])
  @UseGuards(MvpAuthGuard, MvpRolesGuard, PermissionGuard)
  @Roles(Role.ADMIN)
  @RequirePermission('REPORTS', 'VIEW')
  adminMeterReportDocument(@CurrentUser() user: MvpUser, @Query() query: Record<string, unknown>) {
    return this.service.getMeterConsumptionReportDocument(user, query);
  }

  @Get(['resident/invoices/:id/document', 'api/resident/invoices/:id/document'])
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.RESIDENT)
  residentInvoiceDocument(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.service.getResidentInternalInvoiceDocument(user, id);
  }

  @Get(['resident/invoices/:id/pdf', 'api/resident/invoices/:id/pdf'])
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.RESIDENT)
  residentInvoicePdf(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.service.pdfFallback(user, {
      documentType: GeneratedDocumentType.INTERNAL_INVOICE,
      entityType: 'INTERNAL_INVOICE',
      entityId: id,
      associationId: user.organizationId,
      fileName: this.service.buildDocumentFileName(GeneratedDocumentType.INTERNAL_INVOICE, id),
      printUrl: `/ro/resident/invoices/${id}/print`,
    });
  }

  @Get(['resident/payments/:id/receipt-document', 'api/resident/payments/:id/receipt-document'])
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.RESIDENT)
  residentPaymentReceiptDocument(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.service.getResidentPaymentReceiptDocument(user, id);
  }

  @Get(['resident/payments/:id/receipt-pdf', 'api/resident/payments/:id/receipt-pdf'])
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.RESIDENT)
  residentPaymentReceiptPdf(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.service.pdfFallback(user, {
      documentType: GeneratedDocumentType.PAYMENT_RECEIPT,
      entityType: 'PAYMENT',
      entityId: id,
      associationId: user.organizationId,
      fileName: this.service.buildDocumentFileName(GeneratedDocumentType.PAYMENT_RECEIPT, id),
      printUrl: `/ro/resident/payments/${id}/receipt/print`,
    });
  }

  @Get(['superadmin/billing/saas-invoices/:id/document', 'api/superadmin/billing/saas-invoices/:id/document'])
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.SUPERADMIN)
  superadminSaasInvoiceDocument(@Param('id') id: string) {
    return this.service.getSuperadminSaasInvoiceDocument(id);
  }

  @Get(['superadmin/billing/saas-invoices/:id/pdf', 'api/superadmin/billing/saas-invoices/:id/pdf'])
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.SUPERADMIN)
  superadminSaasInvoicePdf(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.service.pdfFallback(user, {
      documentType: GeneratedDocumentType.SAAS_INVOICE,
      entityType: 'SAAS_INVOICE',
      entityId: id,
      fileName: this.service.buildDocumentFileName(GeneratedDocumentType.SAAS_INVOICE, id),
      printUrl: `/ro/superadmin/billing/saas-invoices/${id}/print`,
    });
  }

  @Get(['superadmin/billing/saas-invoices/:id/receipt-document', 'api/superadmin/billing/saas-invoices/:id/receipt-document'])
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.SUPERADMIN)
  superadminSaasReceiptDocument(@Param('id') id: string) {
    return this.service.getSuperadminSaasReceiptDocument(id);
  }

  @Get(['superadmin/billing/saas-invoices/:id/receipt-pdf', 'api/superadmin/billing/saas-invoices/:id/receipt-pdf'])
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.SUPERADMIN)
  superadminSaasReceiptPdf(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.service.pdfFallback(user, {
      documentType: GeneratedDocumentType.SAAS_PAYMENT_RECEIPT,
      entityType: 'SAAS_INVOICE',
      entityId: id,
      fileName: this.service.buildDocumentFileName(GeneratedDocumentType.SAAS_PAYMENT_RECEIPT, id),
      printUrl: `/ro/superadmin/billing/saas-invoices/${id}/receipt/print`,
    });
  }

  @Get(['admin/subscription/invoices/:id/document', 'api/admin/subscription/invoices/:id/document'])
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.ADMIN)
  adminSaasInvoiceDocument(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.service.getAdminSaasInvoiceDocument(user, id);
  }

  @Get(['admin/subscription/invoices/:id/pdf', 'api/admin/subscription/invoices/:id/pdf'])
  @UseGuards(MvpAuthGuard, MvpRolesGuard)
  @Roles(Role.ADMIN)
  adminSaasInvoicePdf(@CurrentUser() user: MvpUser, @Param('id') id: string) {
    return this.service.pdfFallback(user, {
      documentType: GeneratedDocumentType.SAAS_INVOICE,
      entityType: 'SAAS_INVOICE',
      entityId: id,
      associationId: user.organizationId,
      fileName: this.service.buildDocumentFileName(GeneratedDocumentType.SAAS_INVOICE, id),
      printUrl: `/ro/admin/subscription/invoices/${id}/print`,
    });
  }
}
