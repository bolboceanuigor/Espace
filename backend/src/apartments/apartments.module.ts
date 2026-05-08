import { Module } from '@nestjs/common';
import { ApartmentsController } from './apartments.controller';
import { ApartmentsService } from './apartments.service';
import { MvpSecurityModule } from '../security/mvp-security.module';
import { ActivityMvpModule } from '../activity-mvp/activity-mvp.module';

@Module({
  imports: [MvpSecurityModule, ActivityMvpModule],
  controllers: [ApartmentsController],
  providers: [ApartmentsService],
})
export class ApartmentsModule {}
