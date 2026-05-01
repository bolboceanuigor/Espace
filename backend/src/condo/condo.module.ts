import { Module } from '@nestjs/common';
import { CondoController } from './condo.controller';
import { CondoService } from './condo.service';

@Module({
  controllers: [CondoController],
  providers: [CondoService],
  exports: [CondoService],
})
export class CondoModule {}
