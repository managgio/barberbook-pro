import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
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
  const app = await NestFactory.create(AppModule, { cors: true });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
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
