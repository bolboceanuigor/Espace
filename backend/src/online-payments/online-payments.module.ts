import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { OnlinePaymentsController } from './online-payments.controller';
import { PaymentIntentService } from './payment-intent.service';
import { PaymentProviderService } from './payment-provider.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [OnlinePaymentsController],
  providers: [PaymentProviderService, PaymentIntentService],
  exports: [PaymentProviderService, PaymentIntentService],
})
export class OnlinePaymentsModule {}
