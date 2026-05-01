import { Module } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { PublicLeadsController } from './public-leads.controller';
import { SuperadminLeadsController } from './superadmin-leads.controller';

@Module({
  controllers: [PublicLeadsController, SuperadminLeadsController],
  providers: [LeadsService],
})
export class LeadsModule {}

