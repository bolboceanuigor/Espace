import { Module } from '@nestjs/common';
import { ResidentDemoController } from './resident-demo.controller';
import { ResidentDemoService } from './resident-demo.service';
import { MvpSecurityModule } from '../security/mvp-security.module';
import { ActivityMvpModule } from '../activity-mvp/activity-mvp.module';

@Module({
  imports: [MvpSecurityModule, ActivityMvpModule],
  controllers: [ResidentDemoController],
  providers: [ResidentDemoService],
})
export class ResidentDemoModule {}
