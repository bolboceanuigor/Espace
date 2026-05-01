import { Module } from '@nestjs/common';
import { MeController } from './me.controller';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { NavigationService } from './navigation.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [MeController],
  providers: [NavigationService],
})
export class MeModule {}

