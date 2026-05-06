import { Module } from '@nestjs/common';
import { ResidentDemoController } from './resident-demo.controller';
import { ResidentDemoService } from './resident-demo.service';

@Module({
  controllers: [ResidentDemoController],
  providers: [ResidentDemoService],
})
export class ResidentDemoModule {}
