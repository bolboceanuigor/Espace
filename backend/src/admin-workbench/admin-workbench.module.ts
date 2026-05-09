import { Module } from '@nestjs/common';
import { MvpSecurityModule } from '../security/mvp-security.module';
import { AdminWorkbenchController } from './admin-workbench.controller';
import { AdminWorkbenchService } from './admin-workbench.service';

@Module({
  imports: [MvpSecurityModule],
  controllers: [AdminWorkbenchController],
  providers: [AdminWorkbenchService],
})
export class AdminWorkbenchModule {}
