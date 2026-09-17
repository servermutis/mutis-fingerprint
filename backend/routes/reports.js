const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const supabase = require('../config/supabase');
const { requireAuth, requireRole } = require('../middleware/auth');

/**
 * Format timestamptz (tersimpan UTC di Postgres) menjadi jam WIB 24-jam
 * "HH:mm:ss" untuk ditampilkan di laporan. Selalu pakai ini, jangan pernah
 * slice string ISO mentah - itu masih dalam UTC, bukan WIB.
 */
function formatJamWIB(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Ambil data rekap sesuai filter, dipakai bersama oleh endpoint JSON & export.
 * Role guru/pegawai otomatis dibatasi hanya lihat data sendiri;
 * admin & pimpinan bisa lihat semua / per unit.
 */
async function fetchRekap(req) {
  const { start, end, unit_id, user_id } = req.query;

  let query = supabase
    .from('attendance_daily')
    .select('*, profiles!attendance_daily_user_id_fkey(full_name, nip, unit_id, units(name))')
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
        masuk: formatJamWIB(r.jam_masuk_aktual),
        pulang: formatJamWIB(r.jam_pulang_aktual),
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
          formatJamWIB(r.jam_masuk_aktual),
          formatJamWIB(r.jam_pulang_aktual),
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
      doc.text(formatJamWIB(r.jam_masuk_aktual) || '-', colX[4], y, { width: 70 });
      doc.text(formatJamWIB(r.jam_pulang_aktual) || '-', colX[5], y, { width: 70 });
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

/**
 * Agregasi untuk Laporan Rekap Absensi resmi (per orang, per unit):
 * jumlah hari Masuk/Pulang/Telat/Izin/Sakit/Cuti dalam satu rentang tanggal.
 * Reuse fetchRekap() supaya filter (start/end/unit_id/role) tetap konsisten.
 */
async function fetchLaporanKehadiran(req) {
  const rows = await fetchRekap(req);

  const byUser = new Map();
  for (const r of rows) {
    const uid = r.user_id;
    if (!byUser.has(uid)) {
      byUser.set(uid, {
        user_id: uid,
        full_name: r.profiles?.full_name || '-',
        nip: r.profiles?.nip || '',
        unit_name: r.profiles?.units?.name || '-',
        masuk: 0,
        pulang: 0,
        telat: 0,
        izin: 0,
        sakit: 0,
        cuti: 0,
      });
    }
    const agg = byUser.get(uid);
    if (r.jam_masuk_aktual) agg.masuk += 1;
    if (r.jam_pulang_aktual) agg.pulang += 1;
    if (r.status === 'terlambat' || r.status === 'terlambat_dan_pulang_cepat') agg.telat += 1;
    if (r.status === 'izin') agg.izin += 1;
    if (r.status === 'sakit') agg.sakit += 1;
    if (r.status === 'cuti') agg.cuti += 1;
  }

  return Array.from(byUser.values()).sort((a, b) => a.full_name.localeCompare(b.full_name, 'id'));
}

async function resolveUnitLabel(unit_id) {
  if (!unit_id) return 'Semua Unit';
  const { data } = await supabase.from('units').select('name').eq('id', unit_id).single();
  return data?.name || unit_id;
}

// Laporan Rekap Absensi dalam bentuk JSON (untuk tabel di halaman Laporan)
router.get('/laporan-kehadiran', requireAuth, requireRole('admin', 'pimpinan'), async (req, res) => {
  try {
    const data = await fetchLaporanKehadiran(req);
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Export Excel Laporan Rekap Absensi, mengikuti format resmi sekolah
router.get('/laporan-kehadiran/export/excel', requireAuth, requireRole('admin', 'pimpinan'), async (req, res) => {
  try {
    const { start, end, unit_id } = req.query;
    const data = await fetchLaporanKehadiran(req);
    const unitLabel = await resolveUnitLabel(unit_id);

    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet('Laporan Rekap Absensi');

    sheet.mergeCells('A1:H1');
    sheet.getCell('A1').value = 'LAPORAN REKAP ABSENSI';
    sheet.getCell('A1').alignment = { horizontal: 'center' };
    sheet.getCell('A1').font = { bold: true, size: 14 };

    sheet.getCell('A2').value = `UNIT : ${unitLabel}`;
    sheet.getCell('A3').value = `TANGGAL : ${start}  S/D  ${end}`;

    const headerRow = 5;
    sheet.mergeCells(`A${headerRow}:A${headerRow + 1}`);
    sheet.getCell(`A${headerRow}`).value = 'NO';
    sheet.mergeCells(`B${headerRow}:B${headerRow + 1}`);
    sheet.getCell(`B${headerRow}`).value = 'NAMA GURU/PEGAWAI';
    sheet.mergeCells(`C${headerRow}:H${headerRow}`);
    sheet.getCell(`C${headerRow}`).value = 'JUMLAH KEHADIRAN';
    ['MASUK', 'PULANG', 'TELAT', 'IZIN', 'SAKIT', 'CUTI'].forEach((h, i) => {
      sheet.getCell(headerRow + 1, 3 + i).value = h;
    });

    for (let r = headerRow; r <= headerRow + 1; r++) {
      for (let c = 1; c <= 8; c++) {
        const cell = sheet.getCell(r, c);
        cell.font = { bold: true };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      }
    }

    data.forEach((d, idx) => {
      const rowIdx = headerRow + 2 + idx;
      const values = [idx + 1, d.full_name, d.masuk, d.pulang, d.telat, d.izin, d.sakit, d.cuti];
      values.forEach((v, c) => {
        const cell = sheet.getCell(rowIdx, c + 1);
        cell.value = v;
        cell.alignment = { horizontal: c <= 1 ? 'left' : 'center' };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });
    });

    sheet.columns = [{ width: 5 }, { width: 32 }, { width: 9 }, { width: 9 }, { width: 9 }, { width: 9 }, { width: 9 }, { width: 9 }];

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=laporan-rekap-absensi.xlsx');
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Export PDF Laporan Rekap Absensi, mengikuti format resmi sekolah
router.get('/laporan-kehadiran/export/pdf', requireAuth, requireRole('admin', 'pimpinan'), async (req, res) => {
  try {
    const { start, end, unit_id } = req.query;
    const data = await fetchLaporanKehadiran(req);
    const unitLabel = await resolveUnitLabel(unit_id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=laporan-rekap-absensi.pdf');

    const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
    doc.pipe(res);

    doc.fontSize(14).font('Helvetica-Bold').text('LAPORAN REKAP ABSENSI', { align: 'center' });
    doc.moveDown(0.4);
    doc.fontSize(10).font('Helvetica');
    doc.text(`UNIT : ${unitLabel}`);
    doc.text(`TANGGAL : ${start}  S/D  ${end}`);
    doc.moveDown();

    const colX = [30, 60, 270, 350, 430, 510, 590, 670];
    const colW = [30, 200, 75, 75, 75, 75, 75, 75];
    const headers = ['NO', 'NAMA GURU/PEGAWAI', 'MASUK', 'PULANG', 'TELAT', 'IZIN', 'SAKIT', 'CUTI'];

    function drawRow(y, values) {
      values.forEach((v, i) => {
        doc.text(String(v ?? ''), colX[i], y, { width: colW[i], align: i >= 2 ? 'center' : 'left' });
      });
    }

    doc.font('Helvetica-Bold').fontSize(9);
    drawRow(doc.y, headers);
    doc.moveDown();
    doc.moveTo(30, doc.y).lineTo(745, doc.y).stroke();
    doc.moveDown(0.3);
    doc.font('Helvetica');

    data.forEach((d, idx) => {
      const y = doc.y;
      drawRow(y, [idx + 1, d.full_name, d.masuk, d.pulang, d.telat, d.izin, d.sakit, d.cuti]);
      doc.moveDown(0.6);
    });

    doc.end();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;