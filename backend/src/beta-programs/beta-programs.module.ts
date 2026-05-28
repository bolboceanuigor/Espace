import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BetaProgramsController } from './beta-programs.controller';
import { BetaProgramsService } from './beta-programs.service';

@Module({
  imports: [PrismaModule],
  controllers: [BetaProgramsController],
  providers: [BetaProgramsService],
})
export class BetaProgramsModule {}
