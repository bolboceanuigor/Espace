import { Module } from '@nestjs/common';
import { AdminResidentsController } from './admin-residents.controller';
import { ResidentsController } from './residents.controller';
import { ResidentsService } from './residents.service';
import { MvpSecurityModule } from '../security/mvp-security.module';
import { ActivityMvpModule } from '../activity-mvp/activity-mvp.module';
import { SaasUsageModule } from '../saas-usage/saas-usage.module';

@Module({
  imports: [MvpSecurityModule, ActivityMvpModule, SaasUsageModule],
  controllers: [ResidentsController, AdminResidentsController],
  providers: [ResidentsService],
})
export class ResidentsModule {}
