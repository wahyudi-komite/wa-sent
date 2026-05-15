import { Module, Global } from '@nestjs/common';
import { AppLoggerService } from './logger.service.js';

@Global()
@Module({
  providers: [AppLoggerService],
  exports: [AppLoggerService],
})
export class LoggerModule {}
