import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api';
import Spinner from '../../components/Spinner';
import EmptyState from '../../components/EmptyState';
import { LeaveStatusBadge } from '../../components/StatusBadge';
import { formatDate, LEAVE_TYPE_LABEL } from '../../utils/format';

const EMPTY_FORM = { type: 'izin', start_date: '', end_date: '', reason: '' };

export default function PengajuanIzin() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [formSuccess, setFormSuccess] = useState(false);

  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState(null);

  async function loadHistory() {
    setLoadingHistory(true);
    setHistoryError(null);
    try {
      const data = await apiRequest('/api/leave/mine');
      setHistory(data);
    } catch (err) {
      setHistoryError(err.message);
    } finally {
      setLoadingHistory(false);
    }
  }

  useEffect(() => {
    loadHistory();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(false);
    if (new Date(form.end_date) < new Date(form.start_date)) {
      setFormError('Tanggal selesai tidak boleh sebelum tanggal mulai.');
      return;
    }
    setSubmitting(true);
    try {
      await apiRequest('/api/leave', { method: 'POST', body: form });
      setForm(EMPTY_FORM);
      setFormSuccess(true);
      loadHistory();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-serif text-2xl text-ink">Izin / Sakit / Cuti</h1>
        <p className="mt-1 text-sm text-ink-faint">Ajukan ketidakhadiran dan pantau status persetujuannya.</p>
      </header>

      <div className="grid gap-8 md:grid-cols-[1fr_1.4fr]">
        <form onSubmit={handleSubmit} className="h-fit border border-line bg-paper-soft p-5">
          <p className="mb-4 font-serif text-lg text-ink">Ajukan Baru</p>

          <label className="block text-xs text-ink-faint">Jenis</label>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="mt-1 w-full border border-line bg-white px-3 py-2 text-sm"
          >
            <option value="izin">Izin</option>
            <option value="sakit">Sakit</option>
            <option value="cuti">Cuti</option>
          </select>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-ink-faint">Mulai</label>
              <input
                type="date"
                required
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className="mt-1 w-full border border-line bg-white px-2 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-ink-faint">Selesai</label>
              <input
                type="date"
                required
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                className="mt-1 w-full border border-line bg-white px-2 py-2 text-sm"
              />
            </div>
          </div>

          <label className="mt-3 block text-xs text-ink-faint">Alasan</label>
          <textarea
            required
            rows={3}
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            className="mt-1 w-full border border-line bg-white px-3 py-2 text-sm"
            placeholder="Jelaskan alasan singkat..."
          />

          {formError && <p className="mt-3 text-sm text-status-alpha">{formError}</p>}
          {formSuccess && <p className="mt-3 text-sm text-status-hadir">Pengajuan terkirim, menunggu persetujuan admin.</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-4 w-full bg-ink py-2.5 text-sm font-medium text-paper hover:bg-gold-dark disabled:opacity-60"
          >
            {submitting ? 'Mengirim...' : 'Kirim Pengajuan'}
          </button>
        </form>

        <div>
          <p className="mb-4 font-serif text-lg text-ink">Riwayat Pengajuan</p>
          {loadingHistory && <Spinner />}
          {historyError && <p className="text-sm text-status-alpha">{historyError}</p>}
          {!loadingHistory && !historyError && history.length === 0 && (
            <EmptyState title="Belum ada pengajuan" description="Riwayat pengajuan izin Anda akan muncul di sini." />
          )}
          {!loadingHistory && history.length > 0 && (
            <ul className="divide-y divide-line border-t border-b border-line">
              {history.map((h) => (
                <li key={h.id} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-ink">{LEAVE_TYPE_LABEL[h.type]}</p>
                      <p className="text-xs text-ink-faint">
                        {formatDate(h.start_date)} — {formatDate(h.end_date)}
                      </p>
                      <p className="mt-1 text-sm text-ink-soft">{h.reason}</p>
                      {h.review_note && (
                        <p className="mt-1 text-xs italic text-ink-faint">Catatan admin: {h.review_note}</p>
                      )}
                    </div>
                    <LeaveStatusBadge status={h.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
