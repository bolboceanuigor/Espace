import { BadRequestException, ValidationError, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import helmet from 'helmet';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor';

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
          message: 'Validation failed',
          details,
        });
      },
    }),
  );

  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  const isProd = process.env.NODE_ENV === 'production';
  const allowedOrigins = [
    'https://espace.md',
    'https://www.espace.md',
    'http://localhost:3000',
    'http://localhost:3001',
    process.env.FRONTEND_URL,
    process.env.CORS_ORIGIN,
  ]
    .flatMap((value) => (value || '').split(','))
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value, index, all) => all.indexOf(value) === index);
  if (isProd && allowedOrigins.some((origin) => origin === '*')) {
    throw new Error('CORS wildcard is not allowed in production');
  }
  const allowVercelPreviews =
    (process.env.CORS_ALLOW_VERCEL_PREVIEWS ?? 'false').toLowerCase() === 'true';
  const vercelPreviewPattern = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i;

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      if (allowVercelPreviews && vercelPreviewPattern.test(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Not allowed by CORS'));
    },
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
