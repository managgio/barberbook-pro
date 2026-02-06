import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { raw } from 'express';
import { AppModule } from './app.module';

// Silencia errores de extensiones que intentan conectarse al proceso (p.ej. console-ninja)
process.on('uncaughtException', (err) => {
  if ((err as any)?.code === 'EPERM' && (err as any)?.address === '127.0.0.1') {
    console.warn('Aviso: se ignoró un intento de conexión local (extensión dev).');
    return;
  }
  throw err;
});

process.on('unhandledRejection', (err: any) => {
  if (err?.code === 'EPERM' && err?.address === '127.0.0.1') {
    console.warn('Aviso: se ignoró un intento de conexión local (extensión dev).');
    return;
  }
  console.error('Unhandled rejection:', err);
});

async function bootstrap() {
  const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const isProduction = (process.env.NODE_ENV || '').toLowerCase() === 'production';
  const corsConfig =
    allowedOrigins.length === 0
      ? true
      : {
          origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
            if (!origin) {
              callback(null, true);
              return;
            }
            const isAllowed = allowedOrigins.includes(origin);
            callback(isAllowed ? null : new Error('Not allowed by CORS'), isAllowed);
          },
          credentials: true,
        };

  if (isProduction && allowedOrigins.length === 0) {
    console.warn('CORS allowlist no configurada (CORS_ALLOWED_ORIGINS). Se mantiene modo permissive.');
  }

  const app = await NestFactory.create(AppModule, { cors: corsConfig, rawBody: true });

  app.use('/api/payments/stripe/webhook', raw({ type: '*/*' }));
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const port = process.env.PORT || 3000;
  await app.listen(port as number);
  console.log(`🚀 Backend running on port ${port}`);
}

bootstrap();
