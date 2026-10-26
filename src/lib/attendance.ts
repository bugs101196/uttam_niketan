import { z } from "zod";
import { isIsoDate } from "@/lib/dates";
import type { DbErrorLike } from "@/lib/db-errors";
import { ATTENDANCE_STATUSES, type AttendanceStatus } from "./attendance-status";

// Client components import from ./attendance-status directly, so Zod is not
// shipped to the browser.
export { ATTENDANCE_STATUSES, STATUS_LABELS, type AttendanceStatus } from "./attendance-status";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export const attendanceRecordsSchema = z
  .array(
    z.object({
      student_id: z.string().uuid(),
      status: z.enum(ATTENDANCE_STATUSES),
    }),
  )
  .max(500)
  .refine((rows) => new Set(rows.map((r) => r.student_id)).size === rows.length, {
    message: "A student appears more than once",
  });

export const startSessionSchema = z.object({
  section_id: z.string().uuid("Choose a class and section"),
  date: z.string().refine(isIsoDate, "Choose a valid date"),
});

export const correctionSchema = z.object({
  student_id: z.string().uuid(),
  status: z.enum(ATTENDANCE_STATUSES, { message: "Choose a status" }),
  reason: z.string().trim().min(3, "Give a short reason for the correction").max(300),
});

// ---------------------------------------------------------------------------
// Error messages
// ---------------------------------------------------------------------------

// The attendance database functions raise these messages (see the
// 20261026000200 migration). Map them to wording for school staff instead of
// showing database text directly.
const knownMessages: { match: RegExp; message: string }[] = [
  { match: /future date/i, message: "Attendance cannot be taken for a future date." },
  { match: /outside the academic year/i, message: "That date is outside the current academic year." },
  { match: /missing for (\d+) student/i, message: "Mark every student before submitting." },
  {
    match: /roster changed/i,
    message: "The class list changed since this draft was saved. Reload the page and check again.",
  },
  {
    match: /not in this section's active roster/i,
    message: "The class list has changed. Reload the page and try again.",
  },
  { match: /already been submitted/i, message: "This attendance has already been submitted." },
  { match: /only submitted, unlocked/i, message: "This day is locked and can no longer be corrected." },
  { match: /only submitted attendance can be locked/i, message: "Only submitted attendance can be locked." },
  { match: /reason are required/i, message: "Give a short reason for the correction." },
];

export function describeAttendanceError(error: DbErrorLike): string {
  const missing = error.message?.match(/missing for (\d+) student/i);
  if (missing) {
    const n = Number(missing[1]);
    return `Mark every student before submitting (${n} ${n === 1 ? "student is" : "students are"} not marked).`;
  }
  const known = knownMessages.find((k) => k.match.test(error.message ?? ""));
  if (known) return known.message;
  if (error.code === "42501") return "You do not have permission to do this.";
  if (error.code === "P0002") return "That attendance record could not be found.";
  return "Something went wrong. Please try again.";
}

// ---------------------------------------------------------------------------
// Summaries (computed from saved records only)
// ---------------------------------------------------------------------------

export interface StatusCounts {
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
}

export function emptyCounts(): StatusCounts {
  return { present: 0, absent: 0, late: 0, excused: 0, total: 0 };
}

export function countStatuses(statuses: Iterable<AttendanceStatus>): StatusCounts {
  const counts = emptyCounts();
  for (const s of statuses) {
    counts[s] += 1;
    counts.total += 1;
  }
  return counts;
}

export function addCounts(a: StatusCounts, b: StatusCounts): StatusCounts {
  return {
    present: a.present + b.present,
    absent: a.absent + b.absent,
    late: a.late + b.late,
    excused: a.excused + b.excused,
    total: a.total + b.total,
  };
}

/**
 * Share of marked days the student attended. Late counts as attended;
 * excused days are left out of the denominator. Null when nothing counts.
 */
export function attendanceRate(c: StatusCounts): number | null {
  const counted = c.present + c.late + c.absent;
  if (counted === 0) return null;
  return Math.round(((c.present + c.late) / counted) * 1000) / 10;
}

export function isFinalStatus(sessionStatus: string): boolean {
  return sessionStatus === "submitted" || sessionStatus === "locked";
}
