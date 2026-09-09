import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABEL } from '../utils/format';

const NAV_BY_ROLE = {
  admin: [
    { to: '/admin', label: 'Ringkasan', end: true },
    { to: '/admin/rekap', label: 'Rekap & Ekspor' },
    { to: '/admin/izin', label: 'Persetujuan Izin' },
    { to: '/admin/koreksi', label: 'Koreksi Absensi' },
    { to: '/admin/master', label: 'Data Induk' },
  ],
  pimpinan: [{ to: '/pimpinan', label: 'Ringkasan', end: true }],
  guru: [
    { to: '/guru', label: 'Riwayat Saya', end: true },
    { to: '/guru/izin', label: 'Izin / Sakit / Cuti' },
  ],
  pegawai: [
    { to: '/guru', label: 'Riwayat Saya', end: true },
    { to: '/guru/izin', label: 'Izin / Sakit / Cuti' },
  ],
};

export default function Layout({ children }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const navItems = NAV_BY_ROLE[profile?.role] || [];

  async function handleSignOut() {
    await signOut();
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex min-h-screen bg-paper text-ink">
      <aside className="flex w-64 shrink-0 flex-col justify-between bg-ink text-paper">
        <div>
          <div className="border-b border-ink-soft/40 px-6 py-6">
            <p className="font-serif text-xl tracking-tight">MUTIS</p>
            <p className="mt-0.5 text-xs text-paper/60">Absensi Fingerprint X105</p>
          </div>
          <nav className="mt-4 flex flex-col gap-0.5 px-3">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? 'bg-paper text-ink font-medium'
                      : 'text-paper/75 hover:bg-ink-soft/40 hover:text-paper'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="border-t border-ink-soft/40 px-6 py-4">
          <p className="text-sm font-medium leading-tight">{profile?.full_name}</p>
          <p className="text-xs text-paper/60">{ROLE_LABEL[profile?.role] || profile?.role}</p>
          <button
            onClick={handleSignOut}
            className="mt-3 w-full border border-paper/25 px-3 py-1.5 text-left text-xs text-paper/80 transition-colors hover:border-gold hover:text-gold"
          >
            Keluar
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
