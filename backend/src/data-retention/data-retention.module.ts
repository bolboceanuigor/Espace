import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminDataRetentionController, SuperadminDataRetentionController } from './data-retention.controller';
import { DataRetentionService } from './data-retention.service';

@Module({
  imports: [PrismaModule],
  controllers: [SuperadminDataRetentionController, AdminDataRetentionController],
  providers: [DataRetentionService],
  exports: [DataRetentionService],
})
export class DataRetentionModule {}
