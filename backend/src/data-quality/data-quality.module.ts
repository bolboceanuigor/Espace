import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MvpSecurityModule } from '../security/mvp-security.module';
import { DataQualityController } from './data-quality.controller';
import { DataQualityService } from './data-quality.service';
import { DuplicateDetectionService } from './duplicates.service';
import { SaasUsageModule } from '../saas-usage/saas-usage.module';

@Module({
  imports: [PrismaModule, MvpSecurityModule, AuditModule, SaasUsageModule],
  controllers: [DataQualityController],
  providers: [DataQualityService, DuplicateDetectionService],
  exports: [DataQualityService, DuplicateDetectionService],
})
export class DataQualityModule {}
