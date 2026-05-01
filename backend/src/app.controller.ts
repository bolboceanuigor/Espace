import { Controller, Get, NotFoundException } from '@nestjs/common';
import { Public } from './auth/decorators/public.decorator';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  getHello(): string {
    return 'Espace PMS API';
  }

  @Public()
  @Get('health')
  async getHealth() {
    const timestamp = new Date().toISOString();
    let databaseStatus: 'UP' | 'DOWN' = 'UP';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      databaseStatus = 'DOWN';
    }
    return {
      status: databaseStatus === 'UP' ? 'ok' : 'degraded',
      timestamp,
      database: databaseStatus,
      version: process.env.APP_VERSION || process.env.npm_package_version || 'dev',
      environment: process.env.NODE_ENV || 'development',
    };
  }

  @Public()
  @Get('api/health')
  async getApiHealth() {
    const time = new Date().toISOString();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true, time };
    } catch {
      return { ok: false, time };
    }
  }

  @Public()
  @Get('api/debug/env')
  getDebugEnv() {
    if (process.env.NODE_ENV === 'production') {
      throw new NotFoundException();
    }
    return {
      nodeEnv: process.env.NODE_ENV || 'development',
      frontendUrl: process.env.FRONTEND_URL || null,
      appUrl: process.env.APP_URL || null,
      corsEnabled: true,
      cookieSecure:
        (process.env.COOKIE_SECURE ?? (process.env.NODE_ENV === 'production' ? 'true' : 'false')).toLowerCase() ===
        'true',
    };
  }

  @Public()
  @Get('api/version')
  getVersion() {
    return {
      version: process.env.npm_package_version || 'dev',
      commit: process.env.COMMIT_SHA || null,
    };
  }
}
