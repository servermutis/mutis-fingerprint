const dayjs = require('dayjs');
const supabase = require('../config/supabase');

/**
 * Ambil jadwal aktif seorang user pada hari tertentu (0=Minggu..6=Sabtu).
 * Guru bisa punya jadwal berbeda tiap hari (jam mengajar/piket),
 * pegawai biasanya 1 template yang sama tiap hari kerja.
 */
async function getScheduleForUserOnDate(userId, dateStr) {
  const dayOfWeek = dayjs(dateStr).day();

  const { data, error } = await supabase
    .from('user_schedules')
    .select('*, schedule_templates(*)')
    .eq('user_id', userId)
    .eq('day_of_week', dayOfWeek)
    .lte('effective_from', dateStr)
    .or(`effective_until.is.null,effective_until.gte.${dateStr}`)
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data; // null jika hari libur / tidak ada jadwal (dianggap libur, bukan alpha)
}

/**
 * Hitung status kehadiran harian berdasarkan jam masuk/pulang aktual vs jadwal.
 */
function computeDailyStatus({ jadwal, jamMasukAktual, jamPulangAktual }) {
  if (!jadwal) {
    return { status: 'libur', terlambatMenit: 0, pulangCepatMenit: 0 };
  }

  if (!jamMasukAktual) {
    return { status: 'alpha', terlambatMenit: 0, pulangCepatMenit: 0 };
  }

  const tpl = jadwal.schedule_templates;
  const tanggal = dayjs(jamMasukAktual).format('YYYY-MM-DD');
  const batasMasuk = dayjs(`${tanggal} ${tpl.jam_masuk}`).add(
    tpl.toleransi_terlambat_menit,
    'minute'
  );
  const batasPulang = dayjs(`${tanggal} ${tpl.jam_pulang}`).subtract(
    tpl.toleransi_pulang_cepat_menit,
    'minute'
  );

  const terlambatMenit = Math.max(0, dayjs(jamMasukAktual).diff(batasMasuk, 'minute'));
  const pulangCepatMenit = jamPulangAktual
    ? Math.max(0, batasPulang.diff(dayjs(jamPulangAktual), 'minute'))
    : 0;

  let status = 'hadir';
  if (terlambatMenit > 0 && pulangCepatMenit > 0) status = 'terlambat_dan_pulang_cepat';
  else if (terlambatMenit > 0) status = 'terlambat';
  else if (pulangCepatMenit > 0) status = 'pulang_cepat';

  return { status, terlambatMenit, pulangCepatMenit };
}

module.exports = { getScheduleForUserOnDate, computeDailyStatus };
