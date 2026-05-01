import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { SystemMonitoringModule } from '../system-monitoring/system-monitoring.module';
import { PaymentsController } from './payments.controller';
import { PaymentProviderFactory } from './providers/payment-provider.factory';
import { PaymentsService } from './payments.service';

@Module({
  imports: [PrismaModule, SubscriptionModule, AuditModule, SystemMonitoringModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentProviderFactory],
})
export class PaymentsModule {}
