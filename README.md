# 🤖 WA-SENT: WhatsApp Report Automation

Sistem otomatisasi laporan WhatsApp berbasis NestJS yang dirancang untuk mengambil screenshot dashboard (Intranet) dan mengirimkannya ke WhatsApp (Internet) dengan keandalan tinggi, sistem antrean, dan perlindungan anti-spam.

---

## ✨ Fitur Unggulan

- **🛡️ Arsitektur Global Queue**: Memisahkan pengambilan screenshot (Intranet) dan pengiriman WhatsApp (Internet). Jika internet mati, screenshot tetap diambil sesuai jadwal dan antre sampai internet aktif kembali.
- **🕒 Dynamic Scheduling**: Jadwal pengiriman diatur langsung via `.env` tanpa perlu mengubah kode.
- **📦 Batch Processing**: Gambar dalam satu jadwal dikirim bersamaan, namun antar jadwal diberi jeda **1 menit** untuk menghindari deteksi spam WhatsApp.
- **🌐 Browser QR Code**: Lihat QR Code login langsung di browser (tidak harus di terminal).
- **💓 Heartbeat Monitoring**: Pengecekan kesehatan sistem setiap 5 menit untuk memastikan scheduler tetap aktif.
- **🧹 Auto-Cleanup**: Pembersihan otomatis file screenshot lama (> 7 hari) setiap tengah malam.
- **🚀 Production Ready**: Dilengkapi konfigurasi PM2, logging rotasi harian, dan mekanisme *auto-reconnect*.

---

## 🛠️ Persyaratan Sistem

- **Node.js**: v18 atau lebih tinggi
- **Google Chrome / Chromium**: Untuk Puppeteer (otomatis terinstall)
- **Jaringan**: Harus memiliki akses ke URL Dashboard (Intranet) dan Internet (untuk WhatsApp).

---

## ⚙️ Konfigurasi (.env)

Buat file `.env` di folder root dan sesuaikan:

```env
# --- Application ---
APP_PORT=3100
NODE_ENV=production

# --- WhatsApp ---
WA_SESSION_PATH=./wa-sessions
WA_MAX_RETRY=3

# --- Target Penerima ---
# Pisahkan dengan koma jika lebih dari satu
WA_TARGET_PERSONAL=628xxxxxx@s.whatsapp.net
WA_TARGET_GROUP=123456789@g.us

# --- Dashboard & Screenshot ---
# URL yang akan di-screenshot (pisahkan dengan koma)
DASHBOARD_URLS=http://intranet.url/page1,http://intranet.url/page2
SCREENSHOT_WIDTH=1920
SCREENSHOT_HEIGHT=1080

# --- Scheduler ---
# Jadwal pengiriman (Format HH:mm, HH:mm)
CRON_SCHEDULE=06:55, 11:50, 19:55, 00:01
```

---

## 📡 API Endpoints

| Method | Endpoint | Fungsi |
| :--- | :--- | :--- |
| **GET** | `/whatsapp/status` | Cek koneksi WhatsApp & antrean |
| **GET** | `/whatsapp/qr` | **Lihat QR Code login di browser** |
| **POST** | `/whatsapp/logout` | Logout dan hapus session |
| **GET** | `/scheduler/trigger` | Trigger screenshot manual sekarang juga |
| **GET** | `/health` | Status kesehatan aplikasi & memory |

---

## 🚀 Panduan Penggunaan

### 1. Instalasi & Menjalankan
```bash
# Install dependencies
npm install

# Build project
npm run build

# Jalankan dengan PM2 (Rekomendasi Production)
pm2 start ecosystem.config.cjs
```

### 2. Login WhatsApp
1. Jalankan aplikasi.
2. Buka browser: `http://localhost:3100/whatsapp/qr`.
3. Scan QR menggunakan WhatsApp di HP Anda.
4. Setelah terhubung, file `whatsapp-qr.png` akan terhapus otomatis.

### 3. Monitoring
Cek log secara real-time untuk melihat proses antrean dan pengiriman:
```bash
pm2 logs wa-sent
```
Anda akan melihat log `💓 Scheduler Heartbeat` setiap 5 menit sebagai tanda sistem aktif.

---

## 🔍 Troubleshooting Routing (Intranet & Internet)

Jika Anda menggunakan 2 jaringan (LAN untuk Intranet & Wi-Fi untuk Internet), gunakan konfigurasi routing berikut di Windows (CMD as Admin):

```cmd
# 1. Berikan prioritas tinggi ke Wi-Fi (Internet)
# Set Interface Metric Wi-Fi = 10, LAN = 100 di Network Adapter Settings

# 2. Tambahkan rute statis untuk segmen IP Intranet (misal 10.x.x.x)
route -p add 10.0.0.0 mask 255.0.0.0 [IP_GATEWAY_LAN]

# 3. Hapus gateway default LAN agar tidak bentrok dengan Wi-Fi
route delete 0.0.0.0 mask 0.0.0.0 [IP_GATEWAY_LAN]
```

---

## 📌 Catatan Penting

1. **1 Instance ONLY**: Jangan jalankan lebih dari 1 instance aplikasi dengan session yang sama.
2. **Anti-Spam**: Sistem sengaja menunggu 1 menit antar jadwal laporan. Jangan mempercepat jeda ini secara ekstrem untuk menghindari pemblokiran nomor.
3. **Session Path**: Backup folder `wa-sessions/` jika ingin pindah server agar tidak perlu scan QR ulang.

---

Created by **Antigravity** for **Andon_Ganteng** 🚀
