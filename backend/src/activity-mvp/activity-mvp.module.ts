import { Module } from '@nestjs/common';
import { MvpSecurityModule } from '../security/mvp-security.module';
import { ActivityMvpController } from './activity-mvp.controller';
import { ActivityMvpService } from './activity-mvp.service';

@Module({
  imports: [MvpSecurityModule],
  controllers: [ActivityMvpController],
  providers: [ActivityMvpService],
  exports: [ActivityMvpService],
})
export class ActivityMvpModule {}
