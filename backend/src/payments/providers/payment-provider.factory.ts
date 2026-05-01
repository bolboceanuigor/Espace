import { Injectable } from '@nestjs/common';
import { PaymentProvider } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CashPaymentProvider } from './cash.provider';
import { MaibPaymentProvider } from './maib.provider';
import { MockPaymentProvider } from './mock.provider';
import { ManualBankTransferProvider } from './manual-bank-transfer.provider';
import { OplataPaymentProvider } from './oplata.provider';
import { PaynetPaymentProvider } from './paynet.provider';
import { PaymentProviderAdapter } from './payment-provider.interface';

@Injectable()
export class PaymentProviderFactory {
  constructor(private readonly prisma: PrismaService) {}

  private build(provider: PaymentProvider): PaymentProviderAdapter {
    switch (provider) {
      case PaymentProvider.MAIB:
        return new MaibPaymentProvider();
      case PaymentProvider.PAYNET:
        return new PaynetPaymentProvider();
      case PaymentProvider.OPLATA:
        return new OplataPaymentProvider();
      case PaymentProvider.MANUAL_BANK_TRANSFER:
        return new ManualBankTransferProvider();
      case PaymentProvider.CASH:
        return new CashPaymentProvider();
      default:
        return new MockPaymentProvider(provider);
    }
  }

  async resolveForOrganization(provider: PaymentProvider, organizationId: string) {
    const config = await this.prisma.paymentProviderConfig.findUnique({
      where: { organizationId_provider: { organizationId, provider } },
    });
    const adapter = config?.isEnabled ? this.build(provider) : new MockPaymentProvider(provider);
    return { adapter, config };
  }
}

