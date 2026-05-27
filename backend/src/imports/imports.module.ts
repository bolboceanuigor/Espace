import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { MvpSecurityModule } from '../security/mvp-security.module';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';
import { SaasUsageModule } from '../saas-usage/saas-usage.module';

@Module({
  imports: [PrismaModule, AuditModule, MvpSecurityModule, SaasUsageModule],
  controllers: [ImportsController],
  providers: [ImportsService],
})
export class ImportsModule {}
