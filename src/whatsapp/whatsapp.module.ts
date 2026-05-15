import { Module } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service.js';
import { WhatsappController } from './whatsapp.controller.js';

@Module({
  providers: [WhatsappService],
  controllers: [WhatsappController],
  exports: [WhatsappService],
})
export class WhatsappModule {}
