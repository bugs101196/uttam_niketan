import "server-only";
import type { Staff } from "@/lib/auth/staff";
import { createClient } from "@/lib/supabase/server";

// All queries use the signed-in admin's RLS client — guardians_select/
// guardian_students_select already scope these to the admin's own school.

export interface GuardianListItem {
  id: string;
  fullName: string;
  phone: string;
  preferredLanguage: "en" | "hi";
  isActive: boolean;
  children: { studentId: string; studentName: string; relationship: string | null }[];
}

export async function listGuardians(admin: Staff): Promise<GuardianListItem[]> {
  const supabase = await createClient();
  const [{ data: guardians, error }, { data: links, error: linksError }] = await Promise.all([
    supabase
      .from("guardians")
      .select("id, full_name, phone, preferred_language, is_active")
      .eq("school_id", admin.schoolId)
      .order("full_name"),
    supabase.from("guardian_students").select("guardian_id, relationship, students!inner(id, full_name)"),
  ]);
  if (error) throw error;
  if (linksError) throw linksError;

  const childrenByGuardian = new Map<string, GuardianListItem["children"]>();
  for (const link of links ?? []) {
    const list = childrenByGuardian.get(link.guardian_id) ?? [];
    list.push({ studentId: link.students.id, studentName: link.students.full_name, relationship: link.relationship });
    childrenByGuardian.set(link.guardian_id, list);
  }

  return (guardians ?? []).map((g) => ({
    id: g.id,
    fullName: g.full_name,
    phone: g.phone,
    preferredLanguage: g.preferred_language,
    isActive: g.is_active,
    children: childrenByGuardian.get(g.id) ?? [],
  }));
}

/** A single active student by exact admission number, for the "link a child" form. */
export async function findStudentByAdmissionNo(admissionNo: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("students")
    .select("id, full_name, admission_no")
    .ilike("admission_no", admissionNo.trim())
    .maybeSingle();
  if (error) throw error;
  return data;
}
