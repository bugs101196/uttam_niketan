import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/staff";
import { listSectionOptions } from "@/services/students";
import { createStudent } from "../actions";
import { emptyStudent, StudentForm } from "../student-form";

export const metadata: Metadata = { title: "Add student" };

export default async function NewStudentPage() {
  const staff = await requireAdmin();
  const sections = await listSectionOptions(staff);

  return (
    <div className="max-w-3xl">
      <Link href="/students" className="inline-flex min-h-11 items-center font-semibold text-brand">
        ← Students
      </Link>
      <h1 className="mt-2 mb-6 text-2xl font-bold">Add student</h1>
      <StudentForm
        action={createStudent}
        initial={emptyStudent}
        sections={sections}
        submitLabel="Add student"
        showStatus={false}
      />
    </div>
  );
}
