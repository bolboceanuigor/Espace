import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { LimitsModule } from '../limits/limits.module';
import { PrismaModule } from '../prisma/prisma.module';
import { FileDownloadController, FilesController } from './files.controller';
import { FilesService } from './files.service';

@Module({
  imports: [PrismaModule, LimitsModule, AuditModule],
  controllers: [FilesController, FileDownloadController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}

