import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BulkOperationsController } from './bulk-operations.controller';
import { BulkOperationsService } from './bulk-operations.service';

@Module({
  imports: [PrismaModule],
  controllers: [BulkOperationsController],
  providers: [BulkOperationsService],
})
export class BulkOperationsModule {}
