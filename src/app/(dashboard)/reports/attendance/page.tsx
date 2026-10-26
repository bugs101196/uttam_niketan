import type { Metadata } from "next";
import Link from "next/link";
import { Button, Input, Select } from "@/components/ui/form";
import { addCounts, attendanceRate, emptyCounts, type StatusCounts } from "@/lib/attendance";
import { requireStaff } from "@/lib/auth/staff";
import { formatDate, formatMonth, isIsoDate, isIsoMonth, monthRange, todayIn } from "@/lib/dates";
import { getMonthlyReport, getSchoolTimezone, listDaySections } from "@/services/attendance";
import { listSectionOptions } from "@/services/students";
import { SessionStatusBadge } from "../../attendance/session-status-badge";

export const metadata: Metadata = { title: "Attendance reports" };

function rate(c: StatusCounts) {
  const r = attendanceRate(c);
  return r === null ? "—" : `${r}%`;
}

export default async function AttendanceReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const staff = await requireStaff();
  const params = await searchParams;
  const today = todayIn(await getSchoolTimezone(staff));
  const view = params.view === "monthly" ? "monthly" : "daily";

  return (
    <div>
      <h1 className="text-2xl font-bold">Attendance reports</h1>
      <p className="text-muted">
        Totals use submitted attendance only. Days not yet submitted are never counted as absent.
      </p>

      <nav aria-label="Report type" className="mt-4 flex gap-2">
        {(["daily", "monthly"] as const).map((v) => (
          <Link
            key={v}
            href={`/reports/attendance?view=${v}`}
            aria-current={view === v ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-lg border px-4 font-semibold ${
              view === v ? "border-brand bg-brand text-brand-contrast" : "border-border bg-surface hover:bg-accent-soft"
            }`}
          >
            {v === "daily" ? "Daily" : "Monthly by student"}
          </Link>
        ))}
      </nav>

      {view === "daily" ? (
        <DailyReport date={isIsoDate(params.date) && params.date <= today ? params.date : today} today={today} />
      ) : (
        <MonthlyReport
          month={isIsoMonth(params.month) && params.month <= today.slice(0, 7) ? params.month : today.slice(0, 7)}
          sectionParam={params.section}
          today={today}
        />
      )}
    </div>
  );
}

async function DailyReport({ date, today }: { date: string; today: string }) {
  const staff = await requireStaff();
  const sections = await listDaySections(staff, date);
  const final = sections.filter((s) => s.session && s.session.status !== "draft");
  const totals = final.reduce((sum, s) => addCounts(sum, s.session!.counts), emptyCounts());

  return (
    <section className="mt-6" aria-labelledby="daily-title">
      <form className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="view" value="daily" />
        <div>
          <label htmlFor="date" className="mb-1 block font-medium">
            Date
          </label>
          <Input id="date" name="date" type="date" defaultValue={date} max={today} />
        </div>
        <Button type="submit" variant="secondary">
          Show
        </Button>
      </form>

      <h2 id="daily-title" className="mt-6 text-lg font-bold">
        {formatDate(date)}
      </h2>
      <p className="text-sm text-muted">
        Submitted for {final.length} of {sections.length} sections
      </p>

      <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[34rem] text-left text-sm">
          <thead className="border-b border-border bg-background">
            <tr>
              <th className="px-4 py-3 font-semibold">Section</th>
              <th className="px-3 py-3 font-semibold">Status</th>
              <th className="px-3 py-3 text-right font-semibold">Present</th>
              <th className="px-3 py-3 text-right font-semibold">Absent</th>
              <th className="px-3 py-3 text-right font-semibold">Late</th>
              <th className="px-3 py-3 text-right font-semibold">Excused</th>
              <th className="px-3 py-3 text-right font-semibold">Rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sections.map((s) => {
              const counted = s.session && s.session.status !== "draft" ? s.session.counts : null;
              return (
                <tr key={s.id}>
                  <td className="px-4 py-3 font-medium">
                    {s.session ? (
                      <Link href={`/attendance/${s.session.id}`} className="text-brand hover:underline">
                        {s.label}
                      </Link>
                    ) : (
                      s.label
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <SessionStatusBadge status={s.session?.status ?? null} />
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{counted?.present ?? "—"}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{counted?.absent ?? "—"}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{counted?.late ?? "—"}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{counted?.excused ?? "—"}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{counted ? rate(counted) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
          {final.length > 0 ? (
            <tfoot className="border-t-2 border-border font-semibold">
              <tr>
                <td className="px-4 py-3" colSpan={2}>
                  Total (submitted)
                </td>
                <td className="px-3 py-3 text-right tabular-nums">{totals.present}</td>
                <td className="px-3 py-3 text-right tabular-nums">{totals.absent}</td>
                <td className="px-3 py-3 text-right tabular-nums">{totals.late}</td>
                <td className="px-3 py-3 text-right tabular-nums">{totals.excused}</td>
                <td className="px-3 py-3 text-right tabular-nums">{rate(totals)}</td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </section>
  );
}

async function MonthlyReport({
  month,
  sectionParam,
  today,
}: {
  month: string;
  sectionParam: string | undefined;
  today: string;
}) {
  const staff = await requireStaff();
  const sections = await listSectionOptions(staff);
  const section = sections.find((s) => s.id === sectionParam) ?? sections[0];

  if (!section) {
    return <p className="mt-6 text-muted">No sections available.</p>;
  }

  const { from, to } = monthRange(month);
  const report = await getMonthlyReport(section.id, from, to > today ? today : to);

  return (
    <section className="mt-6" aria-labelledby="monthly-title">
      <form className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <input type="hidden" name="view" value="monthly" />
        <div>
          <label htmlFor="section" className="mb-1 block font-medium">
            Class and section
          </label>
          <Select id="section" name="section" defaultValue={section.id}>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="month" className="mb-1 block font-medium">
            Month
          </label>
          <Input id="month" name="month" type="month" defaultValue={month} max={today.slice(0, 7)} />
        </div>
        <Button type="submit" variant="secondary">
          Show
        </Button>
      </form>

      <h2 id="monthly-title" className="mt-6 text-lg font-bold">
        {section.label} · {formatMonth(month)}
      </h2>
      <p className="text-sm text-muted">
        {report.daysTaken} {report.daysTaken === 1 ? "day" : "days"} of submitted attendance
        {report.draftDates.length > 0
          ? ` · ${report.draftDates.length} more ${report.draftDates.length === 1 ? "day is" : "days are"} still in draft and not counted`
          : ""}
      </p>

      {report.rows.length === 0 ? (
        <p className="mt-3 text-muted">No students in this section.</p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="border-b border-border bg-background">
              <tr>
                <th className="px-4 py-3 font-semibold">Student</th>
                <th className="px-3 py-3 text-right font-semibold">Present</th>
                <th className="px-3 py-3 text-right font-semibold">Absent</th>
                <th className="px-3 py-3 text-right font-semibold">Late</th>
                <th className="px-3 py-3 text-right font-semibold">Excused</th>
                <th className="px-3 py-3 text-right font-semibold">Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {report.rows.map((row) => {
                const r = attendanceRate(row.counts);
                return (
                  <tr key={row.studentId} className={r !== null && r < 75 ? "bg-red-50" : undefined}>
                    <td className="px-4 py-3 font-medium">
                      {row.rollNo ? <span className="mr-2 text-muted">{row.rollNo}.</span> : null}
                      <Link href={`/students/${row.studentId}`} className="hover:underline">
                        {row.name}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{row.counts.present}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{row.counts.absent}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{row.counts.late}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{row.counts.excused}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{rate(row.counts)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-sm text-muted">
        Rate = (present + late) ÷ (present + late + absent). Excused days are not counted. Rows below 75% are
        highlighted.
      </p>
    </section>
  );
}
