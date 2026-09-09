/**
 * Parser untuk payload protokol ADMS (Auto Data Master Server) yang dipakai
 * mesin ZKTeco/Solution X105 saat push data ke server.
 *
 * PENTING: field VerifyMode dan Status ke bawah adalah mapping UMUM ZKTeco.
 * Sebelum go-live, ambil beberapa baris log ATTLOG asli dari X105
 * (bisa dilihat lewat log request masuk di server ini) lalu cocokkan
 * urutan kolomnya - firmware berbeda kadang menambah/mengurangi kolom.
 */

const STATUS_MAP = {
  0: 'check_in',
  1: 'check_out',
  2: 'break_out',
  3: 'break_in',
  4: 'overtime_in',
  5: 'overtime_out',
};

const VERIFY_MAP = {
  0: 'password',
  1: 'fingerprint',
  2: 'card',
  15: 'face',
};

/**
 * Parse body dari POST /iclock/cdata?table=ATTLOG
 * Format tiap baris (dipisah \t):
 *   PIN  Time                Status  Verify  WorkCode
 *   1    2024-01-15 08:03:12 0       1       0
 */
function parseAttlog(rawBody) {
  const lines = rawBody.split('\n').map((l) => l.trim()).filter(Boolean);
  return lines.map((line) => {
    const cols = line.split('\t');
    const [pin, time, status, verify] = cols;
    return {
      device_user_pin: pin,
      scan_time: time, // format 'YYYY-MM-DD HH:mm:ss', aman langsung ke Postgres timestamptz
      status: STATUS_MAP[Number(status)] || 'unknown',
      verify_mode: VERIFY_MAP[Number(verify)] || 'unknown',
      raw_payload: line,
    };
  });
}

/**
 * Parse body dari POST /iclock/cdata?table=OPERLOG (data user/fingerprint template)
 * Baris diawali tag, contoh:
 *   USER PIN=1  Name=Budi Santoso  Pri=0  Card=  Grp=1  ...
 *   FP PIN=1  FID=0  Valid=1  TMP=base64template...
 */
function parseOperlog(rawBody) {
  const lines = rawBody.split('\n').map((l) => l.trim()).filter(Boolean);
  const users = [];
  const fingerprints = [];

  for (const line of lines) {
    if (line.startsWith('USER')) {
      const fields = extractKeyValue(line);
      users.push({
        device_user_pin: fields.PIN,
        name: fields.Name,
        raw_payload: line,
      });
    } else if (line.startsWith('FP')) {
      const fields = extractKeyValue(line);
      fingerprints.push({
        device_user_pin: fields.PIN,
        finger_index: fields.FID,
        template_base64: fields.TMP,
      });
    }
  }
  return { users, fingerprints };
}

function extractKeyValue(line) {
  const parts = line.split('\t').slice(1); // buang tag awal (USER/FP)
  const result = {};
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    result[part.substring(0, idx)] = part.substring(idx + 1);
  }
  return result;
}

module.exports = { parseAttlog, parseOperlog, STATUS_MAP, VERIFY_MAP };
