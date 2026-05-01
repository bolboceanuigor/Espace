import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LimitsController } from './limits.controller';
import { LimitsService } from './limits.service';

@Module({
  imports: [PrismaModule],
  controllers: [LimitsController],
  providers: [LimitsService],
  exports: [LimitsService],
})
export class LimitsModule {}

