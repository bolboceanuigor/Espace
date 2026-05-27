import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SaasBillingModule } from '../saas-billing/saas-billing.module';
import { SaasUsageModule } from '../saas-usage/saas-usage.module';
import { SaasUpgradesController } from './saas-upgrades.controller';
import { SaasUpgradesService } from './saas-upgrades.service';

@Module({
  imports: [PrismaModule, SaasUsageModule, SaasBillingModule],
  controllers: [SaasUpgradesController],
  providers: [SaasUpgradesService],
  exports: [SaasUpgradesService],
})
export class SaasUpgradesModule {}
