import Link from "next/link";
import { requireStaff } from "@/lib/auth/staff";
import { createClient } from "@/lib/supabase/server";

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

      <p className="mt-8 rounded-lg border border-border bg-surface p-4 text-muted">
        Attendance and reports arrive in the next release.
      </p>
    </div>
  );
}
