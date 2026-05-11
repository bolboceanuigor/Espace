import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { MvpAuthGuard, MvpRolesGuard } from './mvp-auth.guard';

@Global()
@Module({
  imports: [
    PrismaModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN') || '7d',
        },
      }),
    }),
  ],
  providers: [MvpAuthGuard, MvpRolesGuard],
  exports: [JwtModule, MvpAuthGuard, MvpRolesGuard],
})
export class MvpSecurityModule {}
