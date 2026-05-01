import { PaymentProvider } from '@prisma/client';
import { MockPaymentProvider } from './mock.provider';

export class MaibPaymentProvider extends MockPaymentProvider {
  constructor() {
    super(PaymentProvider.MAIB);
  }
}

