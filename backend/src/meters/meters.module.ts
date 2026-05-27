import { Module } from '@nestjs/common';
import { MetersController } from './meters.controller';
import { MetersService } from './meters.service';
import { MvpSecurityModule } from '../security/mvp-security.module';
import { ActivityMvpModule } from '../activity-mvp/activity-mvp.module';
import { SaasUsageModule } from '../saas-usage/saas-usage.module';

@Module({
  imports: [MvpSecurityModule, ActivityMvpModule, SaasUsageModule],
  controllers: [MetersController],
  providers: [MetersService],
  exports: [MetersService],
})
export class MetersModule {}
