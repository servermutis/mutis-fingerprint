export const STATUS_LABEL = {
  hadir: 'Hadir',
  terlambat: 'Terlambat',
  pulang_cepat: 'Pulang Cepat',
  terlambat_dan_pulang_cepat: 'Terlambat & Pulang Cepat',
  alpha: 'Alpha',
  izin: 'Izin',
  sakit: 'Sakit',
  cuti: 'Cuti',
  libur: 'Libur',
};

export const STATUS_STYLE = {
  hadir: 'text-status-hadir bg-status-hadirBg',
  terlambat: 'text-status-telat bg-status-telatBg',
  pulang_cepat: 'text-status-telat bg-status-telatBg',
  terlambat_dan_pulang_cepat: 'text-status-alpha bg-status-alphaBg',
  alpha: 'text-status-alpha bg-status-alphaBg',
  izin: 'text-status-cuti bg-status-cutiBg',
  sakit: 'text-status-cuti bg-status-cutiBg',
  cuti: 'text-status-cuti bg-status-cutiBg',
  libur: 'text-status-libur bg-status-liburBg',
};

export const LEAVE_TYPE_LABEL = {
  izin: 'Izin',
  sakit: 'Sakit',
  cuti: 'Cuti',
};

export const LEAVE_STATUS_LABEL = {
  pending: 'Menunggu',
  approved: 'Disetujui',
  rejected: 'Ditolak',
};

export const ROLE_LABEL = {
  admin: 'Admin',
  guru: 'Guru',
  pegawai: 'Pegawai',
  pimpinan: 'Pimpinan',
};

export function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** Selalu tampil WIB, format 24 jam HH:mm:ss - jangan andalkan default browser. */
export function formatTime(dateTimeStr) {
  if (!dateTimeStr) return '-';
  const d = new Date(dateTimeStr);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleTimeString('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function firstDayOfMonthISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
