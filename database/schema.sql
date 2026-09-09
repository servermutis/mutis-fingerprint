-- =====================================================================
-- MUTIS SMART ATTENDANCE - FINGERPRINT X105 EDITION
-- Database Schema untuk Supabase (PostgreSQL)
-- =====================================================================
-- Catatan:
-- - Autentikasi login memakai Supabase Auth (auth.users). Tabel `profiles`
--   di bawah adalah extension 1-1 terhadap auth.users.
-- - Semua tabel memakai UUID sebagai primary key agar aman disinkronkan
--   lintas server (server lokal <-> Supabase cloud).
-- =====================================================================

create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. UNIT / SATUAN PENDIDIKAN
-- ---------------------------------------------------------------------
create table units (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,          -- TKIT, SDIT, SMPIT, SMAIT, YAYASAN
  name text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. PROFILE PENGGUNA (extends auth.users)
-- ---------------------------------------------------------------------
create type user_role as enum ('admin', 'guru', 'pegawai', 'pimpinan');
create type employment_type as enum ('guru', 'pegawai_kependidikan', 'pegawai_non_kependidikan');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nip text unique,                    -- NIP/NIK internal yayasan
  full_name text not null,
  role user_role not null default 'guru',
  employment_type employment_type not null default 'guru',
  unit_id uuid references units(id),
  photo_url text,
  phone text,
  is_active boolean not null default true,

  -- pemetaan ke mesin fingerprint
  device_user_pin text,               -- ID user di mesin X105 (PIN/Badge Number)
  fingerprint_enrolled boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_profiles_unit on profiles(unit_id);
create index idx_profiles_device_pin on profiles(device_user_pin);

-- ---------------------------------------------------------------------
-- 3. MESIN FINGERPRINT
-- ---------------------------------------------------------------------
create table devices (
  id uuid primary key default gen_random_uuid(),
  serial_number text unique not null,     -- SN mesin, dipakai sebagai identitas ADMS
  name text not null,                     -- ex: "X105 - Pos Satpam"
  unit_id uuid references units(id),
  ip_address text,
  location text,
  is_active boolean not null default true,
  last_seen_at timestamptz,
  last_attlog_stamp text,                 -- checkpoint ADMS (ATTLOGStamp)
  last_operlog_stamp text,                -- checkpoint ADMS (OPERLOGStamp)
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 4. TEMPLATE JADWAL KERJA / SHIFT
-- ---------------------------------------------------------------------
create type schedule_type as enum ('reguler_kantor', 'mengajar', 'piket');

create table schedule_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,                     -- "Jam Kantor Pegawai", "Piket Senin Guru SDIT"
  type schedule_type not null default 'reguler_kantor',
  jam_masuk time not null,
  jam_pulang time not null,
  toleransi_terlambat_menit int not null default 10,
  toleransi_pulang_cepat_menit int not null default 0,
  created_at timestamptz not null default now()
);

-- Penugasan jadwal ke user per hari (guru bisa beda tiap hari sesuai jadwal ajar/piket)
create table user_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  schedule_template_id uuid not null references schedule_templates(id),
  day_of_week smallint not null check (day_of_week between 0 and 6), -- 0=Minggu .. 6=Sabtu
  effective_from date not null default current_date,
  effective_until date,
  created_at timestamptz not null default now(),
  unique (user_id, day_of_week, effective_from)
);

create index idx_user_schedules_user_day on user_schedules(user_id, day_of_week);

-- ---------------------------------------------------------------------
-- 5. LOG ABSENSI MENTAH (raw log dari mesin, 1 baris = 1 scan)
-- ---------------------------------------------------------------------
create type attlog_verify_mode as enum ('fingerprint', 'face', 'password', 'card', 'unknown');
create type attlog_status as enum ('check_in', 'check_out', 'break_out', 'break_in', 'overtime_in', 'overtime_out', 'unknown');

create table attendance_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),          -- null jika device_user_pin belum termapping
  device_id uuid not null references devices(id),
  device_user_pin text not null,                   -- PIN mentah dari mesin (untuk audit/mapping ulang)
  scan_time timestamptz not null,
  verify_mode attlog_verify_mode not null default 'fingerprint',
  status attlog_status not null default 'unknown',
  raw_payload text,                                -- baris asli dari ADMS untuk debugging
  source text not null default 'adms_push',        -- adms_push | manual | backfill
  created_at timestamptz not null default now(),
  unique (device_id, device_user_pin, scan_time)    -- cegah duplikasi saat retry ADMS
);

create index idx_attlogs_user_time on attendance_logs(user_id, scan_time desc);
create index idx_attlogs_device on attendance_logs(device_id, scan_time desc);

-- ---------------------------------------------------------------------
-- 6. REKAP HARIAN (hasil olahan attendance_logs + jadwal + izin)
-- ---------------------------------------------------------------------
create type daily_status as enum ('hadir', 'terlambat', 'pulang_cepat', 'terlambat_dan_pulang_cepat', 'alpha', 'izin', 'sakit', 'cuti', 'libur');

create table attendance_daily (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  tanggal date not null,
  schedule_template_id uuid references schedule_templates(id),
  jam_masuk_aktual timestamptz,
  jam_pulang_aktual timestamptz,
  terlambat_menit int not null default 0,
  pulang_cepat_menit int not null default 0,
  status daily_status not null default 'alpha',
  is_manual_correction boolean not null default false,
  corrected_by uuid references profiles(id),
  corrected_note text,
  corrected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, tanggal)
);

create index idx_daily_tanggal on attendance_daily(tanggal);
create index idx_daily_user on attendance_daily(user_id, tanggal desc);

-- ---------------------------------------------------------------------
-- 7. PENGAJUAN IZIN / SAKIT / CUTI
-- ---------------------------------------------------------------------
create type leave_type as enum ('izin', 'sakit', 'cuti');
create type leave_status as enum ('pending', 'approved', 'rejected');

create table leave_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type leave_type not null,
  start_date date not null,
  end_date date not null,
  reason text not null,
  attachment_url text,
  status leave_status not null default 'pending',
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now()
);

create index idx_leave_user on leave_requests(user_id);
create index idx_leave_status on leave_requests(status);

-- ---------------------------------------------------------------------
-- 8. LOG SINKRONISASI DEVICE (audit trail ADMS)
-- ---------------------------------------------------------------------
create table device_sync_logs (
  id uuid primary key default gen_random_uuid(),
  device_id uuid references devices(id),
  sync_type text not null,     -- handshake | attlog_push | operlog_push | user_push_cmd
  status text not null,        -- success | error
  message text,
  record_count int default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 9. ANTRIAN PERINTAH KE MESIN (mis. push data user/fingerprint baru ke X105)
-- ---------------------------------------------------------------------
create type device_command_status as enum ('queued', 'sent', 'confirmed', 'failed');

create table device_commands (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references devices(id),
  command text not null,        -- contoh: "DATA UPDATE USERINFO PIN=1 Name=..."
  status device_command_status not null default 'queued',
  response text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  confirmed_at timestamptz
);

-- =====================================================================
-- TRIGGER: updated_at otomatis
-- =====================================================================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_profiles_updated_at before update on profiles
  for each row execute function set_updated_at();
create trigger trg_daily_updated_at before update on attendance_daily
  for each row execute function set_updated_at();

-- =====================================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================================
alter table profiles enable row level security;
alter table attendance_logs enable row level security;
alter table attendance_daily enable row level security;
alter table leave_requests enable row level security;
alter table devices enable row level security;
alter table schedule_templates enable row level security;
alter table user_schedules enable row level security;

-- Helper: ambil role user yang sedang login
create or replace function auth_role() returns user_role as $$
  select role from profiles where id = auth.uid();
$$ language sql stable;

-- profiles: user lihat data sendiri; admin/pimpinan lihat semua
create policy profiles_select on profiles for select
  using (id = auth.uid() or auth_role() in ('admin', 'pimpinan'));
create policy profiles_update_self on profiles for update
  using (id = auth.uid() or auth_role() = 'admin');
create policy profiles_admin_insert on profiles for insert
  with check (auth_role() = 'admin');

-- attendance_logs & attendance_daily: guru/pegawai hanya lihat milik sendiri
create policy daily_select on attendance_daily for select
  using (user_id = auth.uid() or auth_role() in ('admin', 'pimpinan'));
create policy daily_update_admin on attendance_daily for update
  using (auth_role() = 'admin');

create policy logs_select on attendance_logs for select
  using (user_id = auth.uid() or auth_role() in ('admin', 'pimpinan'));

-- leave_requests: user CRUD milik sendiri (insert/select), admin approve semua
create policy leave_select on leave_requests for select
  using (user_id = auth.uid() or auth_role() in ('admin', 'pimpinan'));
create policy leave_insert on leave_requests for insert
  with check (user_id = auth.uid());
create policy leave_update_admin on leave_requests for update
  using (auth_role() = 'admin' or user_id = auth.uid());

-- master data: semua role login bisa baca, hanya admin bisa tulis
create policy devices_select on devices for select using (true);
create policy devices_admin_write on devices for insert with check (auth_role() = 'admin');
create policy schedule_select on schedule_templates for select using (true);
create policy schedule_admin_write on schedule_templates for insert with check (auth_role() = 'admin');
create policy user_schedule_select on user_schedules for select using (true);
create policy user_schedule_admin_write on user_schedules for insert with check (auth_role() = 'admin');
