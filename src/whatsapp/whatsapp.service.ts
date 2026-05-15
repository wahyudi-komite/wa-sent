import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppLoggerService } from '../logger/logger.service.js';

import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  type WASocket,
  type ConnectionState,
} from '@whiskeysockets/baileys';
import * as fs from 'fs';
import * as path from 'path';
import * as qrcodeTerminal from 'qrcode-terminal';
import * as QRCode from 'qrcode';
import pino from 'pino';

/**
 * =====================================================
 * WhatsApp Service — Core Baileys Integration
 * =====================================================
 *
 * Bertanggung jawab untuk:
 * 1. Koneksi & autentikasi WhatsApp (QR code)
 * 2. Penyimpanan session (multi-file auth state)
 * 3. Auto-reconnect jika disconnect
 * 4. Validasi koneksi sebelum kirim
 * 5. Kirim pesan teks & gambar
 * 6. Anti memory leak (cleanup pada destroy)
 * 7. Retry mechanism
 */
@Injectable()
export class WhatsappService implements OnModuleInit, OnModuleDestroy {
  private socket: WASocket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly sessionPath: string;
  private readonly maxRetry: number;
  private readonly retryDelay: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: AppLoggerService,
  ) {
    this.sessionPath = this.configService.get<string>(
      'WA_SESSION_PATH',
      './wa-sessions',
    );
    this.maxRetry = this.configService.get<number>('WA_MAX_RETRY', 3);
    this.retryDelay = this.configService.get<number>('WA_RETRY_DELAY', 5000);
  }

  // ─── Lifecycle ──────────────────────────────────────

  async onModuleInit(): Promise<void> {
    this.logger.log('Initializing WhatsApp connection...', 'WhatsappService');
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Shutting down WhatsApp connection...', 'WhatsappService');
    this.cleanup();
  }

  // ─── Connection ─────────────────────────────────────

  async connect(): Promise<void> {
    try {
      // Pastikan folder session ada
      if (!fs.existsSync(this.sessionPath)) {
        fs.mkdirSync(this.sessionPath, { recursive: true });
      }

      // Load auth state dari file (session tersimpan)
      const { state, saveCreds } = await useMultiFileAuthState(
        this.sessionPath,
      );

      // Ambil versi Baileys terbaru
      const { version } = await fetchLatestBaileysVersion();

      this.logger.log(
        `Using Baileys version: ${version.join('.')}`,
        'WhatsappService',
      );

      // Buat socket dengan konfigurasi produksi
      this.socket = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(
            state.keys,
            pino({ level: 'silent' }) as any,
          ),
        },
        printQRInTerminal: false, // Kita handle sendiri QR
        logger: pino({ level: 'silent' }) as any,
        generateHighQualityLinkPreview: false,
        // Anti memory leak: batasi message history
        getMessage: async () => undefined,
      });

      // ─── Event: Connection Update ─────────────────
      this.socket.ev.on(
        'connection.update',
        (update: Partial<ConnectionState>) => {
          this.handleConnectionUpdate(update);
        },
      );

      // ─── Event: Credentials Update ────────────────
      this.socket.ev.on('creds.update', saveCreds);

      this.logger.log('WhatsApp socket created', 'WhatsappService');
    } catch (error) {
      this.logger.error(
        `Failed to create WhatsApp socket: ${(error as Error).message}`,
        (error as Error).stack,
        'WhatsappService',
      );
      await this.scheduleReconnect();
    }
  }

  // ─── Connection Handler ─────────────────────────────

  private handleConnectionUpdate(update: Partial<ConnectionState>): void {
    const { connection, lastDisconnect, qr } = update;

    // Tampilkan QR code di terminal & simpan sebagai file
    if (qr) {
      this.logger.log(
        '📱 QR Code muncul — scan dengan WhatsApp!',
        'WhatsappService',
      );
      
      // 1. Tampilkan di terminal (seperti biasa)
      qrcodeTerminal.generate(qr, { small: true });

      // 2. Simpan sebagai file PNG agar bisa dibuka lewat folder
      const qrPath = path.join(process.cwd(), 'whatsapp-qr.png');
      QRCode.toFile(qrPath, qr, {
        scale: 8,
        margin: 2,
      }).then(() => {
        this.logger.log(`🖼️ QR Code juga disimpan ke: ${qrPath}`, 'WhatsappService');
      }).catch(err => {
        this.logger.error('Gagal menyimpan file QR Code', err.stack, 'WhatsappService');
      });
    }

    if (connection === 'close') {
      this.isConnected = false;
      const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;

      this.logger.warn(
        `Connection closed. Status code: ${statusCode}`,
        'WhatsappService',
      );

      if (statusCode === DisconnectReason.loggedOut) {
        // User logged out — hapus session, minta scan ulang
        this.logger.warn(
          'Logged out! Menghapus session, scan ulang diperlukan.',
          'WhatsappService',
        );
        this.deleteSession();
        void this.scheduleReconnect();
      } else {
        // Disconnect karena alasan lain — reconnect otomatis
        this.logger.log(
          'Attempting auto-reconnect...',
          'WhatsappService',
        );
        void this.scheduleReconnect();
      }
    }

    if (connection === 'open') {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.logger.log('✅ WhatsApp terhubung dan siap!', 'WhatsappService');

      // Hapus file QR jika ada karena sudah tidak diperlukan
      const qrPath = path.join(process.cwd(), 'whatsapp-qr.png');
      if (fs.existsSync(qrPath)) {
        fs.unlinkSync(qrPath);
      }

      // Tampilkan daftar grup untuk membantu user mencari Group ID
      void this.listGroups();
    }
  }

  /**
   * List all groups the bot is currently in
   */
  private async listGroups(): Promise<void> {
    try {
      if (!this.socket) return;
      const groups = await this.socket.groupFetchAllParticipating();
      const groupList = Object.values(groups);
      
      this.logger.log(`👥 Bot tergabung dalam ${groupList.length} grup:`, 'WhatsappService');
      groupList.forEach(g => {
        this.logger.log(`📌 Nama: ${g.subject} | ID: ${g.id}`, 'WhatsappService');
      });
      this.logger.log(`💡 Copy ID di atas ke WA_TARGET_GROUP di file .env`, 'WhatsappService');
    } catch (error) {
      this.logger.debug('Gagal mengambil daftar grup (mungkin session baru)', 'WhatsappService');
    }
  }

  // ─── Reconnect Logic ───────────────────────────────

  private async scheduleReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error(
        `Max reconnect attempts (${this.maxReconnectAttempts}) reached. Stopping.`,
        undefined,
        'WhatsappService',
      );
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      5000 * Math.pow(2, this.reconnectAttempts - 1),
      60000,
    ); // Exponential backoff max 60s

    this.logger.log(
      `Reconnecting in ${delay / 1000}s (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
      'WhatsappService',
    );

    // Cleanup socket lama
    this.cleanupSocket();

    this.reconnectTimer = setTimeout(async () => {
      await this.connect();
    }, delay);
  }

  // ─── Send Message (Text) ───────────────────────────

  async sendText(jid: string, text: string): Promise<boolean> {
    if (!this.validateConnection()) return false;

    for (let attempt = 1; attempt <= this.maxRetry; attempt++) {
      try {
        await this.socket!.sendMessage(jid, { text });
        this.logger.log(
          `✅ Pesan teks terkirim ke ${jid}`,
          'WhatsappService',
        );
        return true;
      } catch (error) {
        this.logger.error(
          `❌ Gagal kirim teks (attempt ${attempt}/${this.maxRetry}): ${(error as Error).message}`,
          undefined,
          'WhatsappService',
        );
        if (attempt < this.maxRetry) {
          await this.delay(this.retryDelay);
        }
      }
    }

    return false;
  }

  // ─── Send Image ─────────────────────────────────────

  async sendImage(
    jid: string,
    imagePath: string,
    caption: string = '',
  ): Promise<boolean> {
    if (!this.validateConnection()) return false;

    // Validasi file ada
    if (!fs.existsSync(imagePath)) {
      this.logger.error(
        `File gambar tidak ditemukan: ${imagePath}`,
        undefined,
        'WhatsappService',
      );
      return false;
    }

    for (let attempt = 1; attempt <= this.maxRetry; attempt++) {
      try {
        const imageBuffer = fs.readFileSync(imagePath);

        this.logger.log(
          `📤 Mengirim gambar ke ${jid} (Attempt ${attempt}/${this.maxRetry})...`,
          'WhatsappService',
        );

        await this.socket!.sendMessage(jid, {
          image: imageBuffer,
          caption: caption || undefined,
          mimetype: 'image/png',
        });

        this.logger.log(
          `✅ Gambar terkirim ke ${jid} — ${path.basename(imagePath)}`,
          'WhatsappService',
        );
        return true;
      } catch (error) {
        this.logger.error(
          `❌ Gagal kirim gambar (attempt ${attempt}/${this.maxRetry}): ${(error as Error).message}`,
          undefined,
          'WhatsappService',
        );
        if (attempt < this.maxRetry) {
          await this.delay(this.retryDelay);
        }
      }
    }

    return false;
  }

  // ─── Send Image to Multiple Targets ─────────────────

  async sendImageToTargets(
    targets: string[],
    imagePath: string,
    caption: string = '',
  ): Promise<{ jid: string; success: boolean }[]> {
    const results: { jid: string; success: boolean }[] = [];

    for (const jid of targets) {
      const success = await this.sendImage(jid, imagePath, caption);
      results.push({ jid, success });

      // Delay antar pengiriman untuk menghindari rate limit
      if (targets.indexOf(jid) < targets.length - 1) {
        await this.delay(2000);
      }
    }

    return results;
  }

  // ─── Helpers ────────────────────────────────────────

  /**
   * Validasi koneksi sebelum kirim pesan.
   * Mengembalikan false jika tidak terhubung.
   */
  validateConnection(): boolean {
    if (!this.socket || !this.isConnected) {
      this.logger.warn(
        '⚠️ WhatsApp belum terhubung. Pesan tidak terkirim.',
        'WhatsappService',
      );
      return false;
    }
    return true;
  }

  /**
   * Cek status koneksi saat ini
   */
  getConnectionStatus(): {
    connected: boolean;
    reconnectAttempts: number;
  } {
    return {
      connected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  /**
   * Logout dari WhatsApp dan hapus session
   */
  async logout(): Promise<void> {
    try {
      this.logger.warn('Logging out from WhatsApp...', 'WhatsappService');
      
      if (this.socket && this.isConnected) {
        await this.socket.logout().catch(() => { /* ignore */ });
      }

      this.deleteSession();
      this.cleanup();
      
      this.logger.log('Logout berhasil. Silakan restart aplikasi atau tunggu auto-reconnect untuk scan ulang.', 'WhatsappService');
    } catch (error) {
      this.logger.error(`Error during logout: ${(error as Error).message}`, undefined, 'WhatsappService');
    }
  }

  /**
   * Hapus session (force scan ulang QR)
   */
  private deleteSession(): void {
    try {
      if (fs.existsSync(this.sessionPath)) {
        fs.rmSync(this.sessionPath, { recursive: true, force: true });
        this.logger.log('Session deleted.', 'WhatsappService');
      }
    } catch (error) {
      this.logger.error(
        `Failed to delete session: ${(error as Error).message}`,
        undefined,
        'WhatsappService',
      );
    }
  }

  /**
   * Cleanup socket event listeners — anti memory leak
   */
  private cleanupSocket(): void {
    if (this.socket) {
      this.socket.ev.removeAllListeners('connection.update');
      this.socket.ev.removeAllListeners('creds.update');
      this.socket.end(undefined);
      this.socket = null;
    }
  }

  /**
   * Full cleanup saat shutdown
   */
  private cleanup(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.cleanupSocket();
    this.isConnected = false;
  }

  /**
   * Utility delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
