import "server-only";
import type { Staff } from "@/lib/auth/staff";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

// All queries use the signed-in user's client, so RLS decides what is visible:
// admins see their school, teachers only their assigned sections.

export type EnrollmentStatus = Database["public"]["Enums"]["enrollment_status"];

export interface SectionOption {
  id: string;
  label: string; // e.g. "Class 1 – A"
}

export const PAGE_SIZE = 50;

/** Sections in the active academic year that this staff member may work with. */
export async function listSectionOptions(staff: Staff): Promise<SectionOption[]> {
  const supabase = await createClient();
  let query = supabase
    .from("sections")
    .select("id, name, classes!inner(name, sort_order, academic_years!inner(is_active))")
    .eq("classes.academic_years.is_active", true);

  if (staff.role === "teacher") {
    const { data: assignments } = await supabase
      .from("teacher_assignments")
      .select("section_id")
      .eq("teacher_id", staff.id);
    query = query.in(
      "id",
      (assignments ?? []).map((a) => a.section_id),
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return data
    .sort((a, b) => a.classes.sort_order - b.classes.sort_order || a.name.localeCompare(b.name))
    .map((s) => ({ id: s.id, label: `${s.classes.name} – ${s.name}` }));
}

/**
 * Keeps only characters that can appear in names and admission numbers, so the
 * search text cannot alter the PostgREST filter syntax.
 */
export function sanitizeSearch(q: string): string {
  return q
    .replace(/[^\p{L}\p{M}\p{N}\s\-/]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 50);
}

export interface StudentListParams {
  q?: string;
  sectionId?: string;
  status?: EnrollmentStatus | "all";
  page?: number;
}

export async function listStudents({ q = "", sectionId, status = "active", page = 1 }: StudentListParams) {
  const supabase = await createClient();
  let query = supabase
    .from("students")
    .select("id, admission_no, full_name, roll_no, enrollment_status, sections!inner(name, classes!inner(name))", {
      count: "exact",
    });

  const search = sanitizeSearch(q);
  if (search) query = query.or(`full_name.ilike."*${search}*",admission_no.ilike."*${search}*"`);
  if (sectionId) query = query.eq("section_id", sectionId);
  if (status !== "all") query = query.eq("enrollment_status", status);

  query = sectionId
    ? query.order("roll_no", { ascending: true, nullsFirst: false }).order("full_name")
    : query.order("full_name");

  const from = (Math.max(1, page) - 1) * PAGE_SIZE;
  const { data, count, error } = await query.range(from, from + PAGE_SIZE - 1);
  if (error) throw error;
  return { students: data, total: count ?? 0 };
}

export async function getStudent(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("students")
    .select(
      "id, admission_no, full_name, section_id, roll_no, guardian_name, guardian_phone, preferred_language, guardian_notifications_consent, enrollment_status, updated_at, sections!inner(name, classes!inner(name))",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}
