import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RbacDashboardController } from './rbac-dashboard.controller';
import { RbacDashboardService } from './rbac-dashboard.service';

@Module({
  imports: [PrismaModule],
  controllers: [RbacDashboardController],
  providers: [RbacDashboardService],
})
export class RbacDashboardModule {}
