import type { EnrollmentStatus } from "@/services/students";

const styles: Record<EnrollmentStatus, string> = {
  active: "bg-green-50 text-green-800 border-green-200",
  inactive: "bg-gray-100 text-gray-700 border-gray-200",
  transferred: "bg-amber-50 text-amber-800 border-amber-200",
};

export function StatusBadge({ status }: { status: EnrollmentStatus }) {
  return (
    <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-sm font-medium capitalize ${styles[status]}`}>
      {status}
    </span>
  );
}
