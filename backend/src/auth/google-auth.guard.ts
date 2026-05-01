import { ExecutionContext, Injectable, NotImplementedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  canActivate(context: ExecutionContext) {
    const enabled = (process.env.ENABLE_GOOGLE_AUTH ?? 'false').toLowerCase() === 'true';
    if (!enabled) {
      throw new NotImplementedException({
        code: 'GOOGLE_AUTH_DISABLED',
        message: 'Coming soon',
      });
    }
    return super.canActivate(context);
  }

  getAuthenticateOptions(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const locale =
      typeof req?.query?.locale === 'string' ? req.query.locale : 'ro';
    return {
      scope: ['profile', 'email'],
      state: locale,
      session: false,
      prompt: 'select_account',
    };
  }
}
