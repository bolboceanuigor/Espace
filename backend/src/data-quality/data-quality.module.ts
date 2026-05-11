import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MvpSecurityModule } from '../security/mvp-security.module';
import { DataQualityController } from './data-quality.controller';
import { DataQualityService } from './data-quality.service';

@Module({
  imports: [PrismaModule, MvpSecurityModule, AuditModule],
  controllers: [DataQualityController],
  providers: [DataQualityService],
  exports: [DataQualityService],
})
export class DataQualityModule {}
