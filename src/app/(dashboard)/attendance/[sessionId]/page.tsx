import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/form";
import { countStatuses, STATUS_LABELS, type AttendanceStatus } from "@/lib/attendance";
import { requireStaff } from "@/lib/auth/staff";
import { formatDate, formatDateTime } from "@/lib/dates";
import { getSessionDetail, getSessionHistory, type HistoryEntry } from "@/services/attendance";
import { lockAttendance } from "../actions";
import { SessionStatusBadge } from "../session-status-badge";
import { CorrectionForm } from "./correction-form";
import { RosterEditor } from "./roster-editor";

export const metadata: Metadata = { title: "Attendance" };

const statusText: Record<AttendanceStatus, string> = {
  present: "text-green-700",
  absent: "text-red-700 font-semibold",
  late: "text-amber-700",
  excused: "text-blue-700",
};

export default async function SessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const staff = await requireStaff();
  const { sessionId } = await params;
  // RLS hides sessions outside a teacher's sections, so they get a 404.
  const session = await getSessionDetail(sessionId);
  if (!session) notFound();

  const isAdmin = staff.role === "admin";
  const history = isAdmin && session.status !== "draft" ? await getSessionHistory(session.id) : [];
  const counts = countStatuses(session.roster.flatMap((r) => (r.status ? [r.status] : [])));

  return (
    <div>
      <Link
        href={`/attendance?date=${session.date}`}
        className="inline-flex min-h-11 items-center font-semibold text-brand"
      >
        ← Attendance
      </Link>
      <div className="mt-1 mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{session.sectionLabel}</h1>
        <SessionStatusBadge status={session.status} />
      </div>
      <p className="-mt-2 mb-4 text-muted">{formatDate(session.date)}</p>

      {session.status === "draft" ? (
        <RosterEditor sessionId={session.id} rows={session.roster} dateLabel={formatDate(session.date)} />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(["present", "absent", "late", "excused"] as const).map((s) => (
              <div key={s} className="rounded-xl border border-border bg-surface p-3">
                <p className="text-sm text-muted">{STATUS_LABELS[s]}</p>
                <p className="text-2xl font-bold">{counts[s]}</p>
              </div>
            ))}
          </div>

          <p className="mb-3 text-sm text-muted">
            {session.status === "locked"
              ? "Locked — no further changes can be made."
              : isAdmin
                ? "Submitted. Use “Correct” to change a mark; every correction is recorded."
                : "Submitted. Ask the school office if a mark needs to be corrected."}
          </p>

          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {session.roster.map((row) => (
              <li key={row.studentId} className={`px-4 py-3 ${row.status === "absent" ? "bg-red-50" : ""}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {row.rollNo ? <span className="mr-2 text-muted">{row.rollNo}.</span> : null}
                    {row.name}
                  </p>
                  <span className={row.status ? statusText[row.status] : "text-muted"}>
                    {row.status ? STATUS_LABELS[row.status] : "—"}
                  </span>
                </div>
                {isAdmin && session.status === "submitted" && row.status ? (
                  <details className="mt-1">
                    <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold text-brand">
                      Correct
                    </summary>
                    <CorrectionForm
                      sessionId={session.id}
                      studentId={row.studentId}
                      studentName={row.name}
                      current={row.status}
                    />
                  </details>
                ) : null}
              </li>
            ))}
          </ul>

          {isAdmin ? (
            <section aria-labelledby="history" className="mt-8">
              <h2 id="history" className="mb-2 text-lg font-bold">
                History
              </h2>
              <ol className="space-y-2">
                {history.map((entry, i) => (
                  <li key={i} className="rounded-lg border border-border bg-surface px-4 py-3 text-sm">
                    <HistoryLine entry={entry} roster={session.roster} />
                  </li>
                ))}
              </ol>
              {session.status === "submitted" ? (
                <form action={lockAttendance.bind(null, session.id)} className="mt-4">
                  <Button type="submit" variant="secondary">
                    Lock this day
                  </Button>
                  <p className="mt-1 text-sm text-muted">Locking prevents any further corrections.</p>
                </form>
              ) : null}
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

function HistoryLine({ entry, roster }: { entry: HistoryEntry; roster: { studentId: string; name: string }[] }) {
  const when = <span className="text-muted">{formatDateTime(entry.at)}</span>;
  if (entry.action === "attendance.corrected") {
    const name = roster.find((r) => r.studentId === entry.details.student_id)?.name ?? "A student";
    const from = STATUS_LABELS[entry.details.from as AttendanceStatus] ?? String(entry.details.from);
    const to = STATUS_LABELS[entry.details.to as AttendanceStatus] ?? String(entry.details.to);
    return (
      <p>
        {when} — <strong>{entry.actor}</strong> changed {name} from {from} to {to}. Reason: “
        {String(entry.details.reason ?? "")}”
      </p>
    );
  }
  if (entry.action === "attendance.submitted") {
    return (
      <p>
        {when} — <strong>{entry.actor}</strong> submitted attendance ({String(entry.details.absent_count ?? 0)} absent).
      </p>
    );
  }
  if (entry.action === "attendance.locked") {
    return (
      <p>
        {when} — <strong>{entry.actor}</strong> locked this day.
      </p>
    );
  }
  return (
    <p>
      {when} — {entry.action}
    </p>
  );
}
