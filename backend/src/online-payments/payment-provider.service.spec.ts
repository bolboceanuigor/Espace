import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  OnlinePaymentProviderMode,
  OnlinePaymentProviderStatus,
  OnlinePaymentProviderType,
  PaymentIntentEventType,
  PaymentIntentStatus,
  PaymentWebhookEventStatus,
} from '@prisma/client';
import { PaymentProviderService } from './payment-provider.service';

describe('PaymentProviderService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      PAYMENTS_EXTERNAL_ENABLED: 'false',
      PAYMENTS_MANUAL_TEST_WEBHOOK_SECRET: 'test-webhook-secret',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  function createService() {
    const prisma = {
      onlinePaymentProvider: {
        findFirst: jest.fn(),
        upsert: jest.fn(),
      },
      paymentWebhookEvent: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      paymentIntent: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      paymentIntentEvent: {
        create: jest.fn(),
      },
    };
    const audit = {
      createLog: jest.fn().mockResolvedValue(undefined),
    };
    const service = new PaymentProviderService(prisma as any, audit as any);
    jest.spyOn(service, 'ensurePresetProviders').mockResolvedValue(undefined);
    return { service, prisma, audit };
  }

  const configuredManualProvider = {
    id: 'provider-1',
    type: OnlinePaymentProviderType.MANUAL_TEST,
    status: OnlinePaymentProviderStatus.TESTING,
    mode: OnlinePaymentProviderMode.TEST,
    supportsWebhooks: true,
  };

  const storedIntent = {
    id: 'intent-1',
    organizationId: 'org-1',
    providerType: OnlinePaymentProviderType.MANUAL_TEST,
    providerPaymentId: null,
    providerReference: null,
    status: PaymentIntentStatus.CREATED,
    succeededAt: null,
    failedAt: null,
    failureReason: null,
    cancelledAt: null,
    cancellationReason: null,
    metadataJson: { source: 'unit-test' },
  };

  it('rejects webhook requests without a valid signature', async () => {
    const { service, prisma } = createService();
    prisma.paymentWebhookEvent.findFirst.mockResolvedValue(null);
    prisma.onlinePaymentProvider.findFirst.mockResolvedValue(configuredManualProvider);
    prisma.paymentWebhookEvent.create.mockResolvedValue({ id: 'evt-db-1' });

    await expect(
      service.parseWebhook(
        OnlinePaymentProviderType.MANUAL_TEST,
        { id: 'evt-1', paymentIntentId: 'intent-1', status: 'SUCCEEDED' },
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.paymentWebhookEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          providerType: OnlinePaymentProviderType.MANUAL_TEST,
          providerEventId: 'evt-1',
          status: PaymentWebhookEventStatus.FAILED,
          signatureValid: false,
        }),
      }),
    );
    expect(prisma.paymentIntent.update).not.toHaveBeenCalled();
    expect(prisma.paymentIntentEvent.create).not.toHaveBeenCalled();
  });

  it('accepts a valid MANUAL_TEST webhook and updates only the intent status', async () => {
    const { service, prisma } = createService();
    prisma.paymentWebhookEvent.findFirst.mockResolvedValue(null);
    prisma.onlinePaymentProvider.findFirst.mockResolvedValue(configuredManualProvider);
    prisma.paymentIntent.findUnique.mockResolvedValue(storedIntent);
    prisma.paymentWebhookEvent.create.mockResolvedValue({ id: 'evt-db-1' });
    prisma.paymentIntent.update.mockResolvedValue({ ...storedIntent, status: PaymentIntentStatus.SUCCEEDED });
    prisma.paymentIntentEvent.create.mockResolvedValue({ id: 'intent-event-1' });

    const result = await service.parseWebhook(
      OnlinePaymentProviderType.MANUAL_TEST,
      { id: 'evt-1', paymentIntentId: 'intent-1', status: 'SUCCEEDED' },
      { 'x-espace-webhook-secret': 'test-webhook-secret' },
    );

    expect(prisma.paymentIntent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'intent-1' },
        data: expect.objectContaining({
          status: PaymentIntentStatus.SUCCEEDED,
          providerReference: 'evt-1',
          metadataJson: expect.objectContaining({
            lastWebhookProviderEventId: 'evt-1',
            lastWebhookStatus: PaymentIntentStatus.SUCCEEDED,
            realMoneyProcessed: false,
          }),
        }),
      }),
    );
    expect(prisma.paymentIntentEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentIntentId: 'intent-1',
          eventType: PaymentIntentEventType.INTENT_SUCCEEDED_TEST,
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        processed: true,
        paymentIntentId: 'intent-1',
        status: PaymentIntentStatus.SUCCEEDED,
        settlementApplied: false,
      }),
    );
  });

  it('ignores duplicate webhook events without reprocessing the intent', async () => {
    const { service, prisma } = createService();
    prisma.paymentWebhookEvent.findFirst.mockResolvedValue({
      id: 'evt-db-1',
      providerType: OnlinePaymentProviderType.MANUAL_TEST,
      providerEventId: 'evt-1',
    });

    const result = await service.parseWebhook(
      OnlinePaymentProviderType.MANUAL_TEST,
      { id: 'evt-1', paymentIntentId: 'intent-1', status: 'SUCCEEDED' },
      { 'x-espace-webhook-secret': 'test-webhook-secret' },
    );

    expect(result).toEqual(
      expect.objectContaining({
        ignored: true,
        duplicate: true,
        eventId: 'evt-db-1',
      }),
    );
    expect(prisma.onlinePaymentProvider.findFirst).not.toHaveBeenCalled();
    expect(prisma.paymentIntent.update).not.toHaveBeenCalled();
  });

  it('rejects unsupported provider webhook implementations', async () => {
    const { service, prisma } = createService();
    process.env.PAYMENTS_EXTERNAL_ENABLED = 'true';
    prisma.paymentWebhookEvent.findFirst.mockResolvedValue(null);
    prisma.onlinePaymentProvider.findFirst.mockResolvedValue({
      id: 'provider-bpay',
      type: OnlinePaymentProviderType.BPAY,
      supportsWebhooks: true,
      status: OnlinePaymentProviderStatus.DRAFT,
      mode: OnlinePaymentProviderMode.TEST,
    });
    prisma.paymentWebhookEvent.create.mockResolvedValue({ id: 'evt-db-unsupported' });

    await expect(
      service.parseWebhook(
        OnlinePaymentProviderType.BPAY,
        { id: 'evt-bpay-1', paymentIntentId: 'intent-1' },
        { 'x-espace-webhook-secret': 'test-webhook-secret' },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.paymentWebhookEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          providerType: OnlinePaymentProviderType.BPAY,
          providerEventId: 'evt-bpay-1',
          status: PaymentWebhookEventStatus.IGNORED,
        }),
      }),
    );
  });
});
