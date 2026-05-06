import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SaasManagementController } from './saas-management.controller';
import { SaasManagementService } from './saas-management.service';
import { MvpSecurityModule } from '../security/mvp-security.module';

@Module({
  imports: [PrismaModule, MvpSecurityModule],
  controllers: [SaasManagementController],
  providers: [SaasManagementService],
})
export class SaasManagementModule {}
