const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { parseAttlog, parseOperlog } = require('../services/admsParser');
const { processAttlogEntry } = require('../services/attendanceProcessor');

/**
 * Middleware kecil: pastikan mesin (by Serial Number) terdaftar di tabel devices.
 * Jika belum, auto-register sebagai inactive supaya admin tinggal approve dari UI,
 * daripada silently drop data.
 */
async function resolveDevice(req, res, next) {
  const sn = req.query.SN;
  if (!sn) return res.status(400).send('SN wajib diisi');

  let { data: device } = await supabase
    .from('devices')
    .select('*')
    .eq('serial_number', sn)
    .maybeSingle();

  if (!device) {
    const { data: created, error } = await supabase
      .from('devices')
      .insert({ serial_number: sn, name: `Device ${sn}`, is_active: false })
      .select()
      .single();
    if (error) return res.status(500).send('Gagal registrasi device baru');
    device = created;
  }

  await supabase
    .from('devices')
    .update({ last_seen_at: new Date().toISOString(), ip_address: req.ip })
    .eq('id', device.id);

  req.device = device;
  next();
}

/**
 * GET /iclock/cdata
 * Handshake awal: mesin request konfigurasi server saat pertama kali connect
 * atau reboot. Server WAJIB balas plain text "OK" / parameter berikut agar
 * mesin lanjut mengirim data.
 */
router.get('/cdata', resolveDevice, async (req, res) => {
  res.set('Content-Type', 'text/plain');
  // Contoh minimal response yang diterima firmware ZKTeco ADMS pada umumnya.
  // Nilai stamp dipakai mesin sebagai checkpoint agar tidak resend semua log lama.
  const stamp = req.device.last_attlog_stamp || '0';
  res.send(
    [
      `GET OPTION FROM: ${req.device.serial_number}`,
      `Stamp=${stamp}`,
      'OpStamp=0',
      'ErrorDelay=60',
      'Delay=30',
      'TransFlag=1111000000',
      'Realtime=1',
      'Encrypt=0',
    ].join('\n')
  );
});

/**
 * POST /iclock/cdata?SN=xxx&table=ATTLOG|OPERLOG
 * Mesin push data absensi (ATTLOG) atau data user/fingerprint (OPERLOG) di sini.
 * Ini endpoint utama untuk sinkronisasi REAL-TIME yang diminta.
 */
router.post('/cdata', resolveDevice, express.text({ type: '*/*' }), async (req, res) => {
  const table = req.query.table;
  const body = req.body || '';

  try {
    if (table === 'ATTLOG') {
      const entries = parseAttlog(body);
      for (const entry of entries) {
        await processAttlogEntry(req.device.id, entry);
      }
      await supabase
        .from('devices')
        .update({ last_attlog_stamp: String(Date.now()) })
        .eq('id', req.device.id);
      await logSync(req.device.id, 'attlog_push', 'success', null, entries.length);
    } else if (table === 'OPERLOG') {
      const { users } = parseOperlog(body);
      // Data fingerprint template TIDAK disimpan mentah demi keamanan/privasi;
      // hanya dipakai untuk sinkronisasi status "fingerprint_enrolled".
      for (const u of users) {
        await supabase
          .from('profiles')
          .update({ fingerprint_enrolled: true })
          .eq('device_user_pin', u.device_user_pin);
      }
      await logSync(req.device.id, 'operlog_push', 'success', null, users.length);
    }
    // Mesin ZKTeco mengharapkan balasan "OK" plain text, bukan JSON.
    res.set('Content-Type', 'text/plain');
    res.send('OK');
  } catch (err) {
    await logSync(req.device.id, `${table}_push`, 'error', err.message, 0);
    res.set('Content-Type', 'text/plain');
    res.status(500).send('error');
  }
});

/**
 * GET /iclock/getrequest
 * Mesin polling secara berkala menanyakan "ada perintah untuk saya?"
 * Dipakai untuk: push data user baru / hapus user / update jadwal ke device.
 * Ambil 1 command paling lama berstatus 'queued' dari device_commands.
 */
router.get('/getrequest', resolveDevice, async (req, res) => {
  const { data: cmd } = await supabase
    .from('device_commands')
    .select('*')
    .eq('device_id', req.device.id)
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  res.set('Content-Type', 'text/plain');
  if (!cmd) return res.send('OK');

  await supabase
    .from('device_commands')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', cmd.id);

  res.send(`C:${cmd.id}:${cmd.command}`);
});

/**
 * POST /iclock/devicecmd
 * Mesin melapor hasil eksekusi command (mis. berhasil menambah user baru).
 */
router.post('/devicecmd', resolveDevice, express.text({ type: '*/*' }), async (req, res) => {
  const body = req.body || '';
  const match = body.match(/ID=(\S+)/);
  const returnMatch = body.match(/Return=(\S+)/);

  if (match) {
    const [, cmdRef] = body.split(':'); // format "C:<id>:..." dikirim balik mesin
    await supabase
      .from('device_commands')
      .update({
        status: returnMatch?.[1] === '0' ? 'confirmed' : 'failed',
        response: body,
        confirmed_at: new Date().toISOString(),
      })
      .eq('id', match[1]);
  }

  res.set('Content-Type', 'text/plain');
  res.send('OK');
});

async function logSync(deviceId, syncType, status, message, count) {
  await supabase.from('device_sync_logs').insert({
    device_id: deviceId,
    sync_type: syncType,
    status,
    message,
    record_count: count,
  });
}

module.exports = router;
