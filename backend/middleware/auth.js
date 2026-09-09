const supabase = require('../config/supabase');

/**
 * Verifikasi token JWT Supabase yang dikirim frontend (Authorization: Bearer <token>).
 * Frontend login memakai Supabase Auth langsung (supabase.auth.signInWithPassword),
 * lalu token itu dikirim ke backend Node.js ini untuk akses API internal
 * (misalnya export laporan, approve izin, sync manual, dsb).
 */
async function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token tidak ditemukan' });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return res.status(401).json({ error: 'Token tidak valid' });

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single();

  req.user = { ...data.user, profile };
  next();
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user?.profile) return res.status(401).json({ error: 'Belum login' });
    if (!allowedRoles.includes(req.user.profile.role)) {
      return res.status(403).json({ error: 'Tidak punya akses untuk aksi ini' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
