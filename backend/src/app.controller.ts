import { Controller, Get, NotFoundException } from '@nestjs/common';
import { Public } from './auth/decorators/public.decorator';
import { PrismaService } from './prisma/prisma.service';
import { SystemMonitoringService } from './system-monitoring/system-monitoring.service';

function getAppVersion() {
  return process.env.APP_VERSION || process.env.npm_package_version || '0.1.0-beta';
}

@Controller()
export class AppController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly monitoring: SystemMonitoringService,
  ) {}

  @Public()
  @Get()
  getHello(): string {
    return 'Espace condominium management API';
  }

  @Public()
  @Get('health')
  getHealth() {
    return this.monitoring.getHealth();
  }

  @Public()
  @Get('health/db')
  async getDatabaseHealth() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const [organizations, users, apartments] = await Promise.all([
        this.prisma.organization.count(),
        this.prisma.user.count(),
        this.prisma.apartment.count(),
      ]);

      return {
        status: 'ok',
        database: 'connected',
        counts: {
          organizations,
          users,
          apartments,
        },
      };
    } catch {
      return {
        status: 'error',
        database: 'unavailable',
      };
    }
  }

  @Public()
  @Get('api/health')
  async getApiHealth() {
    return this.monitoring.getHealth();
  }

  @Public()
  @Get('api/health/liveness')
  getApiLiveness() {
    return this.monitoring.getLiveness();
  }

  @Public()
  @Get('api/health/readiness')
  getApiReadiness() {
    return this.monitoring.getReadiness();
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
