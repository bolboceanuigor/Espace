import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { AssociationChatController } from './association-chat.controller';
import { AssociationChatService } from './association-chat.service';

@Module({
  imports: [EventsModule],
  controllers: [AssociationChatController],
  providers: [AssociationChatService],
})
export class AssociationChatModule {}
