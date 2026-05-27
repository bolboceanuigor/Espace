import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SaasInvoicesController } from './saas-invoices.controller';
import { SaasInvoicesService } from './saas-invoices.service';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [SaasInvoicesController],
  providers: [SaasInvoicesService],
  exports: [SaasInvoicesService],
})
export class SaasInvoicesModule {}
