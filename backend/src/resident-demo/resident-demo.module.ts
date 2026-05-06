import { Module } from '@nestjs/common';
import { ResidentDemoController } from './resident-demo.controller';
import { ResidentDemoService } from './resident-demo.service';
import { MvpSecurityModule } from '../security/mvp-security.module';

@Module({
  imports: [MvpSecurityModule],
  controllers: [ResidentDemoController],
  providers: [ResidentDemoService],
})
export class ResidentDemoModule {}
