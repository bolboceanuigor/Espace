import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminRbacController } from './admin-rbac.controller';
import { AdminRbacService } from './admin-rbac.service';

@Module({
  imports: [PrismaModule, AuthModule, AuditModule],
  controllers: [AdminRbacController],
  providers: [AdminRbacService],
  exports: [AdminRbacService],
})
export class AdminRbacModule {}
