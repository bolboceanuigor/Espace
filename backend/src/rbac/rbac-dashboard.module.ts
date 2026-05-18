import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AssociationContextModule } from '../association-context/association-context.module';
import { RbacDashboardController } from './rbac-dashboard.controller';
import { RbacDashboardService } from './rbac-dashboard.service';

@Module({
  imports: [PrismaModule, AssociationContextModule],
  controllers: [RbacDashboardController],
  providers: [RbacDashboardService],
})
export class RbacDashboardModule {}
