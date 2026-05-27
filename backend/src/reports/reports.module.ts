import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { SaasUsageModule } from '../saas-usage/saas-usage.module';

@Module({
  imports: [PrismaModule, SaasUsageModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
