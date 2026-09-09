import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api';
import Spinner from '../../components/Spinner';
import EmptyState from '../../components/EmptyState';
import { formatDate, LEAVE_TYPE_LABEL } from '../../utils/format';

export default function ApproveIzin() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [notes, setNotes] = useState({});

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest('/api/leave/pending');
      setItems(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleReview(id, status) {
    setBusyId(id);
    try {
      await apiRequest(`/api/leave/${id}/review`, {
        method: 'PATCH',
        body: { status, review_note: notes[id] || '' },
      });
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      alert(`Gagal memproses: ${err.message}`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-serif text-2xl text-ink">Persetujuan Izin</h1>
        <p className="mt-1 text-sm text-ink-faint">
          Menyetujui akan otomatis menandai tanggal terkait pada rekap kehadiran.
        </p>
      </header>

      {loading && <Spinner />}
      {error && <p className="text-sm text-status-alpha">{error}</p>}
      {!loading && !error && items.length === 0 && (
        <EmptyState title="Tidak ada yang menunggu" description="Semua pengajuan izin sudah diproses." />
      )}

      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.id} className="border border-line bg-paper-soft p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-medium text-ink">
                  {item.profiles?.full_name} <span className="font-normal text-ink-faint">— {LEAVE_TYPE_LABEL[item.type]}</span>
                </p>
                <p className="mt-0.5 text-sm text-ink-faint">
                  {formatDate(item.start_date)} — {formatDate(item.end_date)}
                </p>
                <p className="mt-2 text-sm text-ink-soft">{item.reason}</p>
              </div>
            </div>

            <input
              type="text"
              placeholder="Catatan (opsional)"
              value={notes[item.id] || ''}
              onChange={(e) => setNotes({ ...notes, [item.id]: e.target.value })}
              className="mt-3 w-full max-w-md border border-line bg-white px-3 py-1.5 text-sm"
            />

            <div className="mt-3 flex gap-2">
              <button
                onClick={() => handleReview(item.id, 'approved')}
                disabled={busyId === item.id}
                className="border border-status-hadir px-3 py-1.5 text-sm text-status-hadir hover:bg-status-hadir hover:text-white disabled:opacity-50"
              >
                Setujui
              </button>
              <button
                onClick={() => handleReview(item.id, 'rejected')}
                disabled={busyId === item.id}
                className="border border-status-alpha px-3 py-1.5 text-sm text-status-alpha hover:bg-status-alpha hover:text-white disabled:opacity-50"
              >
                Tolak
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
