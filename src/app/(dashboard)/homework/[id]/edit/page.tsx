import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/staff";
import { getHomework } from "@/services/homework";
import { listSectionOptions } from "@/services/students";
import { updateHomeworkAction } from "../../actions";
import { HomeworkForm } from "../../forms";

export const metadata: Metadata = { title: "Edit homework" };

export default async function EditHomeworkPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const { id } = await params;
  const [item, sections] = await Promise.all([getHomework(id), listSectionOptions(staff)]);

  // RLS already enforces this on the actual update; a 404 here avoids showing
  // a form that would just fail (not found at all, or visible but not editable).
  if (!item || (staff.role !== "admin" && item.createdBy !== staff.id)) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Edit homework</h1>
        <p className="text-muted">
          {item.subject} · {item.sectionLabel}
        </p>
      </div>
      <HomeworkForm
        action={updateHomeworkAction.bind(null, id)}
        sections={sections}
        submitLabel="Save changes"
        pendingLabel="Saving…"
        defaultValues={{
          section_id: item.sectionId,
          subject: item.subject,
          description_en: item.descriptionEn,
          description_hi: item.descriptionHi,
          due_date: item.dueDate,
        }}
      />
    </div>
  );
}
