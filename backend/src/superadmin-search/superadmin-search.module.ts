import { Module } from '@nestjs/common';
import { SuperadminSearchController } from './superadmin-search.controller';
import { SuperadminSearchService } from './superadmin-search.service';

@Module({
  controllers: [SuperadminSearchController],
  providers: [SuperadminSearchService],
})
export class SuperadminSearchModule {}
