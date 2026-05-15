import { Module } from '@nestjs/common';
import { ReportSchedulerService } from './report-scheduler.service.js';
import { WhatsappModule } from '../whatsapp/whatsapp.module.js';
import { ScreenshotModule } from '../screenshot/screenshot.module.js';

import { SchedulerController } from './scheduler.controller.js';

@Module({
  imports: [WhatsappModule, ScreenshotModule],
  providers: [ReportSchedulerService],
  controllers: [SchedulerController],
})
export class SchedulerModule {}
