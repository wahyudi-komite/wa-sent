import { Controller, Get, Post, Body, HttpCode, Res } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service.js';
import * as express from 'express';
import * as path from 'path';
import * as fs from 'fs';

/**
 * WhatsApp Controller
 * Endpoint untuk manual testing & monitoring
 */
@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  /**
   * GET /whatsapp/status
   * Cek status koneksi WhatsApp
   */
  @Get('status')
  getStatus() {
    return {
      timestamp: new Date().toISOString(),
      whatsapp: this.whatsappService.getConnectionStatus(),
    };
  }
  
  /**
   * GET /whatsapp/qr
   * Lihat QR Code di browser
   */
  @Get('qr')
  async getQr(@Res() res: express.Response) {
    const qrPath = path.join(process.cwd(), 'whatsapp-qr.png');
    if (fs.existsSync(qrPath)) {
      res.sendFile(qrPath);
    } else {
      res.status(404).send(`
        <html>
          <body style="display:flex; justify-content:center; align-items:center; height:100vh; font-family:sans-serif; background:#f0f2f5;">
            <div style="text-align:center; background:white; padding:40px; border-radius:10px; box-shadow:0 2px 5px rgba(0,0,0,0.1);">
              <h2 style="color:#128c7e;">QR Code Tidak Tersedia</h2>
              <p>WhatsApp mungkin sudah terhubung atau sistem belum men-generate QR Code.</p>
              <a href="/whatsapp/status" style="color:#075e54; text-decoration:none; font-weight:bold;">Cek Status Koneksi</a>
            </div>
          </body>
        </html>
      `);
    }
  }

  /**
   * POST /whatsapp/send-text
   * Kirim pesan teks manual (untuk testing)
   *
   * Body:
   * {
   *   "jid": "6281234567890@s.whatsapp.net",
   *   "text": "Hello from WA-Sent!"
   * }
   */
  @Post('send-text')
  @HttpCode(200)
  async sendText(@Body() body: { jid: string; text: string }) {
    const success = await this.whatsappService.sendText(body.jid, body.text);
    return {
      success,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * POST /whatsapp/send-image
   * Kirim gambar manual (untuk testing)
   *
   * Body:
   * {
   *   "jid": "6281234567890@s.whatsapp.net",
   *   "imagePath": "./screenshots/dashboard.png",
   *   "caption": "Report Hourly"
   * }
   */
  @Post('send-image')
  @HttpCode(200)
  async sendImage(
    @Body() body: { jid: string; imagePath: string; caption?: string },
  ) {
    const success = await this.whatsappService.sendImage(
      body.jid,
      body.imagePath,
      body.caption,
    );
    return {
      success,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * POST /whatsapp/logout
   * Logout dan hapus session
   */
  @Post('logout')
  @HttpCode(200)
  async logout() {
    await this.whatsappService.logout();
    return {
      message: 'Logout berhasil. Session telah dihapus.',
      timestamp: new Date().toISOString(),
    };
  }
}
