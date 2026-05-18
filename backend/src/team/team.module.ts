import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';
import { LimitsModule } from '../limits/limits.module';
import { AdminRbacModule } from '../rbac/admin-rbac.module';
import { AssociationContextModule } from '../association-context/association-context.module';
import { TeamController } from './team.controller';
import { TeamService } from './team.service';

@Module({
  imports: [AuthModule, LimitsModule, EmailModule, AdminRbacModule, AssociationContextModule],
  controllers: [TeamController],
  providers: [TeamService],
})
export class TeamModule {}
