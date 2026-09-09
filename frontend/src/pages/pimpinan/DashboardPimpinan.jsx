import { useEffect, useState } from 'react';
import { apiRequest, apiDownload } from '../../lib/api';
import { supabase } from '../../lib/supabaseClient';
import Spinner from '../../components/Spinner';
import EmptyState from '../../components/EmptyState';
import { DailyStatusBadge } from '../../components/StatusBadge';
import { STATUS_LABEL, formatDate, formatTime, firstDayOfMonthISO, todayISO } from '../../utils/format';

export default function DashboardPimpinan() {
  const [start, setStart] = useState(firstDayOfMonthISO());
  const [end, setEnd] = useState(todayISO());
  const [unitId, setUnitId] = useState('');
  const [units, setUnits] = useState([]);
  const [stat, setStat] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(null);

  useEffect(() => {
    supabase.from('units').select('id, name').then(({ data }) => setUnits(data || []));
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ start, end });
      if (unitId) params.set('unit_id', unitId);
      const [statistik, rekap] = await Promise.all([
        apiRequest(`/api/reports/statistik?${params.toString()}`),
        apiRequest(`/api/reports/rekap?${params.toString()}`),
      ]);
      setStat(statistik);
      setRows(rekap);
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
      await apiDownload(`/api/reports/export/${format}?${params.toString()}`, `rekap-absensi.${ext}`);
    } catch (err) {
      alert(`Gagal mengunduh: ${err.message}`);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-serif text-2xl text-ink">Ringkasan Kehadiran</h1>
        <p className="mt-1 text-sm text-ink-faint">Tampilan hanya-lihat untuk Pimpinan.</p>
      </header>

      <div className="mb-5 flex flex-wrap items-end gap-4 border border-line bg-paper-soft p-4">
        <div>
          <label className="block text-xs text-ink-faint">Dari tanggal</label>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 border border-line bg-white px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-ink-faint">Sampai tanggal</label>
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="mt-1 border border-line bg-white px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-ink-faint">Unit</label>
          <select value={unitId} onChange={(e) => setUnitId(e.target.value)} className="mt-1 border border-line bg-white px-2 py-1.5 text-sm">
            <option value="">Semua unit</option>
            {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <button onClick={load} className="border border-ink px-3 py-1.5 text-sm text-ink hover:bg-ink hover:text-paper">
          Terapkan
        </button>
        <div className="ml-auto flex gap-2">
          {['excel', 'csv', 'pdf'].map((f) => (
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
        <>
          {stat && (
            <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="border border-line bg-paper-soft p-5">
                <p className="text-xs uppercase tracking-wide text-ink-faint">Total Rekap</p>
                <p className="mt-2 font-serif text-3xl text-ink">{stat.total_record}</p>
              </div>
              {Object.entries(stat.per_status).slice(0, 3).map(([status, count]) => (
                <div key={status} className="border border-line bg-paper-soft p-5">
                  <p className="text-xs uppercase tracking-wide text-ink-faint">{STATUS_LABEL[status] || status}</p>
                  <p className="mt-2 font-serif text-3xl text-ink">{count}</p>
                </div>
              ))}
            </div>
          )}

          {rows.length === 0 ? (
            <EmptyState title="Tidak ada data" description="Coba ubah rentang tanggal atau filter unit." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-ink text-left text-ink-soft">
                    <th className="py-2 pr-4 font-medium">Tanggal</th>
                    <th className="py-2 pr-4 font-medium">Nama</th>
                    <th className="py-2 pr-4 font-medium">Unit</th>
                    <th className="py-2 pr-4 font-medium">Masuk</th>
                    <th className="py-2 pr-4 font-medium">Pulang</th>
                    <th className="py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-line">
                      <td className="py-2.5 pr-4">{formatDate(r.tanggal)}</td>
                      <td className="py-2.5 pr-4">{r.profiles?.full_name}</td>
                      <td className="py-2.5 pr-4 text-ink-faint">{r.profiles?.units?.name || '-'}</td>
                      <td className="py-2.5 pr-4 tabular-nums">{formatTime(r.jam_masuk_aktual)}</td>
                      <td className="py-2.5 pr-4 tabular-nums">{formatTime(r.jam_pulang_aktual)}</td>
                      <td className="py-2.5"><DailyStatusBadge status={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
