import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { CommunicationsController } from './communications.controller';
import { CommunicationsService } from './communications.service';
import { LimitsModule } from '../limits/limits.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [SubscriptionModule, AuditModule, NotificationsModule, LimitsModule],
  controllers: [CommunicationsController],
  providers: [CommunicationsService],
})
export class CommunicationsModule {}
