import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { CommunicationsController } from './communications.controller';
import { CommunicationsService } from './communications.service';
import { LimitsModule } from '../limits/limits.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SaasUsageModule } from '../saas-usage/saas-usage.module';

@Module({
  imports: [AuditModule, NotificationsModule, LimitsModule, SaasUsageModule],
  controllers: [CommunicationsController],
  providers: [CommunicationsService],
})
export class CommunicationsModule {}
