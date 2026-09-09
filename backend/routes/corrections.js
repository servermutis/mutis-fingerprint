const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { requireAuth, requireRole } = require('../middleware/auth');

/**
 * Daftar data absensi yang perlu ditinjau: status alpha padahal ada leave pending,
 * atau device_user_pin yang belum termapping ke profil manapun.
 */
router.get('/unmapped-logs', requireAuth, requireRole('admin'), async (req, res) => {
  const { data, error } = await supabase
    .from('attendance_logs')
    .select('*')
    .is('user_id', null)
    .order('scan_time', { ascending: false })
    .limit(200);
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Admin memetakan ulang PIN yang salah/belum terdaftar ke user yang benar
router.post('/remap-pin', requireAuth, requireRole('admin'), async (req, res) => {
  const { device_user_pin, user_id } = req.body;

  await supabase.from('profiles').update({ device_user_pin }).eq('id', user_id);
  const { error } = await supabase
    .from('attendance_logs')
    .update({ user_id })
    .eq('device_user_pin', device_user_pin)
    .is('user_id', null);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ success: true });
});

// Koreksi manual jam masuk/pulang atau status untuk 1 hari (mis. lupa absen / mesin error)
router.patch('/daily/:userId/:tanggal', requireAuth, requireRole('admin'), async (req, res) => {
  const { userId, tanggal } = req.params;
  const { jam_masuk_aktual, jam_pulang_aktual, status, corrected_note } = req.body;

  const { data, error } = await supabase
    .from('attendance_daily')
    .upsert(
      {
        user_id: userId,
        tanggal,
        jam_masuk_aktual,
        jam_pulang_aktual,
        status,
        is_manual_correction: true,
        corrected_by: req.user.id,
        corrected_note,
        corrected_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,tanggal' }
    )
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

module.exports = router;
