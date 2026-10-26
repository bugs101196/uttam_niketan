// Marks temporary copy so placeholder text is never mistaken for approved content.
export function PlaceholderBanner({ children }: { children: React.ReactNode }) {
  return (
    <p role="note" className="rounded-md border border-accent bg-accent-soft px-3 py-2 text-sm text-foreground">
      {children}
    </p>
  );
}
