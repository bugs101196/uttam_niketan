import type { Metadata } from "next";
import Link from "next/link";
import { Alert, Button, Input } from "@/components/ui/form";
import { requireStaff } from "@/lib/auth/staff";
import { formatDate, isIsoDate, todayIn } from "@/lib/dates";
import { getSchoolTimezone, listDaySections, type DaySection } from "@/services/attendance";
import { startAttendance } from "./actions";
import { SessionStatusBadge } from "./session-status-badge";

export const metadata: Metadata = { title: "Attendance" };

const errors: Record<string, string> = {
  invalid: "Choose a class, section and a valid date.",
  future: "Attendance cannot be taken for a future date.",
  "outside-year": "That date is outside the current academic year.",
  forbidden: "You can only take attendance for your assigned sections.",
  failed: "Attendance could not be opened. Please try again.",
};

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const staff = await requireStaff();
  const params = await searchParams;
  const today = todayIn(await getSchoolTimezone(staff));
  const date = isIsoDate(params.date) && params.date <= today ? params.date : today;
  const sections = await listDaySections(staff, date);

  const submitted = sections.filter((s) => s.session && s.session.status !== "draft").length;

  return (
    <div>
      <h1 className="text-2xl font-bold">Attendance</h1>
      <p className="text-muted">{date === today ? "Today" : formatDate(date)}</p>

      <form className="mt-4 flex flex-wrap items-end gap-3" aria-label="Choose date">
        <div>
          <label htmlFor="date" className="mb-1 block font-medium">
            Date
          </label>
          <Input id="date" name="date" type="date" defaultValue={date} max={today} />
        </div>
        <Button type="submit" variant="secondary">
          Show
        </Button>
        {date !== today ? (
          <Link href="/attendance" className="inline-flex min-h-12 items-center font-semibold text-brand">
            Back to today
          </Link>
        ) : null}
      </form>

      {params.error && errors[params.error] ? (
        <div className="mt-4">
          <Alert tone="error">{errors[params.error]}</Alert>
        </div>
      ) : null}

      {sections.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-border bg-surface p-8 text-center text-muted">
          {staff.role === "admin"
            ? "No classes are set up for the current academic year."
            : "You are not assigned to any section yet. Please ask the school office."}
        </div>
      ) : (
        <>
          <p className="mt-6 text-sm text-muted" aria-live="polite">
            Submitted for {submitted} of {sections.length} {sections.length === 1 ? "section" : "sections"}
          </p>
          <ul className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {sections.map((section) => (
              <SectionRow key={section.id} section={section} date={date} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function SectionRow({ section, date }: { section: DaySection; date: string }) {
  const { session } = section;
  const summary = session
    ? session.status === "draft"
      ? `Draft · ${session.counts.total} of ${section.activeStudents} marked`
      : `${session.counts.present + session.counts.late} present · ${session.counts.absent} absent` +
        (session.counts.excused ? ` · ${session.counts.excused} excused` : "")
    : `${section.activeStudents} ${section.activeStudents === 1 ? "student" : "students"}`;

  return (
    <li className="flex min-h-16 flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="font-semibold">{section.label}</p>
        <p className="text-sm text-muted">{summary}</p>
      </div>
      <div className="flex items-center gap-3">
        <SessionStatusBadge status={session?.status ?? null} />
        {session ? (
          <Link
            href={`/attendance/${session.id}`}
            className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 font-semibold hover:bg-accent-soft"
          >
            {session.status === "draft" ? "Continue" : "View"}
          </Link>
        ) : section.activeStudents > 0 ? (
          <form action={startAttendance}>
            <input type="hidden" name="section_id" value={section.id} />
            <input type="hidden" name="date" value={date} />
            <Button type="submit">Take attendance</Button>
          </form>
        ) : null}
      </div>
    </li>
  );
}
