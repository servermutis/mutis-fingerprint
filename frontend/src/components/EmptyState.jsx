export default function EmptyState({ title, description }) {
  return (
    <div className="border border-dashed border-line px-6 py-10 text-center">
      <p className="font-serif text-lg text-ink">{title}</p>
      {description && <p className="mt-1 text-sm text-ink-faint">{description}</p>}
    </div>
  );
}
