import { Injectable, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { WhatsappService } from '../whatsapp/whatsapp.service.js';
import { ScreenshotService } from '../screenshot/screenshot.service.js';
import { AppLoggerService } from '../logger/logger.service.js';
import { CronJob } from 'cron';
import * as fs from 'fs';

/**
 * =====================================================
 * Report Scheduler Service
 * =====================================================
 *
 * Scheduler otomatis yang:
 * 1. Jadwal Dinamis (dari .env CRON_SCHEDULE) → screenshot dashboard → kirim ke WA
 * 2. Setiap hari jam 00:00 → cleanup screenshot lama (7 hari)
 * 3. Support kirim ke multiple targets (personal + group)
 * 4. Logging setiap eksekusi
 *
 * Catatan:
 * - Sekarang sudah mendukung pembacaan jadwal langsung dari .env
 *   dengan format: HH:mm, HH:mm (Contoh: 07:05, 16:05, 19:55)
 */
@Injectable()
export class ReportSchedulerService implements OnModuleInit {
  private readonly targetPersonal: string;
  private readonly targetGroup: string;
  private isProcessingQueue = false; // Lock untuk pengirim antrean
  private globalQueue: any[] = []; // Antrean laporan global

  constructor(
    private readonly whatsappService: WhatsappService,
    private readonly screenshotService: ScreenshotService,
    private readonly configService: ConfigService,
    private readonly logger: AppLoggerService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {
    this.targetPersonal = this.configService.get<string>(
      'WA_TARGET_PERSONAL',
      '',
    );
    this.targetGroup = this.configService.get<string>(
      'WA_TARGET_GROUP',
      '',
    );
  }

  onModuleInit() {
    this.setupDynamicCron();
  }

  /**
   * Setup jadwal otomatis berdasarkan isi dari .env (CRON_SCHEDULE)
   */
  private setupDynamicCron() {
    const scheduleStr = this.configService.get<string>(
      'CRON_SCHEDULE',
      '06:55, 11:50, 19:55, 00:01',
    );
    const times = scheduleStr.split(',').map((t) => t.trim());

    this.logger.log(
      `⚙️ Setting up dynamic cron from .env: [${scheduleStr}]`,
      'Scheduler',
    );

    times.forEach((time, index) => {
      const [hour, minute] = time.split(':');
      if (hour && minute) {
        // Konversi HH:mm menjadi cron string: "0 minute hour * * *"
        const cronTime = `0 ${parseInt(minute, 10)} ${parseInt(
          hour,
          10,
        )} * * *`;
        const jobName = `report-job-${time.replace(':', '')}`;

        // Hapus job lama jika ada (saat restart)
        try {
          this.schedulerRegistry.deleteCronJob(jobName);
        } catch {
          // ignore
        }

        const job = new CronJob(cronTime, () => {
          this.handleScheduledReport();
        });

        this.schedulerRegistry.addCronJob(jobName, job as any);
        job.start();
        this.logger.log(
          `📅 Registered dynamic cron: ${cronTime} (${jobName})`,
          'Scheduler',
        );
      }
    });
  }

  // ─── Daily Cleanup: Jam 00:00 ──────────────────────
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailyCleanup() {
    this.logger.log('🧹 Running daily cleanup for old screenshots...', 'Scheduler');
    this.screenshotService.cleanupOldScreenshots(7); // Hapus file > 7 hari
  }

  // ─── Health Check: Setiap 5 Menit ──────────────────
  @Cron(CronExpression.EVERY_5_MINUTES)
  handleHeartbeat() {
    const waStatus = this.whatsappService.validateConnection() ? 'Connected' : 'Disconnected';
    const queueSize = this.globalQueue.length;
    const workerStatus = this.isProcessingQueue ? 'Running' : 'Idle';

    this.logger.debug(
      `💓 Scheduler Heartbeat | WA: ${waStatus} | Queue: ${queueSize} batch | Worker: ${workerStatus}`,
      'Scheduler',
    );
  }

  /**
   * Ambil semua screenshot dengan retry logic:
   * 1. Coba semua URL urut, lewati yang gagal
   * 2. Setelah putaran pertama, retry yang gagal maksimal 5x
   * 3. Kirim ke WA hanya yang berhasil
   */
  async handleScheduledReport(): Promise<void> {
    this.logger.log('⏰ SCHEDULED REPORT TRIGGERED', 'Scheduler');

    const urls = this.getUrls();
    const targets = this.getTargets();

    if (targets.length === 0) {
      this.logger.warn('⚠️ Tidak ada target penerima. Lewati.', 'Scheduler');
      return;
    }

    const timestamp = new Date().toLocaleTimeString('id-ID');
    this.logger.log(
      `📸 Mengambil ${urls.length} screenshot untuk Batch jam ${timestamp}...`,
      'Scheduler',
    );

    // Inisialisasi semua job dengan status pending
    const jobs: {
      index: number;
      url: string;
      path: string | null;
      caption: string;
      retries: number;
      maxRetries: number;
    }[] = urls.map((url, i) => ({
      index: i + 1,
      url,
      path: null,
      caption: this.generateCaption(i + 1, url),
      retries: 0,
      maxRetries: 5,
    }));

    // ── Putaran 1: coba semua URL urut ──────────────
    for (const job of jobs) {
      await this.tryCapture(job);
      if (job !== jobs[jobs.length - 1]) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }

    // ── Putaran 2: retry yang gagal maksimal 5x ─────
    const failed = jobs.filter((j) => !j.path);
    for (const job of failed) {
      while (job.retries < job.maxRetries && !job.path) {
        this.logger.log(
          `🔁 Retry screenshot [${job.index}/${urls.length}] (${job.retries + 1}/${job.maxRetries}): ${job.url}`,
          'Scheduler',
        );
        await this.tryCapture(job);
        if (!job.path) {
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      }
      if (!job.path) {
        this.logger.error(
          `❌ Screenshot [${job.index}] GAGAL setelah ${job.maxRetries} kali percobaan: ${job.url}`,
          undefined,
          'Scheduler',
        );
      }
    }

    // ── Kumpulkan hanya yang berhasil ────────────────
    const successful = jobs.filter((j) => j.path);
    const reports = successful.map((j) => ({
      path: j.path!,
      caption: j.caption,
      index: j.index,
      url: j.url,
      remainingTargets: [...targets],
    }));

    if (reports.length > 0) {
      this.globalQueue.push({
        timestamp,
        reports,
      });
      this.logger.log(
        `✅ Batch jam ${timestamp} — ${reports.length}/${urls.length} laporan berhasil, ditambahkan ke antrean.`,
        'Scheduler',
      );
    } else {
      this.logger.error(
        `❌ Semua screenshot gagal untuk Batch jam ${timestamp}. Tidak ada yang dikirim.`,
        undefined,
        'Scheduler',
      );
    }

    // Fase 2: Kirim ke WhatsApp
    this.processQueue();
  }

  /**
   * Coba capture satu screenshot, update job.path jika berhasil
   */
  private async tryCapture(job: {
    index: number;
    url: string;
    path: string | null;
    retries: number;
    maxRetries: number;
  }): Promise<void> {
    try {
      this.logger.log(
        `📸 Capture [${job.index}]: ${job.url}`,
        'Scheduler',
      );
      const screenshotPath = await this.screenshotService.takeScreenshot(job.url);
      if (screenshotPath) {
        job.path = screenshotPath;
        this.logger.log(
          `✅ Screenshot [${job.index}] berhasil: ${screenshotPath}`,
          'Scheduler',
        );
      } else {
        job.retries++;
        this.logger.warn(
          `⚠️ Screenshot [${job.index}] gagal (${job.retries}/${job.maxRetries})`,
          'Scheduler',
        );
      }
    } catch (error) {
      job.retries++;
      this.logger.error(
        `❌ Screenshot [${job.index}] error: ${(error as Error).message}`,
        undefined,
        'Scheduler',
      );
    }
  }

  /**
   * Pemroses Antrean Global (Background Worker)
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue) {
      this.logger.log(
        `ℹ️ Pengirim sudah aktif. ${this.globalQueue.length} laporan dalam antrean.`,
        'Scheduler',
      );
      return;
    }

    this.isProcessingQueue = true;
    this.logger.log(
      `📤 Memulai pengolahan antrean (${this.globalQueue.length} laporan)...`,
      'Scheduler',
    );

    let attemptCount = 1;
    while (this.globalQueue.length > 0) {
      const isConnected = this.whatsappService.validateConnection();

      if (!isConnected) {
        this.logger.warn(
          `⏳ [Antrean #${attemptCount}] Menunggu internet untuk mengirim ${this.globalQueue.length} batch laporan...`,
          'Scheduler',
        );
        await new Promise((resolve) => setTimeout(resolve, 30000));
        attemptCount++;
        continue;
      }

      // Ambil BATCH pertama dari antrean
      const currentBatch = this.globalQueue[0];
      const totalInBatch = currentBatch.reports.length;

      this.logger.log(
        `📤 Memproses Batch jam ${currentBatch.timestamp} (Isi ${totalInBatch} laporan)...`,
        'Scheduler',
      );

      // Proses setiap laporan di dalam batch satu per satu
      while (currentBatch.reports.length > 0) {
        const report = currentBatch.reports[0]; // Selalu ambil yang paling atas di batch
        try {
          this.logger.log(
            `📤 Mengirim [${report.index}] dari Batch ${currentBatch.timestamp} ke ${report.remainingTargets.length} target...`,
            'Scheduler',
          );

          const results = await this.whatsappService.sendImageToTargets(
            report.remainingTargets,
            report.path,
            report.caption,
          );

          // Update target yang gagal
          report.remainingTargets = results
            .filter((r) => !r.success)
            .map((r) => r.jid);

          if (report.remainingTargets.length === 0) {
            // Sukses kirim gambar ini ke semua target
            this.cleanupScreenshot(report.path);
            currentBatch.reports.shift(); // Hapus dari batch
            this.logger.log(
              `✅ Foto [${report.index}] dari Batch ${currentBatch.timestamp} sukses terkirim.`,
              'Scheduler',
            );

            // JEDA SINGKAT antar foto dalam 1 batch (2 detik) agar tidak terlalu beruntun
            if (currentBatch.reports.length > 0) {
              await new Promise((resolve) => setTimeout(resolve, 2000));
            }
          } else {
            // Gagal sebagian, kita break untuk coba lagi nanti (retry batch)
            this.logger.warn(
              `⚠️ Gagal kirim ke beberapa target di Batch ${currentBatch.timestamp}.`,
              'Scheduler',
            );
            break; 
          }
        } catch (error) {
          this.logger.error(
            `❌ Error saat memproses foto di Batch ${currentBatch.timestamp}: ${
              (error as Error).message
            }`,
            undefined,
            'Scheduler',
          );
          break;
        }
      }

      // Jika batch sudah kosong, baru hapus batch dari antrean global
      if (currentBatch.reports.length === 0) {
        this.globalQueue.shift();
        this.logger.log(
          `✅ Batch jam ${currentBatch.timestamp} SELESAI dikirim semua.`,
          'Scheduler',
        );

        // JEDA ANTAR BATCH: 1 Menit jika masih ada batch lain di antrean
        if (this.globalQueue.length > 0) {
          this.logger.log(
            '⏳ Menunggu 1 menit sebelum memproses Batch berikutnya dalam antrean...',
            'Scheduler',
          );
          await new Promise((resolve) => setTimeout(resolve, 60000));
        }
      } else {
        // Jika batch belum kosong (ada yang gagal), tunggu sebentar sebelum coba lagi
        this.logger.warn(
          `⚠️ Batch ${currentBatch.timestamp} belum tuntas. Mencoba lagi dalam 1 menit...`,
          'Scheduler',
        );
        await new Promise((resolve) => setTimeout(resolve, 60000));
      }

      attemptCount++;
    }

    this.isProcessingQueue = false;
    this.logger.log('🏁 Antrean kosong. Pengirim standby.', 'Scheduler');
  }

  // ─── Helpers ────────────────────────────────────────

  /**
   * Mengambil daftar URL dari configuration
   */
  private getUrls(): string[] {
    const urlsString = this.configService.get<string>('DASHBOARD_URLS', '');
    return urlsString
      ? urlsString
          .split(',')
          .map((u) => u.trim())
          .filter((u) => u !== '')
      : [this.configService.get<string>('DASHBOARD_URL', '')];
  }

  /**
   * Mengambil daftar target WA dari configuration
   */
  private getTargets(): string[] {
    const targetPersonalStr = this.configService.get<string>(
      'WA_TARGET_PERSONAL',
      '',
    );
    const targetGroupStr = this.configService.get<string>(
      'WA_TARGET_GROUP',
      '',
    );

    return [
      ...targetPersonalStr
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t !== ''),
      ...targetGroupStr
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t !== ''),
    ];
  }

  /**
   * Menunggu koneksi WhatsApp aktif dengan timeout (tidak lagi dipakai di main loop
   * tapi dipertahankan jika dibutuhkan di masa depan)
   */
  private async waitForConnection(maxMinutes: number): Promise<boolean> {
    for (let i = 0; i < maxMinutes; i++) {
      if (this.whatsappService.validateConnection()) {
        return true;
      }
      this.logger.warn(
        `⚠️ WhatsApp belum terhubung. Menunggu 1 menit... (Percobaan ${
          i + 1
        }/${maxMinutes})`,
        'Scheduler',
      );
      await new Promise((resolve) => setTimeout(resolve, 60000));
    }
    return this.whatsappService.validateConnection();
  }

  private generateCaption(index: number, url: string): string {
    const now = new Date();
    const datePart = now.toLocaleDateString('id-ID', {
      day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'Asia/Jakarta'
    }).replace(/\//g, '-');
    const timePart = now.toLocaleTimeString('id-ID', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta'
    }).replace('.', ':');
    const dateStr = `${datePart} ${timePart}`;

    let title = `#${index}`;
    if (index === 1) title = 'KR & SZ';
    else if (index === 2) title = 'NR';
    else if (index === 3) title = 'WA & BV';

    return [
      `*${title}* ${dateStr}`,
      `_Auto send by Andon_Ganteng_`,
    ].join('\n');
  }

  // ─── Cleanup Single Screenshot ──────────────────────

  private cleanupScreenshot(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        this.logger.debug(
          `Deleted screenshot: ${filePath}`,
          'Scheduler',
        );
      }
    } catch {
      // Non-critical, ignore
    }
  }
}
