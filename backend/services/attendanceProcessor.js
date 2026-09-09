const dayjs = require('dayjs');
const supabase = require('../config/supabase');
const { getScheduleForUserOnDate, computeDailyStatus } = require('./scheduleEngine');

/**
 * Dipanggil setiap kali ada baris ATTLOG baru dari mesin (mode real-time / ADMS push).
 * Alur:
 *  1. Simpan raw log ke attendance_logs (idempotent, unique constraint mencegah duplikat)
 *  2. Mapping device_user_pin -> profiles.id (via device_user_pin)
 *  3. Update / recompute rekap attendance_daily untuk (user, tanggal) terkait
 */
async function processAttlogEntry(deviceId, entry) {
  // 1. Mapping user
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('device_user_pin', entry.device_user_pin)
    .maybeSingle();

  // 2. Simpan raw log (upsert supaya aman jika X105 kirim ulang data yang sama)
  const { error: insertErr } = await supabase.from('attendance_logs').upsert(
    {
      user_id: profile?.id || null,
      device_id: deviceId,
      device_user_pin: entry.device_user_pin,
      scan_time: entry.scan_time,
      verify_mode: entry.verify_mode,
      status: entry.status,
      raw_payload: entry.raw_payload,
      source: 'adms_push',
    },
    { onConflict: 'device_id,device_user_pin,scan_time', ignoreDuplicates: true }
  );
  if (insertErr) throw insertErr;

  if (!profile?.id) {
    // PIN belum termapping ke profil guru/pegawai -> perlu ditinjau admin.
    // Tetap tersimpan di attendance_logs untuk audit & mapping ulang manual.
    return { mapped: false };
  }

  await recomputeDailySummary(profile.id, dayjs(entry.scan_time).format('YYYY-MM-DD'));
  return { mapped: true, userId: profile.id };
}

/**
 * Hitung ulang rekap harian seorang user berdasarkan seluruh raw log hari itu.
 * Aturan sederhana: scan paling awal = jam masuk, scan paling akhir = jam pulang.
 * (Bisa diperluas untuk multi-sesi/istirahat sesuai kebutuhan sekolah.)
 */
async function recomputeDailySummary(userId, tanggal) {
  const startOfDay = `${tanggal} 00:00:00`;
  const endOfDay = `${tanggal} 23:59:59`;

  const { data: logs, error } = await supabase
    .from('attendance_logs')
    .select('scan_time')
    .eq('user_id', userId)
    .gte('scan_time', startOfDay)
    .lte('scan_time', endOfDay)
    .order('scan_time', { ascending: true });
  if (error) throw error;

  const jamMasukAktual = logs?.[0]?.scan_time || null;
  const jamPulangAktual = logs?.length > 1 ? logs[logs.length - 1].scan_time : null;

  const jadwal = await getScheduleForUserOnDate(userId, tanggal);
  const { status, terlambatMenit, pulangCepatMenit } = computeDailyStatus({
    jadwal,
    jamMasukAktual,
    jamPulangAktual,
  });

  // Jangan timpa koreksi manual yang sudah di-approve admin
  const { data: existing } = await supabase
    .from('attendance_daily')
    .select('is_manual_correction')
    .eq('user_id', userId)
    .eq('tanggal', tanggal)
    .maybeSingle();

  if (existing?.is_manual_correction) return;

  await supabase.from('attendance_daily').upsert(
    {
      user_id: userId,
      tanggal,
      schedule_template_id: jadwal?.schedule_template_id || null,
      jam_masuk_aktual: jamMasukAktual,
      jam_pulang_aktual: jamPulangAktual,
      terlambat_menit: terlambatMenit,
      pulang_cepat_menit: pulangCepatMenit,
      status,
    },
    { onConflict: 'user_id,tanggal' }
  );
}

module.exports = { processAttlogEntry, recomputeDailySummary };
