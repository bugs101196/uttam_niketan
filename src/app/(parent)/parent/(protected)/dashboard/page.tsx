import type { Metadata } from "next";
import { attendanceRate, STATUS_LABELS } from "@/lib/attendance";
import { requireGuardian } from "@/lib/auth/guardian";
import { formatDate, todayIn } from "@/lib/dates";
import { getStudentHistory } from "@/services/attendance";
import { listOwnChildren } from "@/services/guardians";

export const metadata: Metadata = { title: "Dashboard" };

const HISTORY_DAYS = 60;

const statusStyle = {
  present: "text-green-700",
  absent: "text-red-700 font-semibold",
  late: "text-amber-700",
  excused: "text-blue-700",
} as const;

export default async function ParentDashboardPage() {
  const guardian = await requireGuardian();
  const children = await listOwnChildren(guardian);

  if (children.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Welcome, {guardian.fullName}</h1>
        <p className="mt-4 rounded-xl border border-border bg-surface p-5 text-muted">
          No children are linked to your account yet. Please contact the school office to have your child linked.
        </p>
      </div>
    );
  }

  // One school in this system today, so the default constant timezone is
  // correct; avoids needing a guardians-facing grant on public.schools just
  // for this. See src/lib/dates.ts's own default.
  const today = todayIn();
  const [y, m, d] = today.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, d - HISTORY_DAYS + 1)).toISOString().slice(0, 10);

  const childrenWithHistory = await Promise.all(
    children.map(async (child) => ({ child, ...(await getStudentHistory(child.studentId, from)) })),
  );

  return (
    <div>
      <h1 className="text-2xl font-bold">Welcome, {guardian.fullName}</h1>
      <div className="mt-6 space-y-8">
        {childrenWithHistory.map(({ child, entries, counts }) => {
          const rate = attendanceRate(counts);
          return (
            <section
              key={child.studentId}
              aria-labelledby={`child-${child.studentId}`}
              className="rounded-2xl border border-border bg-surface p-5"
            >
              <h2 id={`child-${child.studentId}`} className="text-xl font-bold text-brand">
                {child.fullName}
              </h2>
              <p className="text-sm text-muted">
                {child.className} – {child.sectionName}
                {child.relationship ? ` · ${child.relationship}` : ""} · Admission no. {child.admissionNo}
              </p>

              <h3 className="mt-4 text-sm font-semibold">Attendance — last {HISTORY_DAYS} days</h3>
              {entries.length === 0 ? (
                <p className="mt-1 text-muted">No submitted attendance in this period.</p>
              ) : (
                <>
                  <p className="mt-1 text-sm text-muted">
                    {counts.present} present · {counts.absent} absent · {counts.late} late · {counts.excused} excused
                    {rate !== null ? ` · ${rate}% attendance` : ""}
                  </p>
                  <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
                    {entries.slice(0, 10).map((e) => (
                      <li key={e.date} className="flex items-center justify-between px-4 py-2.5">
                        <span>{formatDate(e.date)}</span>
                        <span className={statusStyle[e.status]}>{STATUS_LABELS[e.status]}</span>
                      </li>
                    ))}
                  </ul>
                  {entries.length > 10 ? <p className="mt-2 text-sm text-muted">Showing the latest 10 days.</p> : null}
                </>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
