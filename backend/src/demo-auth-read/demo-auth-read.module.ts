import { Module } from '@nestjs/common';
import { DemoAuthReadController } from './demo-auth-read.controller';
import { DemoAuthReadService } from './demo-auth-read.service';

@Module({
  controllers: [DemoAuthReadController],
  providers: [DemoAuthReadService],
})
export class DemoAuthReadModule {}
