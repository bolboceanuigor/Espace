import { Module } from '@nestjs/common';
import { LaunchControlController } from './launch-control.controller';
import { LaunchControlService } from './launch-control.service';

@Module({
  controllers: [LaunchControlController],
  providers: [LaunchControlService],
})
export class LaunchControlModule {}
