import { PaymentProvider } from '@prisma/client';
import { MockPaymentProvider } from './mock.provider';
import { ProviderIntentInput, ProviderIntentResult } from './payment-provider.interface';

export class ManualBankTransferProvider extends MockPaymentProvider {
  constructor() {
    super(PaymentProvider.MANUAL_BANK_TRANSFER);
  }

  async createPaymentIntent(input: ProviderIntentInput): Promise<ProviderIntentResult> {
    return {
      status: 'CREATED',
      providerPaymentId: `bank_${input.paymentIntentId}`,
      message: 'Bank transfer intent created. Please follow organization payment instructions.',
    };
  }
}

