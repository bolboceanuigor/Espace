import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ReleaseNotesController } from './release-notes.controller';
import { ReleaseNotesService } from './release-notes.service';

@Module({
  imports: [PrismaModule],
  controllers: [ReleaseNotesController],
  providers: [ReleaseNotesService],
})
export class ReleaseNotesModule {}
