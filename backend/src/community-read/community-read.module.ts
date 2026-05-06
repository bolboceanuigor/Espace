import { Module } from '@nestjs/common';
import { CommunityReadController } from './community-read.controller';
import { CommunityReadService } from './community-read.service';
import { MvpSecurityModule } from '../security/mvp-security.module';

@Module({
  imports: [MvpSecurityModule],
  controllers: [CommunityReadController],
  providers: [CommunityReadService],
})
export class CommunityReadModule {}
