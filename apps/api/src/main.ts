import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { loadEnv } from './config/env.schema.js';

async function bootstrap(): Promise<void> {
  // Fail fast: the app must not start with invalid configuration.
  const env = loadEnv(process.env);
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: env.CORS_ORIGIN, credentials: true });
  app.enableShutdownHooks();
  await app.listen(env.PORT);
}

void bootstrap();
