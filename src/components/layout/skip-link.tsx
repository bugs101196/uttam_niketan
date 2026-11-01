// First tab stop on every page: jumps keyboard users past the header.
export function SkipLink({ label }: { label: string }) {
  return (
    <a
      href="#main"
      className="sr-only rounded-md bg-surface px-4 py-2 font-semibold text-brand shadow-lg focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50"
    >
      {label}
    </a>
  );
}
