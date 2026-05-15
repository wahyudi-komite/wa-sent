import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { WhatsappModule } from './whatsapp/whatsapp.module.js';
import { ScreenshotModule } from './screenshot/screenshot.module.js';
import { SchedulerModule } from './scheduler/scheduler.module.js';
import { HealthModule } from './health/health.module.js';
import { LoggerModule } from './logger/logger.module.js';

@Module({
  imports: [
    // Load .env config globally
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // NestJS scheduler
    ScheduleModule.forRoot(),

    // Custom modules
    LoggerModule,
    WhatsappModule,
    ScreenshotModule,
    SchedulerModule,
    HealthModule,
  ],
})
export class AppModule {}
