import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BackupRecoveryController } from './backup-recovery.controller';
import { BackupRecoveryService } from './backup-recovery.service';

@Module({
  imports: [PrismaModule],
  controllers: [BackupRecoveryController],
  providers: [BackupRecoveryService],
  exports: [BackupRecoveryService],
})
export class BackupRecoveryModule {}
