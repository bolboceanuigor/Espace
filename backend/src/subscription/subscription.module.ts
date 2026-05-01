import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SubscriptionService } from './subscription.service';
import { SubscriptionController } from './subscription.controller';
import { UsageController } from './usage.controller';
import { BillingController } from './billing.controller';
import { OrganizationBillingController } from './organization-billing.controller';
import { OrganizationBillingService } from './organization-billing.service';
import { SubscriptionAccessGuard } from './subscription-access.guard';

@Module({
  imports: [AuditModule, NotificationsModule],
  controllers: [SubscriptionController, UsageController, BillingController, OrganizationBillingController],
  providers: [SubscriptionService, OrganizationBillingService, SubscriptionAccessGuard],
  exports: [SubscriptionService, OrganizationBillingService, SubscriptionAccessGuard],
})
export class SubscriptionModule {}
