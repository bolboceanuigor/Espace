import { Module } from '@nestjs/common';
import { CustomerRequestsService } from './customer-requests.service';
import { PublicCustomerRequestsController, SuperadminCustomerRequestsController } from './customer-requests.controller';

@Module({
  controllers: [PublicCustomerRequestsController, SuperadminCustomerRequestsController],
  providers: [CustomerRequestsService],
})
export class CustomerRequestsModule {}
