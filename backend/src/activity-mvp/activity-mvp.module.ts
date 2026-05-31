import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { MvpSecurityModule } from '../security/mvp-security.module';
import { ActivityMvpController } from './activity-mvp.controller';
import { ActivityMvpService } from './activity-mvp.service';

@Module({
  imports: [MvpSecurityModule, AuditModule],
  controllers: [ActivityMvpController],
  providers: [ActivityMvpService],
  exports: [ActivityMvpService],
})
export class ActivityMvpModule {}
