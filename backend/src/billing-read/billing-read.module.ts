import { Module } from '@nestjs/common';
import { BillingReadController } from './billing-read.controller';
import { BillingReadService } from './billing-read.service';

@Module({
  controllers: [BillingReadController],
  providers: [BillingReadService],
})
export class BillingReadModule {}
