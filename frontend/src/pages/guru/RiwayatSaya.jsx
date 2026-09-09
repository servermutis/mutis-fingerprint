import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { apiDownload } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import Spinner from '../../components/Spinner';
import EmptyState from '../../components/EmptyState';
import { DailyStatusBadge } from '../../components/StatusBadge';
import { formatDate, formatTime, firstDayOfMonthISO, todayISO } from '../../utils/format';

export default function RiwayatSaya() {
  const { user } = useAuth();
  const [start, setStart] = useState(firstDayOfMonthISO());
  const [end, setEnd] = useState(todayISO());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      const { data, error: err } = await supabase
        .from('attendance_daily')
        .select('*')
        .eq('user_id', user.id)
        .gte('tanggal', start)
        .lte('tanggal', end)
        .order('tanggal', { ascending: false });
      if (!active) return;
      if (err) setError(err.message);
      else setRows(data);
      setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, [user.id, start, end]);

  async function handleExport(format) {
    setDownloading(format);
    try {
      const ext = format === 'excel' ? 'xlsx' : format;
      await apiDownload(`/api/reports/export/${format}?start=${start}&end=${end}`, `riwayat-absensi.${ext}`);
    } catch (err) {
      alert(`Gagal mengunduh: ${err.message}`);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div>
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-serif text-2xl text-ink">Riwayat Kehadiran Saya</h1>
          <p className="mt-1 text-sm text-ink-faint">Direkap otomatis dari mesin fingerprint X105.</p>
        </div>
      </header>

      <div className="mb-5 flex flex-wrap items-end gap-4 border border-line bg-paper-soft p-4">
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

      {!loading && !error && rows.length === 0 && (
        <EmptyState title="Belum ada data" description="Tidak ada rekap kehadiran pada rentang tanggal ini." />
      )}

      {!loading && rows.length > 0 && (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-ink text-left text-ink-soft">
              <th className="py-2 pr-4 font-medium">Tanggal</th>
              <th className="py-2 pr-4 font-medium">Jam Masuk</th>
              <th className="py-2 pr-4 font-medium">Jam Pulang</th>
              <th className="py-2 pr-4 font-medium">Terlambat</th>
              <th className="py-2 pr-4 font-medium">Pulang Cepat</th>
              <th className="py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line">
                <td className="py-2.5 pr-4">{formatDate(r.tanggal)}</td>
                <td className="py-2.5 pr-4 tabular-nums">{formatTime(r.jam_masuk_aktual)}</td>
                <td className="py-2.5 pr-4 tabular-nums">{formatTime(r.jam_pulang_aktual)}</td>
                <td className="py-2.5 pr-4 tabular-nums">
                  {r.terlambat_menit > 0 ? `${r.terlambat_menit} mnt` : '-'}
                </td>
                <td className="py-2.5 pr-4 tabular-nums">
                  {r.pulang_cepat_menit > 0 ? `${r.pulang_cepat_menit} mnt` : '-'}
                </td>
                <td className="py-2.5">
                  <DailyStatusBadge status={r.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
