import type { SessionStatus } from "@/services/attendance";

const styles: Record<SessionStatus | "none", { label: string; className: string }> = {
  none: { label: "Not taken", className: "border-gray-200 bg-gray-100 text-gray-700" },
  draft: { label: "Draft", className: "border-amber-200 bg-amber-50 text-amber-800" },
  submitted: { label: "Submitted", className: "border-green-200 bg-green-50 text-green-800" },
  locked: { label: "Locked", className: "border-blue-200 bg-blue-50 text-blue-800" },
};

export function SessionStatusBadge({ status }: { status: SessionStatus | null }) {
  const style = styles[status ?? "none"];
  return (
    <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-sm font-medium ${style.className}`}>
      {style.label}
    </span>
  );
}
