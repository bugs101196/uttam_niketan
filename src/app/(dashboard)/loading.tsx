// Shown while a staff page loads on a slow connection.
export default function DashboardLoading() {
  return (
    <div role="status" aria-live="polite" className="animate-pulse space-y-4">
      <span className="sr-only">Loading…</span>
      <div className="h-8 w-56 rounded-md bg-border" />
      <div className="h-4 w-40 rounded-md bg-border" />
      <div className="h-32 rounded-xl bg-border/60" />
      <div className="h-32 rounded-xl bg-border/60" />
    </div>
  );
}
