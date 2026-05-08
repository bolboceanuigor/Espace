import { Module } from '@nestjs/common';
import { CommunityReadController } from './community-read.controller';
import { CommunityReadService } from './community-read.service';
import { MvpSecurityModule } from '../security/mvp-security.module';
import { ActivityMvpModule } from '../activity-mvp/activity-mvp.module';

@Module({
  imports: [MvpSecurityModule, ActivityMvpModule],
  controllers: [CommunityReadController],
  providers: [CommunityReadService],
})
export class CommunityReadModule {}
