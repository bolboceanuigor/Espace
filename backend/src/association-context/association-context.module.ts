import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminAssociationGuard } from './admin-association.guard';
import { AssociationContextController } from './association-context.controller';
import { AssociationContextService } from './association-context.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AssociationContextController],
  providers: [AssociationContextService, AdminAssociationGuard],
  exports: [AssociationContextService, AdminAssociationGuard],
})
export class AssociationContextModule {}
