import { Module } from '@nestjs/common';
import { BillingReadController } from './billing-read.controller';
import { BillingReadService } from './billing-read.service';
import { MvpSecurityModule } from '../security/mvp-security.module';
import { ActivityMvpModule } from '../activity-mvp/activity-mvp.module';
import { AuditModule } from '../audit/audit.module';
import { SaasUsageModule } from '../saas-usage/saas-usage.module';

@Module({
  imports: [MvpSecurityModule, ActivityMvpModule, AuditModule, SaasUsageModule],
  controllers: [BillingReadController],
  providers: [BillingReadService],
})
export class BillingReadModule {}
