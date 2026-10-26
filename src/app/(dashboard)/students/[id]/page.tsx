import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert } from "@/components/ui/form";
import { requireStaff } from "@/lib/auth/staff";
import { getStudent, listSectionOptions } from "@/services/students";
import { updateStudent } from "../actions";
import { StatusBadge } from "../status-badge";
import { StudentForm } from "../student-form";
import { AttendanceHistory } from "./attendance-history";

export const metadata: Metadata = { title: "Student" };

const savedMessages: Record<string, string> = {
  created: "Student added.",
  updated: "Changes saved.",
};

export default async function StudentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const staff = await requireStaff();
  const { id } = await params;
  const { saved } = await searchParams;

  // RLS returns nothing for students outside a teacher's sections.
  const student = await getStudent(id);
  if (!student) notFound();

  const header = (
    <>
      <Link href="/students" className="inline-flex min-h-11 items-center font-semibold text-brand">
        ← Students
      </Link>
      <div className="mt-2 mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{student.full_name}</h1>
        <StatusBadge status={student.enrollment_status} />
      </div>
      {saved && savedMessages[saved] ? (
        <div className="mb-6">
          <Alert tone="success">{savedMessages[saved]}</Alert>
        </div>
      ) : null}
    </>
  );

  if (staff.role !== "admin") {
    // Teachers get the roster details they need; guardian contact details stay with the office.
    const rows = [
      ["Admission number", student.admission_no],
      ["Class and section", `${student.sections.classes.name} – ${student.sections.name}`],
      ["Roll number", student.roll_no ?? "—"],
      ["Message language", student.preferred_language === "hi" ? "Hindi" : "English"],
    ];
    return (
      <div className="max-w-3xl">
        {header}
        <dl className="divide-y divide-border rounded-xl border border-border bg-surface">
          {rows.map(([label, value]) => (
            <div key={label} className="grid gap-1 px-4 py-3 sm:grid-cols-3">
              <dt className="text-muted">{label}</dt>
              <dd className="font-medium sm:col-span-2">{value}</dd>
            </div>
          ))}
        </dl>
        <AttendanceHistory studentId={student.id} />
      </div>
    );
  }

  const sections = await listSectionOptions(staff);
  // Keep the current section selectable even if it is not in the active year.
  if (!sections.some((s) => s.id === student.section_id)) {
    sections.unshift({ id: student.section_id, label: `${student.sections.classes.name} – ${student.sections.name}` });
  }

  return (
    <div className="max-w-3xl">
      {header}
      <StudentForm
        action={updateStudent.bind(null, student.id)}
        initial={{
          admission_no: student.admission_no,
          full_name: student.full_name,
          section_id: student.section_id,
          roll_no: student.roll_no?.toString() ?? "",
          guardian_name: student.guardian_name ?? "",
          guardian_phone: student.guardian_phone ?? "",
          preferred_language: student.preferred_language,
          guardian_notifications_consent: student.guardian_notifications_consent,
          enrollment_status: student.enrollment_status,
        }}
        sections={sections}
        submitLabel="Save changes"
        showStatus
      />
      <AttendanceHistory studentId={student.id} />
    </div>
  );
}
