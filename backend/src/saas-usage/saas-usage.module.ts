import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SaasLimitEnforcementService } from './saas-limit-enforcement.service';
import { SaasUsageController } from './saas-usage.controller';
import { SaasUsageService } from './saas-usage.service';

@Module({
  imports: [PrismaModule],
  controllers: [SaasUsageController],
  providers: [SaasUsageService, SaasLimitEnforcementService],
  exports: [SaasUsageService, SaasLimitEnforcementService],
})
export class SaasUsageModule {}
