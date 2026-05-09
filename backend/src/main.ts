import { BadRequestException, ValidationError, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import helmet from 'helmet';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor';
import { assertProductionCorsIsSafe, corsOriginCallback } from './common/cors/origin';

async function bootstrap() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required');
  }
  if (!process.env.FRONTEND_URL && !process.env.CORS_ORIGIN) {
    throw new Error('FRONTEND_URL or CORS_ORIGIN is required');
  }
  const app = await NestFactory.create(AppModule);
  const expressApp = app.getHttpAdapter().getInstance();
  const trustProxyRaw = (process.env.TRUST_PROXY ?? 'false').toLowerCase();
  const trustProxy = trustProxyRaw === 'true' || trustProxyRaw === '1';
  if (trustProxy) {
    expressApp.set('trust proxy', 1);
  }
  app.use(helmet());
  const logHttp =
    (process.env.LOG_HTTP ?? (process.env.NODE_ENV === 'production' ? 'false' : 'true')).toLowerCase() ===
    'true';
  if (logHttp) {
    app.use((req, res, next) => {
      const startedAt = Date.now();
      res.on('finish', () => {
        const elapsedMs = Date.now() - startedAt;
        console.log(
          JSON.stringify({
            level: 'info',
            type: 'http',
            method: req.method,
            path: req.originalUrl,
            status: res.statusCode,
            elapsedMs,
            timestamp: new Date().toISOString(),
          }),
        );
      });
      next();
    });
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors: ValidationError[]) => {
        const details = errors.flatMap((error) => {
          const constraints = error.constraints ? Object.values(error.constraints) : [];
          return constraints.map((message) => ({
            field: error.property,
            message,
          }));
        });
        return new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Datele trimise nu sunt valide.',
          details,
        });
      },
    }),
  );

  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  assertProductionCorsIsSafe();

  app.enableCors({
    origin: corsOriginCallback,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-org-id'],
  });

  const port = Number(process.env.PORT || 4000);
  await app.listen(port, '0.0.0.0');
  const publicApiUrl = process.env.API_URL?.replace(/\/+$/, '');
  console.log(`API listening on ${publicApiUrl || `http://localhost:${port}`}`);
}
bootstrap();
