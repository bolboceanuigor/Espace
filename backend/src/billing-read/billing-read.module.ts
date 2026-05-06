import { Module } from '@nestjs/common';
import { BillingReadController } from './billing-read.controller';
import { BillingReadService } from './billing-read.service';
import { MvpSecurityModule } from '../security/mvp-security.module';

@Module({
  imports: [MvpSecurityModule],
  controllers: [BillingReadController],
  providers: [BillingReadService],
})
export class BillingReadModule {}
