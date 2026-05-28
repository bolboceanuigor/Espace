import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SavedViewsController } from './saved-views.controller';
import { SavedViewsService } from './saved-views.service';

@Module({
  imports: [PrismaModule],
  controllers: [SavedViewsController],
  providers: [SavedViewsService],
})
export class SavedViewsModule {}
