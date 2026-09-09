import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { session, signIn, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && session) return <Navigate to="/" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(err.message === 'Invalid login credentials' ? 'Email atau kata sandi salah.' : err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-serif text-3xl text-ink">MUTIS</p>
          <p className="mt-1 text-sm text-ink-faint">Absensi Guru & Pegawai — Fingerprint X105</p>
        </div>

        <form onSubmit={handleSubmit} className="border border-line bg-paper-soft p-7">
          <label className="block text-sm text-ink-soft" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-gold"
            placeholder="nama@sekolah.sch.id"
          />

          <label className="mt-4 block text-sm text-ink-soft" htmlFor="password">
            Kata Sandi
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-gold"
            placeholder="••••••••"
          />

          {error && <p className="mt-3 text-sm text-status-alpha">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 w-full bg-ink py-2.5 text-sm font-medium text-paper transition-colors hover:bg-gold-dark disabled:opacity-60"
          >
            {submitting ? 'Memproses...' : 'Masuk'}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-ink-faint">
          Lupa kata sandi? Hubungi admin unit Anda.
        </p>
      </div>
    </div>
  );
}
