import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { EmailModule } from '../email/email.module';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { SaasUsageModule } from '../saas-usage/saas-usage.module';

@Module({
  imports: [PrismaModule, AuditModule, NotificationsModule, EmailModule, SaasUsageModule],
  controllers: [InvoicesController],
  providers: [InvoicesService],
})
export class InvoicesModule {}
