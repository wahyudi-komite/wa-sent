// PM2 Ecosystem Configuration
// Jalankan: pm2 start ecosystem.config.cjs

module.exports = {
  apps: [
    {
      name: 'wa-sent',
      script: 'dist/main.js',
      cwd: __dirname,

      // ─── Instance ─────────────────────────────────
      instances: 1,           // WhatsApp = 1 instance ONLY
      exec_mode: 'fork',      // Jangan cluster (session confict)

      // ─── Auto Restart ─────────────────────────────
      autorestart: true,
      watch: false,
      max_restarts: 50,
      min_uptime: '10s',
      restart_delay: 5000,    // 5 detik delay sebelum restart

      // ─── Memory Limit ─────────────────────────────
      max_memory_restart: '500M',  // Restart jika memory > 500MB

      // ─── Environment ──────────────────────────────
      env: {
        NODE_ENV: 'production',
        APP_PORT: 3100,
      },

      // ─── Logging ──────────────────────────────────
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      merge_logs: true,
      log_type: 'json',

      // ─── Cron Restart (opsional) ──────────────────
      // Restart setiap hari jam 04:00 pagi untuk maintenance
      cron_restart: '0 4 * * *',

      // ─── Kill Timeout ─────────────────────────────
      kill_timeout: 10000,    // 10 detik graceful shutdown
      listen_timeout: 10000,
    },
  ],
};
