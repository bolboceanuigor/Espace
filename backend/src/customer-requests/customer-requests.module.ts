import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { MvpSecurityModule } from '../security/mvp-security.module';
import { CustomerRequestsService } from './customer-requests.service';
import { PublicCustomerRequestsController, SuperadminCustomerRequestsController } from './customer-requests.controller';

@Module({
  imports: [AuditModule, MvpSecurityModule],
  controllers: [PublicCustomerRequestsController, SuperadminCustomerRequestsController],
  providers: [CustomerRequestsService],
})
export class CustomerRequestsModule {}
