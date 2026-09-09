import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../lib/api';
import { supabase } from '../../lib/supabaseClient';
import Spinner from '../../components/Spinner';
import { STATUS_LABEL, firstDayOfMonthISO, todayISO } from '../../utils/format';

function StatCard({ label, value, to }) {
  const content = (
    <div className="border border-line bg-paper-soft p-5 transition-colors hover:border-gold">
      <p className="text-xs uppercase tracking-wide text-ink-faint">{label}</p>
      <p className="mt-2 font-serif text-3xl text-ink">{value}</p>
    </div>
  );
  return to ? <Link to={to}>{content}</Link> : content;
}

export default function DashboardAdmin() {
  const [stat, setStat] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [unmappedCount, setUnmappedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const start = firstDayOfMonthISO();
        const end = todayISO();
        const [statistik, pending, unmapped] = await Promise.all([
          apiRequest(`/api/reports/statistik?start=${start}&end=${end}`),
          apiRequest('/api/leave/pending'),
          apiRequest('/api/corrections/unmapped-logs'),
        ]);
        if (!active) return;
        setStat(statistik);
        setPendingCount(pending.length);
        setUnmappedCount(unmapped.length);
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-serif text-2xl text-ink">Ringkasan</h1>
        <p className="mt-1 text-sm text-ink-faint">Bulan berjalan, per {todayISO()}.</p>
      </header>

      {loading && <Spinner />}
      {error && <p className="text-sm text-status-alpha">{error}</p>}

      {!loading && !error && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total Rekap Bulan Ini" value={stat?.total_record ?? 0} to="/admin/rekap" />
            <StatCard label="Izin Menunggu Persetujuan" value={pendingCount} to="/admin/izin" />
            <StatCard label="Log Belum Termapping" value={unmappedCount} to="/admin/koreksi" />
            <StatCard
              label="Alpha Bulan Ini"
              value={stat?.per_status?.alpha ?? 0}
              to="/admin/rekap"
            />
          </div>

          <div className="mt-8">
            <p className="mb-3 font-serif text-lg text-ink">Sebaran Status</p>
            {!stat || Object.keys(stat.per_status || {}).length === 0 ? (
              <p className="text-sm text-ink-faint">Belum ada data untuk bulan ini.</p>
            ) : (
              <table className="w-full max-w-md border-collapse text-sm">
                <tbody>
                  {Object.entries(stat.per_status).map(([status, count]) => (
                    <tr key={status} className="border-b border-line">
                      <td className="py-2 pr-4 text-ink-soft">{STATUS_LABEL[status] || status}</td>
                      <td className="py-2 text-right tabular-nums text-ink">{count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
