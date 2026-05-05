import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PaymentsController } from './payments.controller';
import { PaymentProviderFactory } from './providers/payment-provider.factory';
import { PaymentsService } from './payments.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentProviderFactory],
})
export class PaymentsModule {}
