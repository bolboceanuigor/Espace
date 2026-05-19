import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminAssociationGuard } from './admin-association.guard';
import { AssociationContextController } from './association-context.controller';
import { AssociationContextService } from './association-context.service';
import { SupportSessionContextService } from './support-session-context.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AssociationContextController],
  providers: [AssociationContextService, SupportSessionContextService, AdminAssociationGuard],
  exports: [AssociationContextService, SupportSessionContextService, AdminAssociationGuard],
})
export class AssociationContextModule {}
