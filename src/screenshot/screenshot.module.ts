import { Module } from '@nestjs/common';
import { ScreenshotService } from './screenshot.service.js';

@Module({
  providers: [ScreenshotService],
  exports: [ScreenshotService],
})
export class ScreenshotModule {}
