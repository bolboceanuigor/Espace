import { Module } from '@nestjs/common';
import { ActivityMvpModule } from '../activity-mvp/activity-mvp.module';
import { SaasUsageModule } from '../saas-usage/saas-usage.module';
import { MvpSecurityModule } from '../security/mvp-security.module';
import { BillingDraftsController } from './billing-drafts.controller';
import { BillingDraftsService } from './billing-drafts.service';

@Module({
  imports: [MvpSecurityModule, ActivityMvpModule, SaasUsageModule],
  controllers: [BillingDraftsController],
  providers: [BillingDraftsService],
  exports: [BillingDraftsService],
})
export class BillingDraftsModule {}
