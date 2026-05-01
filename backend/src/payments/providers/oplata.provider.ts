import { PaymentProvider } from '@prisma/client';
import { MockPaymentProvider } from './mock.provider';

export class OplataPaymentProvider extends MockPaymentProvider {
  constructor() {
    super(PaymentProvider.OPLATA);
  }
}

