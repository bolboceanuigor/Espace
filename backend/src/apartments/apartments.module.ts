import { Module } from '@nestjs/common';
import { ApartmentsController } from './apartments.controller';
import { AdminApartmentsController } from './admin-apartments.controller';
import { ApartmentsService } from './apartments.service';
import { MvpSecurityModule } from '../security/mvp-security.module';
import { ActivityMvpModule } from '../activity-mvp/activity-mvp.module';
import { SaasUsageModule } from '../saas-usage/saas-usage.module';

@Module({
  imports: [MvpSecurityModule, ActivityMvpModule, SaasUsageModule],
  controllers: [ApartmentsController, AdminApartmentsController],
  providers: [ApartmentsService],
})
export class ApartmentsModule {}
