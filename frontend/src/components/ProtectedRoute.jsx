import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Spinner from './Spinner';

export default function ProtectedRoute({ allowedRoles, children }) {
  const { session, profile, profileError, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <Spinner label="Memeriksa sesi login..." />
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  if (profileError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-6">
        <div className="max-w-md border border-line bg-paper-soft p-6 text-center">
          <p className="font-serif text-lg text-ink">Profil belum lengkap</p>
          <p className="mt-2 text-sm text-ink-soft">{profileError}</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <Spinner label="Memuat profil..." />
      </div>
    );
  }

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/tidak-diizinkan" replace />;
  }

  return children;
}
