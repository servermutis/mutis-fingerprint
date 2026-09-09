# MUTIS Smart Attendance — Fingerprint X105 Edition

Sistem absensi guru & pegawai terintegrasi mesin **Solution X105**, backend
**Node.js/Express**, database **Supabase (Postgres)**, sinkronisasi
**real-time via protokol ADMS**.

## 1. Arsitektur

```
┌─────────────┐   push ADMS (HTTP)   ┌──────────────────────────┐   REST (service_role)   ┌───────────────┐
│  Mesin X105 │ ───────────────────► │ Node.js/Express (LAN)    │ ───────────────────────► │   Supabase    │
│  (di LAN    │  /iclock/cdata dsb.  │  server lokal sekolah    │                          │   (Postgres + │
│  sekolah)   │ ◄─────────────────── │  - parser ADMS           │ ◄─────────────────────── │   Auth + RLS) │
└─────────────┘   getrequest/cmd     │  - schedule engine       │      query (JWT user)    └───────────────┘
                                     │  - REST API utk frontend │                                 ▲
                                     └──────────────────────────┘                                 │
                                                                                          ┌─────────┴─────────┐
                                                                                          │ Frontend Web App   │
                                                                                          │ (Admin/Guru/       │
                                                                                          │  Pimpinan)         │
                                                                                          └────────────────────┘
```

Kenapa begini:
- **X105 hanya bisa "melihat" server di jaringan yang sama** → server Node.js
  di atas WAJIB jalan di komputer/mini-PC yang satu LAN dengan mesin.
- **Server lokal ini yang menjembatani ke Supabase** memakai `service_role`
  key (server-to-server, aman), sedangkan **frontend** memakai Supabase Auth
  + `anon` key langsung dari browser (dilindungi RLS di `schema.sql`).
- Login & sebagian besar query laporan bisa langsung frontend → Supabase
  (tidak perlu lewat server lokal), KECUALI: endpoint yang berhubungan dengan
  mesin (ADMS) dan export PDF/Excel yang butuh library server-side.

## 2. Setup Mesin X105 (mode ADMS push, real-time)

Di menu mesin: **Comm → Cloud Server Setting**
1. Enable Domain Name / Server Mode: **ON**
2. Server Address: IP komputer server lokal (mis. `192.168.1.50`)
3. Server Port: sesuaikan dengan `PORT` di `.env` (mis. `8080`)
4. Enable Proxy Server: **OFF** (kecuali memang pakai proxy)

Setelah disimpan, mesin akan otomatis:
- `GET /iclock/cdata?SN=...` → handshake
- `POST /iclock/cdata?SN=...&table=ATTLOG` → setiap ada yang tap jari, **langsung** push (real-time)
- `POST /iclock/cdata?SN=...&table=OPERLOG` → saat ada user/fingerprint baru didaftarkan di mesin
- `GET /iclock/getrequest?SN=...` → polling perintah dari server (mis. push data user baru KE mesin)

> ⚠️ **Wajib divalidasi di lapangan**: format kolom ATTLOG/OPERLOG di
> `services/admsParser.js` adalah mapping umum ZKTeco. Nyalakan `morgan`
> logging (`server.js`) lalu lihat body mentah yang benar-benar dikirim
> X105 saat pertama kali di-tap, cocokkan urutan kolom Status/Verify.

## 3. Instalasi Backend

```bash
cd backend
cp .env.example .env      # isi SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY
npm install
npm run dev                # atau: npm start
```

## 4. Setup Database (Supabase)

1. Buat project di supabase.com
2. Buka **SQL Editor**, jalankan isi `database/schema.sql`
3. Aktifkan **Email/Password Auth** di Authentication settings
4. Untuk tiap guru/pegawai: buat akun via Supabase Auth (atau endpoint
   admin `auth.admin.createUser`), lalu isi baris di tabel `profiles`
   dengan `id` yang sama + `device_user_pin` sesuai PIN mereka di mesin X105.

## 5. Alur Data End-to-End

1. Guru tap jari di X105 → mesin push `ATTLOG` ke `/iclock/cdata`
2. `admsParser.js` mem-parse baris mentah → `attendanceProcessor.js`
3. Log mentah masuk `attendance_logs`, PIN dicocokkan ke `profiles.device_user_pin`
4. `scheduleEngine.js` mengambil jadwal user hari itu (`user_schedules` →
   `schedule_templates`) untuk hitung Terlambat/Pulang Cepat
5. Hasil akhir di-upsert ke `attendance_daily` (1 baris per user per tanggal) —
   inilah tabel yang dipakai untuk laporan & dashboard
6. `dailyAlphaSweeper.js` jalan tiap malam sebagai jaring pengaman jika PIN
   tidak tap sama sekali (menandai `alpha`), supaya tidak diam-diam hilang dari rekap

## 6. Fitur per Role (RBAC)

| Fitur | Admin | Guru/Pegawai | Pimpinan |
|---|---|---|---|
| Kelola user, jadwal, shift | ✅ | ❌ | ❌ |
| Lihat riwayat kehadiran sendiri | ✅ | ✅ | ✅ |
| Lihat kehadiran semua orang | ✅ | ❌ | ✅ (read-only) |
| Ajukan izin/sakit/cuti | — | ✅ | — |
| Approve izin/sakit/cuti | ✅ | ❌ | ❌ |
| Koreksi manual absensi | ✅ | ❌ | ❌ |
| Export Excel/CSV/PDF | ✅ | ✅ (data sendiri) | ✅ |

Diimplementasikan lewat kombinasi:
- **RLS Postgres** (`schema.sql`) → lapisan pertahanan utama di level database
- **`middleware/auth.js`** (`requireRole`) → lapisan kedua di level API Node.js

## 7. Frontend

Sudah tersedia di folder `frontend/` — React + Vite + Tailwind CSS,
terhubung ke Supabase langsung (untuk data yang diizinkan RLS) dan ke
backend Express ini (untuk approve izin, koreksi manual, export). Lihat
`frontend/README.md` untuk setup dan daftar keterbatasan yang masih ada.

## 8. Yang Belum Termasuk (Next Steps)

- Endpoint CRUD master data (`profiles`, `schedule_templates`,
  `user_schedules`) — pola sama seperti `routes/leave.js`, tinggal duplikasi
  (saat ini frontend menulis langsung ke Supabase untuk insert, dibatasi
  oleh RLS policy yang ada — lihat `frontend/README.md` bagian 4)
- Notifikasi (email/WA) saat pengajuan izin di-approve/reject
- Auto-registrasi command "push user baru ke mesin" saat admin tambah
  guru/pegawai baru (tabel `device_commands` sudah disiapkan, tinggal
  di-insert dari endpoint create-user)
- RLS policy `update`/`delete` untuk `devices`, `schedule_templates`,
  `user_schedules` (saat ini hanya ada `select`/`insert`)

## 9. Struktur Folder

```
mutis-fingerprint-x105/
├── database/
│   └── schema.sql              # seluruh tabel, enum, RLS policy
├── backend/
│   ├── server.js                # entry point Express
│   ├── config/supabase.js       # koneksi Supabase (service_role)
│   ├── routes/
│   │   ├── adms.js               # endpoint protokol ADMS (mesin X105)
│   │   ├── leave.js               # pengajuan & approval izin/sakit/cuti
│   │   ├── corrections.js        # koreksi manual & remap PIN
│   │   └── reports.js            # rekap + export Excel/CSV/PDF
│   ├── services/
│   │   ├── admsParser.js         # parsing ATTLOG/OPERLOG
│   │   ├── attendanceProcessor.js# raw log -> rekap harian (real-time)
│   │   └── scheduleEngine.js     # logika jadwal, telat, pulang cepat
│   ├── middleware/auth.js        # verifikasi JWT Supabase + RBAC
│   └── jobs/dailyAlphaSweeper.js # jaring pengaman harian
└── frontend/
    ├── src/pages/guru/           # riwayat & pengajuan izin (Guru/Pegawai)
    ├── src/pages/admin/          # rekap, approve izin, koreksi, data induk
    ├── src/pages/pimpinan/       # dashboard read-only
    └── README.md                 # setup & keterbatasan detail
```
