import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import type { Request } from 'express';

function extractJwtFromCookie(req: Request): string | null {
  const cookieHeader = req?.headers?.cookie;
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';').map((chunk) => chunk.trim());
  const accessCookie = parts.find((chunk) => chunk.startsWith('accessToken='));
  if (!accessCookie) return null;
  const token = accessCookie.slice('accessToken='.length);
  return token || null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        extractJwtFromCookie,
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: { sub: string; userId?: string; email: string; role: string; platformRole?: string; organizationId?: string }) {
    const user = await this.prisma.user.findFirst({
      where: { id: payload.userId || payload.sub, isActive: true, deletedAt: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        platformRole: true,
        isActive: true,
        isDemoUser: true,
        preferredLanguage: true,
        organizationId: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Sesiunea a expirat. Te rugăm să te autentifici din nou.',
      });
    }

    return {
      ...user,
      sub: user.id,
    };
  }
}
