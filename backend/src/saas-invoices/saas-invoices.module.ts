import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SaasInvoicesController } from './saas-invoices.controller';
import { SaasInvoicesService } from './saas-invoices.service';

@Module({
  imports: [PrismaModule],
  controllers: [SaasInvoicesController],
  providers: [SaasInvoicesService],
  exports: [SaasInvoicesService],
})
export class SaasInvoicesModule {}
