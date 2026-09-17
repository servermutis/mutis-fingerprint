import { useEffect, useState } from 'react';
import { apiRequest, apiDownload } from '../../lib/api';
import { supabase } from '../../lib/supabaseClient';
import Spinner from '../../components/Spinner';
import EmptyState from '../../components/EmptyState';
import { formatDate, firstDayOfMonthISO, todayISO } from '../../utils/format';

export default function Laporan() {
  const [start, setStart] = useState(firstDayOfMonthISO());
  const [end, setEnd] = useState(todayISO());
  const [unitId, setUnitId] = useState('');
  const [units, setUnits] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(null);

  useEffect(() => {
    supabase.from('units').select('id, name').order('name').then(({ data }) => setUnits(data || []));
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ start, end });
      if (unitId) params.set('unit_id', unitId);
      const data = await apiRequest(`/api/reports/laporan-kehadiran?${params.toString()}`);
      setRows(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleExport(format) {
    setDownloading(format);
    try {
      const ext = format === 'excel' ? 'xlsx' : format;
      const params = new URLSearchParams({ start, end });
      if (unitId) params.set('unit_id', unitId);
      await apiDownload(`/api/reports/laporan-kehadiran/export/${format}?${params.toString()}`, `laporan-rekap-absensi.${ext}`);
    } catch (err) {
      alert(`Gagal mengunduh: ${err.message}`);
    } finally {
      setDownloading(null);
    }
  }

  const unitLabel = unitId ? units.find((u) => u.id === unitId)?.name || '-' : 'Semua Unit';

  return (
    <div>
      <header className="mb-6 print:hidden">
        <h1 className="font-serif text-2xl text-ink">Laporan Rekap Absensi</h1>
        <p className="mt-1 text-sm text-ink-faint">
          Rekap jumlah kehadiran per guru/pegawai — sesuai format laporan resmi.
        </p>
      </header>

      <div className="mb-5 flex flex-wrap items-end gap-4 border border-line bg-paper-soft p-4 print:hidden">
        <div>
          <label className="block text-xs text-ink-faint">Dari tanggal</label>
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="mt-1 border border-line bg-white px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-ink-faint">Sampai tanggal</label>
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="mt-1 border border-line bg-white px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-ink-faint">Unit</label>
          <select
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            className="mt-1 border border-line bg-white px-2 py-1.5 text-sm"
          >
            <option value="">Semua unit</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
        <button onClick={load} className="border border-ink px-3 py-1.5 text-sm text-ink hover:bg-ink hover:text-paper">
          Terapkan
        </button>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => window.print()}
            className="border border-ink px-3 py-1.5 text-xs uppercase tracking-wide text-ink hover:bg-ink hover:text-paper"
          >
            Cetak
          </button>
          {['excel', 'pdf'].map((f) => (
            <button
              key={f}
              onClick={() => handleExport(f)}
              disabled={downloading === f}
              className="border border-ink px-3 py-1.5 text-xs uppercase tracking-wide text-ink hover:bg-ink hover:text-paper disabled:opacity-50"
            >
              {downloading === f ? '...' : f}
            </button>
          ))}
        </div>
      </div>

      {loading && <Spinner />}
      {error && <p className="text-sm text-status-alpha">{error}</p>}

      {!loading && !error && (
        <div id="laporan-print-area" className="border border-line bg-white p-6">
          <div className="mb-4 text-center">
            <p className="font-serif text-xl font-semibold text-ink">LAPORAN REKAP ABSENSI</p>
          </div>
          <p className="text-sm text-ink">
            <span className="font-medium">UNIT</span> : {unitLabel}
          </p>
          <p className="mb-4 text-sm text-ink">
            <span className="font-medium">TANGGAL</span> : {formatDate(start)} S/D {formatDate(end)}
          </p>

          {rows.length === 0 ? (
            <EmptyState title="Tidak ada data" description="Coba ubah rentang tanggal atau filter unit." />
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th rowSpan={2} className="border border-ink px-2 py-1.5 align-middle">NO</th>
                  <th rowSpan={2} className="border border-ink px-2 py-1.5 align-middle">NAMA GURU/PEGAWAI</th>
                  <th colSpan={6} className="border border-ink px-2 py-1.5">JUMLAH KEHADIRAN</th>
                </tr>
                <tr>
                  <th className="border border-ink px-2 py-1.5">MASUK</th>
                  <th className="border border-ink px-2 py-1.5">PULANG</th>
                  <th className="border border-ink px-2 py-1.5">TELAT</th>
                  <th className="border border-ink px-2 py-1.5">IZIN</th>
                  <th className="border border-ink px-2 py-1.5">SAKIT</th>
                  <th className="border border-ink px-2 py-1.5">CUTI</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={r.user_id}>
                    <td className="border border-line px-2 py-1.5 text-center">{idx + 1}</td>
                    <td className="border border-line px-2 py-1.5">{r.full_name}</td>
                    <td className="border border-line px-2 py-1.5 text-center tabular-nums">{r.masuk}</td>
                    <td className="border border-line px-2 py-1.5 text-center tabular-nums">{r.pulang}</td>
                    <td className="border border-line px-2 py-1.5 text-center tabular-nums">{r.telat}</td>
                    <td className="border border-line px-2 py-1.5 text-center tabular-nums">{r.izin}</td>
                    <td className="border border-line px-2 py-1.5 text-center tabular-nums">{r.sakit}</td>
                    <td className="border border-line px-2 py-1.5 text-center tabular-nums">{r.cuti}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
