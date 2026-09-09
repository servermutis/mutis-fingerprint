import { Link } from 'react-router-dom';

export default function NotAuthorized() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-paper px-6 text-center">
      <p className="font-serif text-2xl text-ink">Tidak punya akses</p>
      <p className="mt-2 max-w-sm text-sm text-ink-faint">
        Akun Anda tidak memiliki peran yang sesuai untuk membuka halaman ini.
      </p>
      <Link to="/" className="mt-6 border border-ink px-4 py-2 text-sm text-ink hover:bg-ink hover:text-paper">
        Kembali ke Beranda
      </Link>
    </div>
  );
}
