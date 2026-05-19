import { Controller, Get, Post, Body, HttpCode, Res, Req } from '@nestjs/common';
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
   * GET /whatsapp/reconnect
   * Halaman HTML dengan tombol reconnect
   */
  @Get('reconnect')
  reconnectPage(@Res() res: express.Response) {
    const status = this.whatsappService.getConnectionStatus();
    res.send(`
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WA-Sent — Reconnect</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f0f2f5; display: flex; justify-content: center;
      align-items: center; min-height: 100vh;
    }
    .card {
      background: white; border-radius: 16px; padding: 48px 40px 40px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08); text-align: center;
      max-width: 420px; width: 100%;
    }
    .icon {
      width: 72px; height: 72px; border-radius: 50%; display: flex;
      align-items: center; justify-content: center; margin: 0 auto 24px;
    }
    .icon.connected { background: #e8f5e9; }
    .icon.disconnected { background: #fbe9e7; }
    h1 { font-size: 22px; color: #1a1a1a; margin-bottom: 8px; }
    .status {
      font-size: 14px; padding: 6px 16px; border-radius: 20px;
      display: inline-block; margin-bottom: 28px; font-weight: 500;
    }
    .status.connected { background: #e8f5e9; color: #2e7d32; }
    .status.disconnected { background: #fbe9e7; color: #c62828; }
    .detail {
      font-size: 13px; color: #666; margin-bottom: 32px; line-height: 1.6;
    }
    button {
      width: 100%; padding: 14px 24px; font-size: 16px; font-weight: 600;
      border: none; border-radius: 12px; cursor: pointer;
      transition: all 0.2s; display: flex; align-items: center;
      justify-content: center; gap: 8px;
    }
    button.reconnect {
      background: #128c7e; color: white;
    }
    button.reconnect:hover:not(:disabled) { background: #075e54; }
    button.reconnect:disabled { background: #ccc; cursor: not-allowed; }
    button.logout {
      margin-top: 12px; background: #fff; color: #c62828;
      border: 1px solid #ffcdd2;
    }
    button.logout:hover { background: #ffebee; }
    .toast {
      margin-top: 16px; padding: 12px; border-radius: 10px;
      font-size: 13px; font-weight: 500; display: none;
    }
    .toast.success { display: block; background: #e8f5e9; color: #2e7d32; }
    .toast.error { display: block; background: #fbe9e7; color: #c62828; }
    .loader { display: none; width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.3);
      border-top-color: white; border-radius: 50%; animation: spin 0.6s linear infinite; }
    .loader.show { display: inline-block; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon ${status.connected ? 'connected' : 'disconnected'}">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="${status.connected ? '#2e7d32' : '#c62828'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        ${status.connected
          ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'
          : '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'}
      </svg>
    </div>
    <h1>Koneksi WhatsApp</h1>
    <div class="status ${status.connected ? 'connected' : 'disconnected'}">
      ${status.connected ? 'TERHUBUNG' : 'TERPUTUS'}
    </div>
    <div class="detail" id="detail">
      ${status.connected
        ? 'WhatsApp sedang terhubung dan siap digunakan.'
        : 'WhatsApp tidak terhubung. Klik tombol di bawah untuk mencoba reconnect.'
      }
      ${!status.connected && status.reconnectAttempts > 0
        ? `<br>Percobaan auto-reconnect: ${status.reconnectAttempts}/10`
        : ''
      }
    </div>
    <button class="reconnect" id="reconnectBtn" onclick="reconnect()">
      <span id="btnText">🔄 Reconnect Sekarang</span>
      <span class="loader" id="loader"></span>
    </button>
    <div class="toast" id="toast"></div>
  </div>
  <script>
    async function reconnect() {
      const btn = document.getElementById('reconnectBtn');
      const btnText = document.getElementById('btnText');
      const loader = document.getElementById('loader');
      const toast = document.getElementById('toast');
      btn.disabled = true; btnText.textContent = 'Menghubungkan...';
      loader.classList.add('show'); toast.className = 'toast';
      try {
        const res = await fetch('/whatsapp/reconnect', { method: 'POST' });
        const data = await res.json();
        toast.className = 'toast ' + (data.success ? 'success' : 'error');
        toast.textContent = data.message;
        if (data.success) {
          setTimeout(() => location.reload(), 1500);
        }
      } catch(e) {
        toast.className = 'toast error';
        toast.textContent = 'Gagal menghubungi server';
      }
      btn.disabled = false; btnText.textContent = '🔄 Reconnect Sekarang';
      loader.classList.remove('show');
    }
  </script>
</body>
</html>`);
  }

  /**
   * POST /whatsapp/reconnect
   * Manual reconnect — force connect ulang tanpa restart
   */
  @Post('reconnect')
  @HttpCode(200)
  async reconnect() {
    const result = await this.whatsappService.reconnect();
    return {
      ...result,
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
