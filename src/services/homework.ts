import "server-only";
import type { Staff } from "@/lib/auth/staff";
import { createClient } from "@/lib/supabase/server";
import type { HomeworkInput } from "@/lib/validation/homework";

export interface HomeworkItem {
  id: string;
  sectionId: string;
  sectionLabel: string; // "Class 1 – A"
  subject: string;
  descriptionEn: string;
  descriptionHi: string;
  dueDate: string;
  createdBy: string;
  createdAt: string;
}

const SELECT = "id, section_id, subject, description_en, description_hi, due_date, created_by, created_at, sections!inner(name, classes!inner(name))";

function toItem(row: {
  id: string;
  section_id: string;
  subject: string;
  description_en: string;
  description_hi: string;
  due_date: string;
  created_by: string;
  created_at: string;
  sections: { name: string; classes: { name: string } };
}): HomeworkItem {
  return {
    id: row.id,
    sectionId: row.section_id,
    sectionLabel: `${row.sections.classes.name} – ${row.sections.name}`,
    subject: row.subject,
    descriptionEn: row.description_en,
    descriptionHi: row.description_hi,
    dueDate: row.due_date,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

/**
 * Homework visible to the signed-in caller -- RLS decides the scope:
 * admin/office see it school-wide, a teacher sees their assigned sections,
 * a guardian sees their own linked children's sections. Same query for
 * every caller, same as src/services/attendance.ts's getStudentHistory().
 */
export async function listHomework(): Promise<HomeworkItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("homework")
    .select(SELECT)
    .order("due_date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toItem);
}

export async function createHomework(staff: Staff, input: HomeworkInput) {
  const supabase = await createClient();
  const { error } = await supabase.from("homework").insert({
    school_id: staff.schoolId,
    section_id: input.section_id,
    subject: input.subject,
    description_en: input.description_en,
    description_hi: input.description_hi,
    due_date: input.due_date,
    created_by: staff.id,
  });
  if (error) throw error;
}

export async function updateHomework(id: string, input: HomeworkInput) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("homework")
    .update({
      section_id: input.section_id,
      subject: input.subject,
      description_en: input.description_en,
      description_hi: input.description_hi,
      due_date: input.due_date,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteHomework(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("homework").delete().eq("id", id);
  if (error) throw error;
}

export async function getHomework(id: string): Promise<HomeworkItem | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("homework").select(SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toItem(data) : null;
}
