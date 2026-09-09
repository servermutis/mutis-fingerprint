# MUTIS Smart Attendance — Frontend

Frontend React untuk melengkapi `mutis-fingerprint-x105` (backend Node.js +
Supabase yang sudah ada). Dibangun dengan **React + Vite + Tailwind CSS**,
memakai **Supabase JS client** langsung dari browser untuk sebagian besar
data (dilindungi RLS), dan memanggil **backend Express** untuk operasi yang
butuh logika server (approve izin, koreksi manual, export Excel/CSV/PDF).

## 1. Instalasi

```bash
cd frontend
cp .env.example .env      # isi 3 variabel di bawah
npm install
npm run dev                # buka http://localhost:5173
```

Isi `.env`:

| Variabel | Dari mana |
|---|---|
| `VITE_SUPABASE_URL` | Supabase Project Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Supabase Project Settings → API (pakai **anon**, bukan service_role) |
| `VITE_API_BASE_URL` | Alamat backend Express (mis. `http://localhost:8080`) |

Backend (`../backend`) harus sudah jalan lebih dulu — lihat README di folder
itu untuk setup Supabase & `.env`-nya.

## 2. Peta Halaman per Role

| Role | Halaman |
|---|---|
| Guru / Pegawai | Riwayat kehadiran sendiri (`/guru`), ajukan & pantau izin/sakit/cuti (`/guru/izin`) |
| Admin | Ringkasan (`/admin`), rekap & ekspor semua orang (`/admin/rekap`), approve izin (`/admin/izin`), koreksi manual & remap PIN (`/admin/koreksi`), data induk unit/mesin/jadwal/pengguna (`/admin/master`) |
| Pimpinan | Ringkasan read-only + rekap & ekspor (`/pimpinan`) |

Routing diamankan dua lapis, sama seperti backend: `ProtectedRoute` di
frontend mengecek `profiles.role` untuk navigasi, tapi **RLS di
`database/schema.sql` tetap jadi pertahanan utama** — pengguna tidak bisa
melihat data yang sebenarnya diblok RLS meski mencoba mengakses URL secara
langsung.

## 3. Mana yang lewat Supabase langsung, mana yang lewat backend

- **Langsung ke Supabase** (pakai anon key + RLS): login, baca profil,
  baca unit/mesin/jadwal, baca rekap kehadiran sendiri (guru/pegawai),
  tambah unit/mesin/jadwal, ubah profil pengguna (peran, PIN, unit).
- **Lewat backend Express**: ajukan izin & riwayatnya, approve/reject izin
  (karena harus menulis ke `attendance_daily` juga — butuh hak yang tidak
  dimiliki anon key), semua export Excel/CSV/PDF (butuh library
  server-side), remap PIN & koreksi manual per hari (audit trail terpusat
  di server).

## 4. Keterbatasan yang belum ditutup (jujur, biar tidak salah ekspektasi)

Ini konsekuensi dari `database/schema.sql` & backend yang ada saat ini,
bukan bug frontend:

1. **Menambah pengguna baru** butuh akun Supabase Auth dibuat lebih dulu
   (lewat dashboard Supabase, karena butuh `service_role` key yang tidak
   boleh ada di browser). Setelah itu, salin User ID-nya ke form "Pengguna"
   di halaman Data Induk untuk melengkapi baris `profiles`. Ini sesuai
   alur yang sudah didokumentasikan di README backend bagian 4.
2. **Update/hapus mesin, jadwal, dan penugasan jadwal** belum bisa dari UI
   ini, karena `schema.sql` saat ini hanya punya RLS policy untuk
   `select` & `insert` pada tabel `devices`, `schedule_templates`, dan
   `user_schedules` — belum ada policy `update`/`delete`. Untuk
   mengaktifkannya, tambahkan policy serupa `profiles_update_self` pada
   tabel-tabel tersebut di `schema.sql`, lalu saya bisa lengkapi tombol
   Ubah/Hapusnya.
3. **Penugasan jadwal ke pengguna per hari** (`user_schedules`) belum ada
   UI-nya — tabelnya sudah ada di skema tapi belum dipakai di sini. Bisa
   ditambahkan sebagai tab baru di halaman Data Induk kalau dibutuhkan.
4. **Notifikasi email/WA** saat izin di-approve/reject belum ada, sesuai
   catatan "Next Steps" di README backend.

## 5. Struktur Folder

```
frontend/
├── index.html
├── src/
│   ├── main.jsx, App.jsx, index.css
│   ├── lib/
│   │   ├── supabaseClient.js   # klien Supabase (anon key)
│   │   └── api.js               # wrapper fetch ke backend + auth header
│   ├── context/AuthContext.jsx  # sesi login + profil + role
│   ├── components/              # Layout, ProtectedRoute, StatusBadge, dll
│   ├── pages/
│   │   ├── Login.jsx, NotAuthorized.jsx
│   │   ├── guru/                # RiwayatSaya, PengajuanIzin
│   │   ├── admin/                # DashboardAdmin, Rekap, ApproveIzin,
│   │   │                         # KoreksiAbsensi, MasterData
│   │   └── pimpinan/             # DashboardPimpinan
│   └── utils/format.js          # label status, format tanggal/jam
```

## 6. Build untuk Produksi

```bash
npm run build      # hasil di frontend/dist/
npm run preview    # coba hasil build secara lokal
```

Deploy `dist/` ke hosting statis apa saja (Vercel, Netlify, Nginx, dst).
Pastikan variabel `VITE_*` di-set di environment hosting saat build,
dan backend Express dapat diakses dari domain tempat frontend ini dihost
(CORS sudah diaktifkan lewat `cors()` di `backend/server.js`).
