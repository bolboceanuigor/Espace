import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { LimitsModule } from '../limits/limits.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminStructureController } from './admin-structure.controller';
import { AdminStructureService } from './admin-structure.service';

@Module({
  imports: [PrismaModule, AuditModule, LimitsModule],
  controllers: [AdminStructureController],
  providers: [AdminStructureService],
})
export class AdminStructureModule {}
