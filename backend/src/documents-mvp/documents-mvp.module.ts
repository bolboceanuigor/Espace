import { Module } from '@nestjs/common';
import { ActivityMvpModule } from '../activity-mvp/activity-mvp.module';
import { MvpSecurityModule } from '../security/mvp-security.module';
import { DocumentsMvpController } from './documents-mvp.controller';
import { DocumentsMvpService } from './documents-mvp.service';

@Module({
  imports: [MvpSecurityModule, ActivityMvpModule],
  controllers: [DocumentsMvpController],
  providers: [DocumentsMvpService],
})
export class DocumentsMvpModule {}
