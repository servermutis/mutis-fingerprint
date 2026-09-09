import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Spinner from './components/Spinner';

import Login from './pages/Login';
import NotAuthorized from './pages/NotAuthorized';

import RiwayatSaya from './pages/guru/RiwayatSaya';
import PengajuanIzin from './pages/guru/PengajuanIzin';

import DashboardAdmin from './pages/admin/DashboardAdmin';
import Rekap from './pages/admin/Rekap';
import ApproveIzin from './pages/admin/ApproveIzin';
import KoreksiAbsensi from './pages/admin/KoreksiAbsensi';
import MasterData from './pages/admin/MasterData';

import DashboardPimpinan from './pages/pimpinan/DashboardPimpinan';

function HomeRedirect() {
  const { profile, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <Spinner />
      </div>
    );
  }
  if (!profile) return <Navigate to="/login" replace />;
  if (profile.role === 'admin') return <Navigate to="/admin" replace />;
  if (profile.role === 'pimpinan') return <Navigate to="/pimpinan" replace />;
  return <Navigate to="/guru" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/tidak-diizinkan" element={<NotAuthorized />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <HomeRedirect />
          </ProtectedRoute>
        }
      />

      {/* Guru & Pegawai */}
      <Route
        path="/guru"
        element={
          <ProtectedRoute allowedRoles={['guru', 'pegawai']}>
            <Layout>
              <RiwayatSaya />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/guru/izin"
        element={
          <ProtectedRoute allowedRoles={['guru', 'pegawai']}>
            <Layout>
              <PengajuanIzin />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Admin */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Layout>
              <DashboardAdmin />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/rekap"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Layout>
              <Rekap />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/izin"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Layout>
              <ApproveIzin />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/koreksi"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Layout>
              <KoreksiAbsensi />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/master"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Layout>
              <MasterData />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Pimpinan */}
      <Route
        path="/pimpinan"
        element={
          <ProtectedRoute allowedRoles={['pimpinan']}>
            <Layout>
              <DashboardPimpinan />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
