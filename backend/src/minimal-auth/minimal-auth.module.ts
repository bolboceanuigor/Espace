import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthSecurityService } from '../auth/auth-security.service';
import { MinimalAuthController } from './minimal-auth.controller';
import { MinimalAuthService } from './minimal-auth.service';

@Module({
  imports: [
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
  controllers: [MinimalAuthController],
  providers: [MinimalAuthService, AuthSecurityService],
})
export class MinimalAuthModule {}
