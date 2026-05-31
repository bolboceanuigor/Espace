import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { CustomerRequestsService } from './customer-requests.service';
import { PublicCustomerRequestsController, SuperadminCustomerRequestsController } from './customer-requests.controller';

@Module({
  imports: [AuditModule],
  controllers: [PublicCustomerRequestsController, SuperadminCustomerRequestsController],
  providers: [CustomerRequestsService],
})
export class CustomerRequestsModule {}
