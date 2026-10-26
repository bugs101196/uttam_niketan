import "server-only";
import { createClient } from "@/lib/supabase/server";

// Admin-only screens; RLS limits every query to the admin's own school.

export interface YearSummary {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface SectionSummary {
  id: string;
  name: string;
  students: number;
  teachers: number;
}

export interface ClassSummary {
  id: string;
  name: string;
  sortOrder: number;
  sections: SectionSummary[];
}

export async function listYears(): Promise<YearSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("academic_years")
    .select("id, name, start_date, end_date, is_active")
    .order("start_date", { ascending: false });
  if (error) throw error;
  return data.map((y) => ({
    id: y.id,
    name: y.name,
    startDate: y.start_date,
    endDate: y.end_date,
    isActive: y.is_active,
  }));
}

/** Classes and sections of one year, with the counts that decide whether a delete is possible. */
export async function getYearStructure(yearId: string): Promise<ClassSummary[]> {
  const supabase = await createClient();
  const { data: classes, error } = await supabase
    .from("classes")
    .select("id, name, sort_order, sections(id, name)")
    .eq("academic_year_id", yearId)
    .order("sort_order")
    .order("name");
  if (error) throw error;

  const sectionIds = classes.flatMap((c) => c.sections.map((s) => s.id));
  const [students, assignments] = sectionIds.length
    ? await Promise.all([
        supabase.from("students").select("section_id").in("section_id", sectionIds),
        supabase.from("teacher_assignments").select("section_id").in("section_id", sectionIds),
      ])
    : [{ data: [] }, { data: [] }];
  const count = (rows: { section_id: string }[] | null, id: string) =>
    (rows ?? []).filter((r) => r.section_id === id).length;

  return classes.map((c) => ({
    id: c.id,
    name: c.name,
    sortOrder: c.sort_order,
    sections: c.sections
      .map((s) => ({
        id: s.id,
        name: s.name,
        students: count(students.data, s.id),
        teachers: count(assignments.data, s.id),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }));
}
