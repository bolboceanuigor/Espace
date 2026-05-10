import { Module } from '@nestjs/common';
import { AdminResidentsController } from './admin-residents.controller';
import { ResidentsController } from './residents.controller';
import { ResidentsService } from './residents.service';
import { MvpSecurityModule } from '../security/mvp-security.module';
import { ActivityMvpModule } from '../activity-mvp/activity-mvp.module';

@Module({
  imports: [MvpSecurityModule, ActivityMvpModule],
  controllers: [ResidentsController, AdminResidentsController],
  providers: [ResidentsService],
})
export class ResidentsModule {}
