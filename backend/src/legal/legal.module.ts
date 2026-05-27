import { Module } from '@nestjs/common';
import { PublicLegalController, SuperadminLegalController } from './legal.controller';
import { LegalService } from './legal.service';

@Module({
  controllers: [PublicLegalController, SuperadminLegalController],
  providers: [LegalService],
})
export class LegalModule {}
