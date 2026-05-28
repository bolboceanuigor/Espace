import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminDataExportController, ResidentDataExportController, SuperadminDataExportController } from './data-export.controller';
import { DataExportService } from './data-export.service';

@Module({
  imports: [PrismaModule],
  controllers: [SuperadminDataExportController, AdminDataExportController, ResidentDataExportController],
  providers: [DataExportService],
  exports: [DataExportService],
})
export class DataExportModule {}
