export default function Spinner({ label = 'Memuat...' }) {
  return (
    <div className="flex items-center gap-3 py-10 text-ink-faint">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-gold" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
