/**
 * Sinkronisasi utama bersifat REAL-TIME (mesin push via ADMS setiap ada scan).
 * Job ini HANYA jaring pengaman: berjalan tiap malam untuk memastikan user
 * yang jadwalnya "kerja" hari itu tapi 0 log sama sekali (misal lupa absen,
 * atau koneksi mesin sempat putus seharian) tetap tercatat & terlihat admin,
 * alih-alih diam-diam hilang dari rekap.
 *
 * Dijalankan dengan setInterval sederhana; di server produksi lebih baik
 * pakai `node-cron` atau cron OS (crontab) yang memanggil script terpisah.
 */
const dayjs = require('dayjs');
const supabase = require('../config/supabase');
const { getScheduleForUserOnDate, computeDailyStatus } = require('../services/scheduleEngine');

async function sweepYesterday() {
  const tanggal = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
  const { data: activeUsers } = await supabase
    .from('profiles')
    .select('id')
    .eq('is_active', true)
    .in('role', ['guru', 'pegawai']);

  for (const u of activeUsers || []) {
    const { data: existing } = await supabase
      .from('attendance_daily')
      .select('id')
      .eq('user_id', u.id)
      .eq('tanggal', tanggal)
      .maybeSingle();
    if (existing) continue; // sudah ada rekap (hadir/izin/dll), lewati

    const jadwal = await getScheduleForUserOnDate(u.id, tanggal);
    const { status } = computeDailyStatus({ jadwal, jamMasukAktual: null, jamPulangAktual: null });

    await supabase.from('attendance_daily').insert({
      user_id: u.id,
      tanggal,
      status, // 'alpha' jika ada jadwal, 'libur' jika tidak
    });
  }
  console.log(`[dailyAlphaSweeper] selesai untuk tanggal ${tanggal}`);
}

// Jalankan tiap jam 01:00 (cek tiap 30 menit, eksekusi jika jam cocok, hindari duplikasi run di menit sama)
setInterval(() => {
  const now = dayjs();
  if (now.hour() === 1 && now.minute() < 30) sweepYesterday().catch(console.error);
}, 30 * 60 * 1000);

module.exports = { sweepYesterday };
