import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from '../email/email.module';
import { ResidentAccessModule } from '../resident-access/resident-access.module';
import { MvpSecurityModule } from '../security/mvp-security.module';
import { AuditModule } from '../audit/audit.module';
import { InvitationsMvpController } from './invitations-mvp.controller';
import { InvitationsMvpService } from './invitations-mvp.service';

@Module({
  imports: [PrismaModule, MvpSecurityModule, EmailModule, ResidentAccessModule, AuditModule],
  controllers: [InvitationsMvpController],
  providers: [InvitationsMvpService],
})
export class InvitationsMvpModule {}
