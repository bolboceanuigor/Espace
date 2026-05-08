import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MvpSecurityModule } from '../security/mvp-security.module';
import { InvitationsMvpController } from './invitations-mvp.controller';
import { InvitationsMvpService } from './invitations-mvp.service';

@Module({
  imports: [PrismaModule, MvpSecurityModule],
  controllers: [InvitationsMvpController],
  providers: [InvitationsMvpService],
})
export class InvitationsMvpModule {}
