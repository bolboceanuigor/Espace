import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { LimitsModule } from '../limits/limits.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MvpSecurityModule } from '../security/mvp-security.module';
import { FileDownloadController, FilesController } from './files.controller';
import { FilesService } from './files.service';

@Module({
  imports: [PrismaModule, LimitsModule, AuditModule, MvpSecurityModule],
  controllers: [FilesController, FileDownloadController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}
