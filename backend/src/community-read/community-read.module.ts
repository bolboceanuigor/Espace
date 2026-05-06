import { Module } from '@nestjs/common';
import { CommunityReadController } from './community-read.controller';
import { CommunityReadService } from './community-read.service';

@Module({
  controllers: [CommunityReadController],
  providers: [CommunityReadService],
})
export class CommunityReadModule {}
