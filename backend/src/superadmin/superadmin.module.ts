import { Module } from '@nestjs/common';
import { SuperadminController } from './superadmin.controller';
import { SuperadminService } from './superadmin.service';
import { SuperAdminGuard } from '../auth/guards/superadmin.guard';

@Module({
  controllers: [SuperadminController],
  providers: [SuperadminService, SuperAdminGuard],
})
export class SuperadminModule {}

