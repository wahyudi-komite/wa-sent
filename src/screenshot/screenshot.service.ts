import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppLoggerService } from '../logger/logger.service.js';
import puppeteer, { type Browser, type Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

/**
 * =====================================================
 * Screenshot Service — Puppeteer Dashboard Capture
 * =====================================================
 *
 * Bertanggung jawab untuk:
 * 1. Membuka browser headless
 * 2. Navigasi ke URL dashboard
 * 3. Screenshot full page
 * 4. Menyimpan screenshot ke file
 * 5. Cleanup browser saat shutdown (anti memory leak)
 */
@Injectable()
export class ScreenshotService implements OnModuleDestroy {
  private browser: Browser | null = null;

  private readonly dashboardUrl: string;
  private readonly viewportWidth: number;
  private readonly viewportHeight: number;
  private readonly timeout: number;
  private readonly screenshotPath: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: AppLoggerService,
  ) {
    this.dashboardUrl = this.configService.get<string>(
      'DASHBOARD_URL',
      'http://localhost:4200',
    );
    this.viewportWidth = Number(
      this.configService.get('SCREENSHOT_WIDTH', 1920),
    );
    this.viewportHeight = Number(
      this.configService.get('SCREENSHOT_HEIGHT', 1080),
    );
    this.timeout = Number(
      this.configService.get('SCREENSHOT_TIMEOUT', 30000),
    );
    this.screenshotPath = this.configService.get<string>(
      'SCREENSHOT_PATH',
      './screenshots',
    );

    // Pastikan folder screenshot ada
    if (!fs.existsSync(this.screenshotPath)) {
      fs.mkdirSync(this.screenshotPath, { recursive: true });
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.closeBrowser();
  }

  // ─── Get/Create Browser ─────────────────────────────

  private async getBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.connected) {
      this.logger.log('Launching Puppeteer browser...', 'ScreenshotService');

      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-extensions',
          '--disable-web-security',
          '--ignore-certificate-errors',
          '--ignore-certificate-errors-spki-list',
          '--disable-features=IsolateOrigins,site-per-process',
        ],
      });
    }

    return this.browser;
  }

  // ─── Take Screenshot ───────────────────────────────

  /**
   * Screenshot dashboard dan simpan ke file.
   *
   * @param url - URL yang akan di-screenshot (opsional, default dari .env)
   * @param filename - Nama file output (opsional, auto-generate)
   * @returns path absolut file screenshot
   */
  async takeScreenshot(
    url?: string,
    filename?: string,
  ): Promise<string | null> {
    let page: Page | null = null;

    try {
      const targetUrl = url || this.dashboardUrl;
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, '-')
        .replace('T', '_')
        .substring(0, 19);
      const outputFilename =
        filename || `dashboard_${timestamp}.png`;
      const outputPath = path.resolve(
        this.screenshotPath,
        outputFilename,
      );

      this.logger.log(
        `📸 Taking screenshot: ${targetUrl}`,
        'ScreenshotService',
      );

      const browser = await this.getBrowser();
      page = await browser.newPage();

      // Set User Agent agar terlihat seperti browser asli
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      );

      // Set viewport
      await page.setViewport({
        width: this.viewportWidth,
        height: this.viewportHeight,
        deviceScaleFactor: 1,
      });

      // Navigasi ke halaman
      await page.goto(targetUrl, {
        waitUntil: 'networkidle2',
        timeout: this.timeout,
      });

      // Tunggu sedikit agar chart/grafik selesai render
      await page.evaluate(
        () => new Promise((resolve) => setTimeout(resolve, 3000)),
      );

      // Screenshot
      await page.screenshot({
        path: outputPath,
        fullPage: false,
        type: 'png',
      });

      this.logger.log(
        `✅ Screenshot disimpan: ${outputPath}`,
        'ScreenshotService',
      );

      return outputPath;
    } catch (error) {
      this.logger.error(
        `❌ Gagal screenshot: ${(error as Error).message}`,
        (error as Error).stack,
        'ScreenshotService',
      );
      return null;
    } finally {
      // PENTING: selalu tutup page setelah selesai — anti memory leak
      if (page) {
        try {
          await page.close();
        } catch {
          // ignore
        }
      }
    }
  }

  // ─── Take Multiple Screenshots ──────────────────────

  /**
   * Screenshot beberapa URL sekaligus
   */
  async takeMultipleScreenshots(
    urls: { url: string; filename: string }[],
  ): Promise<string[]> {
    const results: string[] = [];

    for (const item of urls) {
      const result = await this.takeScreenshot(item.url, item.filename);
      if (result) {
        results.push(result);
      }
    }

    return results;
  }

  // ─── Cleanup Old Screenshots ────────────────────────

  /**
   * Hapus screenshot lebih tua dari N hari
   */
  cleanupOldScreenshots(maxAgeDays: number = 7): void {
    try {
      const files = fs.readdirSync(this.screenshotPath);
      const now = Date.now();
      const maxAge = maxAgeDays * 24 * 60 * 60 * 1000;
      let deleted = 0;

      for (const file of files) {
        const filePath = path.join(this.screenshotPath, file);
        const stat = fs.statSync(filePath);

        if (now - stat.mtimeMs > maxAge) {
          fs.unlinkSync(filePath);
          deleted++;
        }
      }

      if (deleted > 0) {
        this.logger.log(
          `🗑️ Cleaned up ${deleted} old screenshots`,
          'ScreenshotService',
        );
      }
    } catch (error) {
      this.logger.error(
        `Cleanup failed: ${(error as Error).message}`,
        undefined,
        'ScreenshotService',
      );
    }
  }

  // ─── Close Browser ─────────────────────────────────

  private async closeBrowser(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
        this.logger.log('Browser closed.', 'ScreenshotService');
      } catch {
        // ignore
      }
      this.browser = null;
    }
  }
}
