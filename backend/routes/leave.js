const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { requireAuth, requireRole } = require('../middleware/auth');

// Guru/Pegawai mengajukan izin/sakit/cuti
router.post('/', requireAuth, async (req, res) => {
  const { type, start_date, end_date, reason, attachment_url } = req.body;
  const { data, error } = await supabase
    .from('leave_requests')
    .insert({
      user_id: req.user.id,
      type,
      start_date,
      end_date,
      reason,
      attachment_url,
    })
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Riwayat pengajuan milik sendiri
router.get('/mine', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('leave_requests')
    .select('*')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Admin: daftar pengajuan pending untuk di-approve
router.get('/pending', requireAuth, requireRole('admin'), async (req, res) => {
  const { data, error } = await supabase
    .from('leave_requests')
    .select('*, profiles!leave_requests_user_id_fkey(full_name, unit_id)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Admin: approve / reject, sekaligus update attendance_daily untuk rentang tanggal terkait
router.patch('/:id/review', requireAuth, requireRole('admin'), async (req, res) => {
  const { status, review_note } = req.body; // status: 'approved' | 'rejected'
  const { data: leave, error } = await supabase
    .from('leave_requests')
    .update({
      status,
      review_note,
      reviewed_by: req.user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });

  if (status === 'approved') {
    await markDailyStatusForLeave(leave);
  }
  res.json(leave);
});

async function markDailyStatusForLeave(leave) {
  const dates = [];
  let cur = new Date(leave.start_date);
  const end = new Date(leave.end_date);
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  const rows = dates.map((tanggal) => ({
    user_id: leave.user_id,
    tanggal,
    status: leave.type, // 'izin' | 'sakit' | 'cuti' -> cocok dengan enum daily_status
    is_manual_correction: true,
    corrected_by: leave.reviewed_by,
    corrected_note: `Auto dari leave_requests #${leave.id}`,
    corrected_at: new Date().toISOString(),
  }));
  await supabase.from('attendance_daily').upsert(rows, { onConflict: 'user_id,tanggal' });
}

module.exports = router;
