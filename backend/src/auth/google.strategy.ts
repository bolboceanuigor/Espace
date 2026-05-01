import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(configService: ConfigService) {
    const googleClientId = configService.get<string>('GOOGLE_CLIENT_ID');
    const googleClientSecret = configService.get<string>('GOOGLE_CLIENT_SECRET');
    const googleCallbackUrl = configService.get<string>('GOOGLE_CALLBACK_URL');
    const apiUrl = (configService.get<string>('API_URL') || '').replace(/\/+$/, '');

    super({
      // Keep strategy bootable even when Google auth is disabled.
      clientID: googleClientId || 'google-auth-disabled-client-id',
      clientSecret: googleClientSecret || 'google-auth-disabled-client-secret',
      callbackURL: googleCallbackUrl || (apiUrl ? `${apiUrl}/api/auth/google/callback` : 'http://localhost:3001/api/auth/google/callback'),
      scope: ['email', 'profile'],
      passReqToCallback: false,
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    const email = profile.emails?.[0]?.value;
    const firstName = profile.name?.givenName || null;
    const lastName = profile.name?.familyName || null;

    done(null, {
      email,
      firstName,
      lastName,
      googleSub: profile.id,
    });
  }
}
