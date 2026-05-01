import { PaymentProvider } from '@prisma/client';
import { PaymentProviderAdapter, ProviderIntentInput, ProviderIntentResult, ProviderStatusResult } from './payment-provider.interface';

export class MockPaymentProvider implements PaymentProviderAdapter {
  constructor(public readonly provider: PaymentProvider) {}

  async createPaymentIntent(input: ProviderIntentInput): Promise<ProviderIntentResult> {
    return {
      status: 'CREATED',
      redirectUrl: `https://mock-payments.local/redirect/${this.provider.toLowerCase()}/${input.paymentIntentId}`,
      providerPaymentId: `mock_${input.paymentIntentId}`,
      message: 'Provider integration is not configured yet',
    };
  }

  async getPaymentStatus(providerPaymentId: string): Promise<ProviderStatusResult> {
    return {
      status: 'CREATED',
      providerPaymentId,
      message: 'Provider integration is not configured yet',
    };
  }

  async handleWebhook(_: any): Promise<ProviderStatusResult> {
    return {
      status: 'FAILED',
      message: 'Provider integration is not configured yet',
    };
  }
}

