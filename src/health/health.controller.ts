import { Controller, Get } from '@nestjs/common';
import { WhatsappService } from '../whatsapp/whatsapp.service.js';

/**
 * Health Controller
 * Endpoint monitoring untuk PM2 / load balancer
 */
@Controller('health')
export class HealthController {
  constructor(private readonly whatsappService: WhatsappService) {}

  /**
   * GET /health
   * Health check endpoint
   */
  @Get()
  check() {
    const waStatus = this.whatsappService.getConnectionStatus();

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        heapUsed: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)} MB`,
        heapTotal: `${(process.memoryUsage().heapTotal / 1024 / 1024).toFixed(1)} MB`,
        rss: `${(process.memoryUsage().rss / 1024 / 1024).toFixed(1)} MB`,
      },
      whatsapp: waStatus,
    };
  }
}
