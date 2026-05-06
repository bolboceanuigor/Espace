import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SaasManagementController } from './saas-management.controller';
import { SaasManagementService } from './saas-management.service';

@Module({
  imports: [PrismaModule],
  controllers: [SaasManagementController],
  providers: [SaasManagementService],
})
export class SaasManagementModule {}
