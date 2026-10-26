import Link from "next/link";
import { requireStaff } from "@/lib/auth/staff";
import { todayIn } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { getSchoolTimezone, listDaySections } from "@/services/attendance";
import { SessionStatusBadge } from "../attendance/session-status-badge";

export default async function DashboardPage() {
  const staff = await requireStaff();
  const supabase = await createClient();

  // RLS scopes every count: admins see the school, teachers their sections.
  const [students, sections, teachers] = await Promise.all([
    supabase.from("students").select("id", { count: "exact", head: true }).eq("enrollment_status", "active"),
    staff.role === "admin"
      ? supabase.from("sections").select("id", { count: "exact", head: true })
      : supabase.from("teacher_assignments").select("id", { count: "exact", head: true }).eq("teacher_id", staff.id),
    staff.role === "admin"
      ? supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "teacher")
          .eq("is_active", true)
      : Promise.resolve(null),
  ]);

  const stats = [
    { label: "Active students", value: students.count ?? 0, href: "/students" },
    { label: staff.role === "admin" ? "Sections" : "My sections", value: sections.count ?? 0 },
    ...(teachers ? [{ label: "Active teachers", value: teachers.count ?? 0, href: "/staff" }] : []),
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold">Namaste, {staff.fullName}</h1>
      <p className="mt-1 text-muted">{staff.role === "admin" ? "School overview" : "Your classes at a glance"}</p>

      <TodayAttendance />

      <ul className="mt-6 grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <li key={stat.label} className="rounded-xl border border-border bg-surface p-5">
            <p className="text-sm text-muted">{stat.label}</p>
            <p className="mt-1 text-3xl font-bold">{stat.value}</p>
            {stat.href ? (
              <Link href={stat.href} className="mt-2 inline-flex min-h-11 items-center font-semibold text-brand">
                View →
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

async function TodayAttendance() {
  const staff = await requireStaff();
  const today = todayIn(await getSchoolTimezone(staff));
  const sections = await listDaySections(staff, today);
  const done = sections.filter((s) => s.session && s.session.status !== "draft").length;
  const pending = sections.filter((s) => !s.session || s.session.status === "draft");

  return (
    <section aria-labelledby="today-attendance" className="mt-6 rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="today-attendance" className="text-lg font-bold">
          Today&apos;s attendance
        </h2>
        <Link href="/attendance" className="inline-flex min-h-11 items-center font-semibold text-brand">
          Open attendance →
        </Link>
      </div>
      <p className="text-muted">
        Submitted for {done} of {sections.length} {sections.length === 1 ? "section" : "sections"}
      </p>
      {pending.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {pending.slice(0, 12).map((s) => (
            <li key={s.id} className="flex items-center gap-2 rounded-full border border-border py-1 pr-1 pl-3 text-sm">
              {s.label}
              <SessionStatusBadge status={s.session?.status ?? null} />
            </li>
          ))}
        </ul>
      ) : sections.length > 0 ? (
        <p className="mt-2 font-semibold text-green-700">All done for today.</p>
      ) : null}
    </section>
  );
}
