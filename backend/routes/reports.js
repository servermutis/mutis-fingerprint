const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const supabase = require('../config/supabase');
const { requireAuth, requireRole } = require('../middleware/auth');

/**
 * Ambil data rekap sesuai filter, dipakai bersama oleh endpoint JSON & export.
 * Role guru/pegawai otomatis dibatasi hanya lihat data sendiri;
 * admin & pimpinan bisa lihat semua / per unit.
 */
async function fetchRekap(req) {
  const { start, end, unit_id, user_id } = req.query;

  let query = supabase
    .from('attendance_daily')
    .select('*, profiles(full_name, nip, unit_id, units(name))')
    .gte('tanggal', start)
    .lte('tanggal', end)
    .order('tanggal', { ascending: true });

  if (req.user.profile.role === 'guru' || req.user.profile.role === 'pegawai') {
    query = query.eq('user_id', req.user.id);
  } else if (user_id) {
    query = query.eq('user_id', user_id);
  }

  const { data, error } = await query;
  if (error) throw error;

  let rows = data;
  if (unit_id) rows = rows.filter((r) => r.profiles?.unit_id === unit_id);
  return rows;
}

// Rekap harian/bulanan dalam bentuk JSON (untuk ditampilkan di dashboard)
router.get('/rekap', requireAuth, async (req, res) => {
  try {
    const rows = await fetchRekap(req);
    res.json(rows);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Statistik ringkas untuk dashboard Pimpinan/Kepala Sekolah
router.get('/statistik', requireAuth, requireRole('admin', 'pimpinan'), async (req, res) => {
  try {
    const rows = await fetchRekap(req);
    const summary = rows.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {});
    res.json({ total_record: rows.length, per_status: summary });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Export Excel (.xlsx)
router.get('/export/excel', requireAuth, async (req, res) => {
  try {
    const rows = await fetchRekap(req);
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet('Rekap Absensi');
    sheet.columns = [
      { header: 'Tanggal', key: 'tanggal', width: 14 },
      { header: 'Nama', key: 'nama', width: 28 },
      { header: 'NIP', key: 'nip', width: 16 },
      { header: 'Unit', key: 'unit', width: 14 },
      { header: 'Jam Masuk', key: 'masuk', width: 20 },
      { header: 'Jam Pulang', key: 'pulang', width: 20 },
      { header: 'Terlambat (menit)', key: 'terlambat', width: 16 },
      { header: 'Pulang Cepat (menit)', key: 'cepat', width: 18 },
      { header: 'Status', key: 'status', width: 16 },
    ];
    rows.forEach((r) =>
      sheet.addRow({
        tanggal: r.tanggal,
        nama: r.profiles?.full_name,
        nip: r.profiles?.nip,
        unit: r.profiles?.units?.name,
        masuk: r.jam_masuk_aktual,
        pulang: r.jam_pulang_aktual,
        terlambat: r.terlambat_menit,
        cepat: r.pulang_cepat_menit,
        status: r.status,
      })
    );
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=rekap-absensi.xlsx');
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Export CSV
router.get('/export/csv', requireAuth, async (req, res) => {
  try {
    const rows = await fetchRekap(req);
    const header = 'Tanggal,Nama,NIP,Unit,JamMasuk,JamPulang,TerlambatMenit,PulangCepatMenit,Status\n';
    const body = rows
      .map((r) =>
        [
          r.tanggal,
          r.profiles?.full_name,
          r.profiles?.nip,
          r.profiles?.units?.name,
          r.jam_masuk_aktual,
          r.jam_pulang_aktual,
          r.terlambat_menit,
          r.pulang_cepat_menit,
          r.status,
        ]
          .map((v) => `"${v ?? ''}"`)
          .join(',')
      )
      .join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=rekap-absensi.csv');
    res.send(header + body);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Export PDF (siap cetak)
router.get('/export/pdf', requireAuth, async (req, res) => {
  try {
    const rows = await fetchRekap(req);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=rekap-absensi.pdf');

    const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
    doc.pipe(res);

    doc.fontSize(14).text('Rekap Absensi Guru & Pegawai', { align: 'center' });
    doc.moveDown();

    const colX = [30, 100, 260, 340, 420, 500, 580, 660, 720];
    const headers = ['Tanggal', 'Nama', 'NIP', 'Unit', 'Masuk', 'Pulang', 'Telat', 'Cepat', 'Status'];
    doc.fontSize(9).font('Helvetica-Bold');
    headers.forEach((h, i) => doc.text(h, colX[i], doc.y, { continued: i < headers.length - 1 }));
    doc.moveDown();
    doc.font('Helvetica');

    rows.forEach((r) => {
      const y = doc.y;
      doc.text(String(r.tanggal), colX[0], y, { width: 65 });
      doc.text(r.profiles?.full_name || '', colX[1], y, { width: 150 });
      doc.text(r.profiles?.nip || '', colX[2], y, { width: 70 });
      doc.text(r.profiles?.units?.name || '', colX[3], y, { width: 70 });
      doc.text(r.jam_masuk_aktual ? String(r.jam_masuk_aktual).slice(11, 16) : '-', colX[4], y, { width: 70 });
      doc.text(r.jam_pulang_aktual ? String(r.jam_pulang_aktual).slice(11, 16) : '-', colX[5], y, { width: 70 });
      doc.text(String(r.terlambat_menit), colX[6], y, { width: 60 });
      doc.text(String(r.pulang_cepat_menit), colX[7], y, { width: 60 });
      doc.text(r.status, colX[8], y, { width: 80 });
      doc.moveDown(0.5);
    });

    doc.end();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
