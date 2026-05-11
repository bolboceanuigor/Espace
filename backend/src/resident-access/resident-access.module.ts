import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthSecurityService } from '../auth/auth-security.service';
import { PrismaModule } from '../prisma/prisma.module';
import { MvpSecurityModule } from '../security/mvp-security.module';
import { ResidentAccessController } from './resident-access.controller';
import { ResidentAccessService } from './resident-access.service';

@Module({
  imports: [PrismaModule, MvpSecurityModule, AuditModule],
  controllers: [ResidentAccessController],
  providers: [ResidentAccessService, AuthSecurityService],
  exports: [ResidentAccessService],
})
export class ResidentAccessModule {}
