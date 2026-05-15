import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const port = process.env['APP_PORT'] || 3100;

  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`🚀 WA-Sent Automation running on port ${port}`);
  logger.log(`📋 Environment: ${process.env['NODE_ENV'] || 'development'}`);
}

bootstrap();
