import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AssociationContextModule } from '../association-context/association-context.module';
import { AdminRbacController } from './admin-rbac.controller';
import { AdminRbacService } from './admin-rbac.service';
import { StaffInvitationsPublicController } from './staff-invitations-public.controller';
import { TeamActivityRiskService } from './team-activity-risk.service';

@Module({
  imports: [PrismaModule, AuthModule, AuditModule, AssociationContextModule],
  controllers: [AdminRbacController, StaffInvitationsPublicController],
  providers: [AdminRbacService, TeamActivityRiskService],
  exports: [AdminRbacService],
})
export class AdminRbacModule {}
