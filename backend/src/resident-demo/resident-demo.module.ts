import { Module } from '@nestjs/common';
import { ResidentDemoController } from './resident-demo.controller';
import { ResidentDemoService } from './resident-demo.service';
import { MvpSecurityModule } from '../security/mvp-security.module';
import { ActivityMvpModule } from '../activity-mvp/activity-mvp.module';
import { MetersModule } from '../meters/meters.module';

@Module({
  imports: [MvpSecurityModule, ActivityMvpModule, MetersModule],
  controllers: [ResidentDemoController],
  providers: [ResidentDemoService],
})
export class ResidentDemoModule {}
