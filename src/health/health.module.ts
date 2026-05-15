import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { WhatsappModule } from '../whatsapp/whatsapp.module.js';

@Module({
  imports: [WhatsappModule],
  controllers: [HealthController],
})
export class HealthModule {}
