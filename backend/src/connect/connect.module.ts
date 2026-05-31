import { Module } from '@nestjs/common';
import { AssociationContextModule } from '../association-context/association-context.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MvpSecurityModule } from '../security/mvp-security.module';
import { ConnectController } from './connect.controller';
import { ConnectService } from './connect.service';

@Module({
  imports: [PrismaModule, AuthModule, AssociationContextModule, NotificationsModule, MvpSecurityModule],
  controllers: [ConnectController],
  providers: [ConnectService],
  exports: [ConnectService],
})
export class ConnectModule {}
