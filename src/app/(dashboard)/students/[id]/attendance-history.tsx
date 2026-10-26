import { attendanceRate, STATUS_LABELS } from "@/lib/attendance";
import { requireStaff } from "@/lib/auth/staff";
import { formatDate, todayIn } from "@/lib/dates";
import { getSchoolTimezone, getStudentHistory } from "@/services/attendance";

const HISTORY_DAYS = 60;

const statusStyle = {
  present: "text-green-700",
  absent: "text-red-700 font-semibold",
  late: "text-amber-700",
  excused: "text-blue-700",
} as const;

/** Last 60 days of submitted attendance for one student. */
export async function AttendanceHistory({ studentId }: { studentId: string }) {
  const staff = await requireStaff();
  const today = todayIn(await getSchoolTimezone(staff));
  const [y, m, d] = today.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, d - HISTORY_DAYS + 1)).toISOString().slice(0, 10);
  const { entries, counts } = await getStudentHistory(studentId, from);
  const rate = attendanceRate(counts);

  return (
    <section aria-labelledby="attendance-history" className="mt-10">
      <h2 id="attendance-history" className="text-lg font-bold">
        Attendance — last {HISTORY_DAYS} days
      </h2>
      {entries.length === 0 ? (
        <p className="mt-2 text-muted">No submitted attendance in this period.</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted">
            {counts.present} present · {counts.absent} absent · {counts.late} late · {counts.excused} excused
            {rate !== null ? ` · ${rate}% attendance` : ""}
          </p>
          <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-surface">
            {entries.slice(0, 30).map((e) => (
              <li key={e.date} className="flex items-center justify-between px-4 py-2.5">
                <span>{formatDate(e.date)}</span>
                <span className={statusStyle[e.status]}>{STATUS_LABELS[e.status]}</span>
              </li>
            ))}
          </ul>
          {entries.length > 30 ? <p className="mt-2 text-sm text-muted">Showing the latest 30 days.</p> : null}
        </>
      )}
    </section>
  );
}
