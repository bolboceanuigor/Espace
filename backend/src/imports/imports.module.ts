import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { MvpSecurityModule } from '../security/mvp-security.module';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';

@Module({
  imports: [PrismaModule, AuditModule, MvpSecurityModule],
  controllers: [ImportsController],
  providers: [ImportsService],
})
export class ImportsModule {}
