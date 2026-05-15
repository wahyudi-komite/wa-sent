import { Controller, Get } from '@nestjs/common';
import { ReportSchedulerService } from './report-scheduler.service.js';

@Controller('scheduler')
export class SchedulerController {
  constructor(private readonly reportSchedulerService: ReportSchedulerService) {}

  /**
   * GET /scheduler/trigger
   * Memicu pengiriman report secara manual via URL
   */
  @Get('trigger')
  async triggerManual() {
    // Jalankan secara asynchronous (tidak menunggu selesai agar browser tidak timeout)
    this.reportSchedulerService.handleScheduledReport();
    
    return {
      status: 'success',
      message: 'Report job has been triggered manually. Check your WhatsApp and logs.',
      timestamp: new Date().toISOString(),
    };
  }
}
