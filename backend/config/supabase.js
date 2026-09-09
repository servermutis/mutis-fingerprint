require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diset di .env');
}

// Backend server lokal ini dipercaya penuh (trusted server di LAN sekolah),
// sehingga memakai service_role key agar bisa insert log absensi mentah
// tanpa terbentur RLS. Jangan pernah expose key ini ke frontend/browser.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

module.exports = supabase;
