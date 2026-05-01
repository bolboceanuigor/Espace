import { PaymentProvider } from '@prisma/client';
import { MockPaymentProvider } from './mock.provider';

export class PaynetPaymentProvider extends MockPaymentProvider {
  constructor() {
    super(PaymentProvider.PAYNET);
  }
}

