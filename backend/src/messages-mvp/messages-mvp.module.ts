import { Module } from '@nestjs/common';
import { MvpSecurityModule } from '../security/mvp-security.module';
import { MessagesMvpController } from './messages-mvp.controller';
import { MessagesMvpService } from './messages-mvp.service';

@Module({
  imports: [MvpSecurityModule],
  controllers: [MessagesMvpController],
  providers: [MessagesMvpService],
})
export class MessagesMvpModule {}
