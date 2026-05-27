import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { IssuesController } from './issues.controller';
import { IssuesService } from './issues.service';
import { SaasUsageModule } from '../saas-usage/saas-usage.module';

@Module({
  imports: [PrismaModule, AuditModule, NotificationsModule, SaasUsageModule],
  controllers: [IssuesController],
  providers: [IssuesService],
})
export class IssuesModule {}
