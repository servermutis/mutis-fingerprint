import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api';
import { supabase } from '../../lib/supabaseClient';
import Spinner from '../../components/Spinner';
import EmptyState from '../../components/EmptyState';
import { formatDate, formatTime } from '../../utils/format';

const DAILY_STATUS_OPTIONS = [
  'hadir',
  'terlambat',
  'pulang_cepat',
  'terlambat_dan_pulang_cepat',
  'alpha',
  'izin',
  'sakit',
  'cuti',
  'libur',
];

function RemapForm({ log, profiles, onDone }) {
  const [userId, setUserId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!userId) return;
    setBusy(true);
    setError(null);
    try {
      await apiRequest('/api/corrections/remap-pin', {
        method: 'POST',
        body: { device_user_pin: log.device_user_pin, user_id: userId },
      });
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 flex flex-wrap items-center gap-2">
      <select
        required
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
        className="border border-line bg-white px-2 py-1.5 text-sm"
      >
        <option value="">Petakan ke...</option>
        {profiles.map((p) => (
          <option key={p.id} value={p.id}>{p.full_name}</option>
        ))}
      </select>
      <button
        type="submit"
        disabled={busy}
        className="border border-ink px-3 py-1.5 text-xs text-ink hover:bg-ink hover:text-paper disabled:opacity-50"
      >
        {busy ? 'Menyimpan...' : 'Petakan PIN'}
      </button>
      {error && <span className="text-xs text-status-alpha">{error}</span>}
    </form>
  );
}

function ManualCorrectionForm() {
  const [profiles, setProfiles] = useState([]);
  const [form, setForm] = useState({
    user_id: '',
    tanggal: '',
    jam_masuk_aktual: '',
    jam_pulang_aktual: '',
    status: 'hadir',
    corrected_note: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    supabase.from('profiles').select('id, full_name').order('full_name').then(({ data }) => setProfiles(data || []));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(false);
    try {
      const { user_id, tanggal, ...body } = form;
      await apiRequest(`/api/corrections/daily/${user_id}/${tanggal}`, {
        method: 'PATCH',
        body: {
          ...body,
          jam_masuk_aktual: body.jam_masuk_aktual ? `${tanggal}T${body.jam_masuk_aktual}:00` : null,
          jam_pulang_aktual: body.jam_pulang_aktual ? `${tanggal}T${body.jam_pulang_aktual}:00` : null,
        },
      });
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border border-line bg-paper-soft p-5">
      <p className="mb-4 font-serif text-lg text-ink">Koreksi Manual per Hari</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs text-ink-faint">Orang</label>
          <select
            required
            value={form.user_id}
            onChange={(e) => setForm({ ...form, user_id: e.target.value })}
            className="mt-1 w-full border border-line bg-white px-2 py-2 text-sm"
          >
            <option value="">Pilih...</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>{p.full_name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-ink-faint">Tanggal</label>
          <input
            type="date"
            required
            value={form.tanggal}
            onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
            className="mt-1 w-full border border-line bg-white px-2 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-ink-faint">Jam Masuk</label>
          <input
            type="time"
            value={form.jam_masuk_aktual}
            onChange={(e) => setForm({ ...form, jam_masuk_aktual: e.target.value })}
            className="mt-1 w-full border border-line bg-white px-2 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-ink-faint">Jam Pulang</label>
          <input
            type="time"
            value={form.jam_pulang_aktual}
            onChange={(e) => setForm({ ...form, jam_pulang_aktual: e.target.value })}
            className="mt-1 w-full border border-line bg-white px-2 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-ink-faint">Status</label>
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            className="mt-1 w-full border border-line bg-white px-2 py-2 text-sm"
          >
            {DAILY_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-ink-faint">Catatan</label>
          <input
            type="text"
            value={form.corrected_note}
            onChange={(e) => setForm({ ...form, corrected_note: e.target.value })}
            className="mt-1 w-full border border-line bg-white px-2 py-2 text-sm"
            placeholder="Alasan koreksi..."
          />
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-status-alpha">{error}</p>}
      {success && <p className="mt-3 text-sm text-status-hadir">Koreksi tersimpan.</p>}

      <button
        type="submit"
        disabled={busy}
        className="mt-4 bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-gold-dark disabled:opacity-60"
      >
        {busy ? 'Menyimpan...' : 'Simpan Koreksi'}
      </button>
    </form>
  );
}

export default function KoreksiAbsensi() {
  const [logs, setLogs] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function loadLogs() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest('/api/corrections/unmapped-logs');
      setLogs(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLogs();
    supabase.from('profiles').select('id, full_name').order('full_name').then(({ data }) => setProfiles(data || []));
  }, []);

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-serif text-2xl text-ink">Koreksi Absensi</h1>
        <p className="mt-1 text-sm text-ink-faint">
          Petakan PIN mesin yang belum dikenali, atau koreksi manual satu hari tertentu.
        </p>
      </header>

      <div className="mb-8">
        <p className="mb-3 font-serif text-lg text-ink">Log Belum Termapping</p>
        {loading && <Spinner />}
        {error && <p className="text-sm text-status-alpha">{error}</p>}
        {!loading && !error && logs.length === 0 && (
          <EmptyState title="Tidak ada log tersisa" description="Semua PIN dari mesin sudah termapping ke profil." />
        )}
        <div className="space-y-3">
          {logs.map((log) => (
            <div key={log.id} className="border border-line bg-paper-soft p-4">
              <p className="text-sm text-ink">
                PIN <span className="font-medium">{log.device_user_pin}</span> — {formatDate(log.scan_time)} {formatTime(log.scan_time)}
              </p>
              <p className="text-xs text-ink-faint">Sumber: {log.source} · Mode: {log.verify_mode}</p>
              <RemapForm log={log} profiles={profiles} onDone={loadLogs} />
            </div>
          ))}
        </div>
      </div>

      <ManualCorrectionForm />
    </div>
  );
}
