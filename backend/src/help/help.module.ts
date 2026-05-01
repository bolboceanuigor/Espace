import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { HelpController } from './help.controller';
import { HelpService } from './help.service';
import { SuperadminHelpController } from './superadmin-help.controller';

@Module({
  imports: [PrismaModule],
  controllers: [HelpController, SuperadminHelpController],
  providers: [HelpService],
})
export class HelpModule {}

