"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Alert, Button } from "@/components/ui/form";
import { ATTENDANCE_STATUSES, STATUS_LABELS, type AttendanceStatus } from "@/lib/attendance-status";
import type { RosterRow } from "@/services/attendance";
import { saveAttendanceDraft, submitAttendance } from "../actions";

const SHORT: Record<AttendanceStatus, string> = { present: "P", absent: "A", late: "L", excused: "E" };

const selectedStyles: Record<AttendanceStatus, string> = {
  present: "border-green-600 bg-green-600 text-white",
  absent: "border-red-600 bg-red-600 text-white",
  late: "border-amber-500 bg-amber-500 text-white",
  excused: "border-blue-600 bg-blue-600 text-white",
};

export function RosterEditor({
  sessionId,
  rows,
  dateLabel,
}: {
  sessionId: string;
  rows: RosterRow[];
  dateLabel: string;
}) {
  const router = useRouter();
  const [marks, setMarks] = useState<Record<string, AttendanceStatus | null>>(() =>
    Object.fromEntries(rows.map((r) => [r.studentId, r.status])),
  );
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, late: 0, excused: 0, unmarked: 0 };
    for (const r of rows) {
      const m = marks[r.studentId];
      if (m) c[m] += 1;
      else c.unmarked += 1;
    }
    return c;
  }, [marks, rows]);

  // Warn before leaving with unsaved marks.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function mark(studentId: string, status: AttendanceStatus) {
    setMarks((m) => ({ ...m, [studentId]: status }));
    setDirty(true);
    setMessage(null);
  }

  function markRemainingPresent() {
    setMarks((m) => Object.fromEntries(Object.entries(m).map(([id, s]) => [id, s ?? "present"])));
    setDirty(true);
    setMessage(null);
  }

  const records = () =>
    Object.entries(marks)
      .filter((entry): entry is [string, AttendanceStatus] => entry[1] !== null)
      .map(([student_id, status]) => ({ student_id, status }));

  function save() {
    startTransition(async () => {
      const result = await saveAttendanceDraft(sessionId, records());
      if (result.ok) {
        setDirty(false);
        setMessage({ tone: "success", text: "Draft saved." });
      } else {
        setMessage({ tone: "error", text: result.message ?? "Could not save. Please try again." });
      }
    });
  }

  function submit() {
    const summary =
      `Submit attendance for ${dateLabel}?\n\n` +
      `Present: ${counts.present}  Absent: ${counts.absent}  Late: ${counts.late}  Excused: ${counts.excused}\n\n` +
      "After submitting, only the school office can make corrections.";
    if (!window.confirm(summary)) return;
    startTransition(async () => {
      const result = await submitAttendance(sessionId, records());
      if (result.ok) {
        setDirty(false);
        router.refresh();
      } else {
        setMessage({ tone: "error", text: result.message ?? "Could not submit. Please try again." });
      }
    });
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center text-muted">
        There are no active students in this section.
      </div>
    );
  }

  return (
    <div className="pb-40">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">Tap P (present), A (absent), L (late) or E (excused) for each student.</p>
        <Button type="button" variant="secondary" onClick={markRemainingPresent} disabled={counts.unmarked === 0}>
          Mark unmarked as present
        </Button>
      </div>

      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
        {rows.map((row) => {
          const current = marks[row.studentId];
          return (
            <li
              key={row.studentId}
              className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${current === "absent" ? "bg-red-50" : ""}`}
            >
              <div className="min-w-0">
                <p className="font-semibold">
                  {row.rollNo ? <span className="mr-2 text-muted">{row.rollNo}.</span> : null}
                  {row.name}
                </p>
                {current === null ? <p className="text-sm text-amber-700">Not marked</p> : null}
              </div>
              <div role="radiogroup" aria-label={`Attendance for ${row.name}`} className="flex gap-1.5">
                {ATTENDANCE_STATUSES.map((status) => {
                  const selected = current === status;
                  return (
                    <button
                      key={status}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={STATUS_LABELS[status]}
                      title={STATUS_LABELS[status]}
                      onClick={() => mark(row.studentId, status)}
                      className={`size-11 rounded-lg border-2 text-base font-bold transition-colors ${
                        selected ? selectedStyles[status] : "border-border bg-surface text-muted hover:bg-accent-soft"
                      }`}
                    >
                      {SHORT[status]}
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto max-w-6xl space-y-2 px-4 py-3">
          {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm" aria-live="polite">
              <span className="font-semibold text-green-700">{counts.present} P</span> ·{" "}
              <span className="font-semibold text-red-700">{counts.absent} A</span> · {counts.late} L · {counts.excused}{" "}
              E{counts.unmarked ? <span className="text-amber-700"> · {counts.unmarked} not marked</span> : null}
              {dirty ? <span className="text-muted"> · unsaved changes</span> : null}
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={save} disabled={pending || !dirty}>
                {pending ? "Saving…" : "Save draft"}
              </Button>
              <Button type="button" onClick={submit} disabled={pending || counts.unmarked > 0}>
                Submit
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
