import { PaymentProvider } from '@prisma/client';
import { MockPaymentProvider } from './mock.provider';
import { ProviderIntentInput, ProviderIntentResult } from './payment-provider.interface';

export class CashPaymentProvider extends MockPaymentProvider {
  constructor() {
    super(PaymentProvider.CASH);
  }

  async createPaymentIntent(input: ProviderIntentInput): Promise<ProviderIntentResult> {
    return {
      status: 'CREATED',
      providerPaymentId: `cash_${input.paymentIntentId}`,
      message: 'Cash payment intent created. Please pay directly to the administrator.',
    };
  }
}

