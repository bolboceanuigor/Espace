import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

type LoginBody = {
  email?: string;
  password?: string;
};

type MinimalJwtPayload = {
  sub: string;
  email: string;
  role: string;
  organizationId: string;
};

@Injectable()
export class MinimalAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private userSelect() {
    return {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      organizationId: true,
      passwordHash: true,
      isActive: true,
      deletedAt: true,
      organization: {
        select: {
          id: true,
          name: true,
        },
      },
    };
  }

  private safeUser(user: any) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      organizationId: user.organizationId,
      organization: user.organization
        ? {
            id: user.organization.id,
            name: user.organization.name,
          }
        : null,
    };
  }

  async login(body: LoginBody) {
    const email = body.email?.trim().toLowerCase();
    const password = body.password;

    if (!email || !password) {
      throw new BadRequestException({
        code: 'AUTH_FIELDS_REQUIRED',
        message: 'Emailul și parola sunt obligatorii.',
      });
    }

    try {
      const user = await this.prisma.user.findFirst({
        where: {
          email,
          deletedAt: null,
        },
        select: this.userSelect(),
      });

      if (!user) {
        throw new NotFoundException({
          code: 'ACCOUNT_NOT_FOUND',
          message: 'Nu există cont cu acest email.',
        });
      }

      if (!user.isActive || !user.passwordHash) {
        throw new UnauthorizedException({
          code: 'INVALID_CREDENTIALS',
          message: 'Parola nu este corectă.',
        });
      }

      const passwordMatches = await bcrypt.compare(password, user.passwordHash);
      if (!passwordMatches) {
        throw new UnauthorizedException({
          code: 'WRONG_PASSWORD',
          message: 'Parola nu este corectă.',
        });
      }

      const payload: MinimalJwtPayload = {
        sub: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
      };

      const accessToken = await this.jwtService.signAsync(payload);

      return {
        accessToken,
        user: this.safeUser(user),
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      throw new InternalServerErrorException({
        code: 'AUTH_LOGIN_FAILED',
        message: 'A apărut o eroare. Încearcă din nou.',
      });
    }
  }

  async me(authorization?: string) {
    const token = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : '';
    if (!token) {
      throw new UnauthorizedException({
        code: 'TOKEN_REQUIRED',
        message: 'Tokenul lipsește.',
      });
    }

    try {
      const payload = await this.jwtService.verifyAsync<MinimalJwtPayload>(token);
      const user = await this.prisma.user.findFirst({
        where: {
          id: payload.sub,
          deletedAt: null,
          isActive: true,
        },
        select: this.userSelect(),
      });

      if (!user) {
        throw new UnauthorizedException({
          code: 'INVALID_TOKEN',
          message: 'Sesiunea nu mai este validă.',
        });
      }

      return {
        user: this.safeUser(user),
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException({
        code: 'INVALID_TOKEN',
        message: 'Sesiunea nu mai este validă.',
      });
    }
  }
}
