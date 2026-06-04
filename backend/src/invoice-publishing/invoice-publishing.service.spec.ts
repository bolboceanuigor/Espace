import { BillingCurrency, NotificationType, PaymentMethod, PaymentProofStatus, PaymentProvider, PaymentSource, PaymentStatus, Role } from '@prisma/client';
import { InvoicePublishingService } from './invoice-publishing.service';

describe('InvoicePublishingService', () => {
  function createService() {
    const prisma = {
      billingDraftInvoice: { findFirst: jest.fn() },
      paymentProof: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
      payment: { create: jest.fn() },
      $transaction: jest.fn(),
    };
    const activity = {
      notifyOrganizationAdmins: jest.fn().mockResolvedValue(undefined),
      notifyUsers: jest.fn().mockResolvedValue(undefined),
      createActivity: jest.fn().mockResolvedValue(undefined),
    };
    const service = new InvoicePublishingService(prisma as any, activity as any);

    jest.spyOn(service as any, 'residentInvoiceScope').mockResolvedValue({
      organizationId: 'org-1',
      apartmentIds: ['apt-1'],
      residentId: 'resident-profile-1',
    });
    jest.spyOn(service as any, 'residentInvoiceWhere').mockReturnValue({
      organizationId: 'org-1',
      apartmentId: { in: ['apt-1'] },
    });
    jest.spyOn(service as any, 'invoiceDetailInclude').mockReturnValue({});
    jest.spyOn(service as any, 'paymentProofInclude').mockReturnValue({});
    jest.spyOn(service as any, 'paidAmountForInvoice').mockResolvedValue(0);
    jest.spyOn(service as any, 'paymentState').mockReturnValue({
      paymentDisplayStatus: 'UNPAID',
      remainingAmount: 300,
    });
    jest.spyOn(service as any, 'findPossibleDuplicatePaymentProof').mockResolvedValue(null);
    jest.spyOn(service as any, 'serializeResidentPaymentProof').mockImplementation((row: unknown) => row);
    jest.spyOn(service as any, 'serializeAdminPaymentProof').mockImplementation((row: unknown) => row);
    jest.spyOn(service as any, 'ensureReceiptForPayment').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'recalculateInvoicePaymentStatus').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'log').mockResolvedValue(undefined);

    return { service, prisma, activity };
  }

  it('keeps offline payment proofs pending until admin review', async () => {
    const { service, prisma, activity } = createService();
    const invoice = {
      id: 'invoice-1',
      organizationId: 'org-1',
      apartmentId: 'apt-1',
      invoiceNumber: 'INV-001',
    };
    prisma.billingDraftInvoice.findFirst.mockResolvedValue(invoice);
    prisma.paymentProof.create.mockResolvedValue({
      id: 'proof-1',
      organizationId: 'org-1',
      invoiceId: 'invoice-1',
      apartmentId: 'apt-1',
      residentUserId: 'resident-user-1',
      amount: 300,
      method: PaymentMethod.MANUAL_BANK_TRANSFER,
      status: PaymentProofStatus.SUBMITTED,
      metadataJson: { realMoneyProcessed: false },
    });

    const result = await service.submitResidentPaymentProof(
      { id: 'resident-user-1', role: Role.RESIDENT, organizationId: 'org-1' } as any,
      'invoice-1',
      {
        amount: 300,
        currency: 'MDL',
        method: PaymentMethod.MANUAL_BANK_TRANSFER,
      },
    );

    expect(prisma.paymentProof.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          invoiceId: 'invoice-1',
          status: PaymentProofStatus.SUBMITTED,
          amount: 300,
          metadataJson: expect.objectContaining({
            realMoneyProcessed: false,
          }),
        }),
      }),
    );
    expect(prisma.payment.create).not.toHaveBeenCalled();
    expect(activity.notifyOrganizationAdmins).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        type: NotificationType.PAYMENT,
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        possibleDuplicate: false,
        message: 'Dovada a fost trimisă spre verificare.',
      }),
    );
  });

  it('creates an accepted ledger payment only after admin approval', async () => {
    const { service, prisma, activity } = createService();
    const proof = {
      id: 'proof-1',
      organizationId: 'org-1',
      apartmentId: 'apt-1',
      invoiceId: 'invoice-1',
      residentUserId: 'resident-user-1',
      amount: 300,
      method: PaymentMethod.MANUAL_BANK_TRANSFER,
      status: PaymentProofStatus.SUBMITTED,
      residentNote: 'Transfer bancar',
      paidAt: null,
      externalReference: null,
      invoice: {
        id: 'invoice-1',
        invoiceNumber: 'INV-001',
        billingPeriod: { year: 2026, month: 6 },
      },
    };
    prisma.paymentProof.findFirst.mockResolvedValue(proof);
    const tx = {
      payment: {
        create: jest.fn().mockResolvedValue({
          id: 'payment-1',
          organizationId: 'org-1',
          apartmentId: 'apt-1',
          billingDraftInvoiceId: 'invoice-1',
          amount: 300,
          method: PaymentMethod.MANUAL_BANK_TRANSFER,
          provider: PaymentProvider.MANUAL_BANK_TRANSFER,
          source: PaymentSource.PAYMENT_PROOF,
          status: PaymentStatus.ACCEPTED,
        }),
      },
      paymentProof: {
        update: jest.fn().mockResolvedValue({
          ...proof,
          paymentId: 'payment-1',
          acceptedAmount: 300,
          status: PaymentProofStatus.ACCEPTED,
        }),
      },
    };
    prisma.$transaction.mockImplementation(async (callback: any) => callback(tx));

    const result = await service.acceptAdminPaymentProof(
      { id: 'admin-1', role: Role.ADMIN, organizationId: 'org-1' } as any,
      'proof-1',
      { acceptedAmount: 300, adminNote: 'Verificat' },
    );

    expect(tx.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-1',
          apartmentId: 'apt-1',
          billingDraftInvoiceId: 'invoice-1',
          amount: 300,
          currency: BillingCurrency.MDL,
          status: PaymentStatus.ACCEPTED,
          provider: PaymentProvider.MANUAL_BANK_TRANSFER,
          source: PaymentSource.PAYMENT_PROOF,
        }),
      }),
    );
    expect(tx.paymentProof.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'proof-1' },
        data: expect.objectContaining({
          paymentId: 'payment-1',
          status: PaymentProofStatus.ACCEPTED,
          acceptedAmount: 300,
        }),
      }),
    );
    expect(activity.notifyUsers).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        userIds: ['resident-user-1'],
        type: NotificationType.PAYMENT,
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        message: 'Dovada a fost acceptată.',
      }),
    );
  });
});
