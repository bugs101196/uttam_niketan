import "server-only";
import type { Staff } from "@/lib/auth/staff";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type StaffRole = Database["public"]["Enums"]["app_role"];

export interface StaffMember {
  id: string;
  fullName: string;
  email: string | null;
  role: StaffRole;
  isActive: boolean;
  assignments: { id: string; sectionLabel: string }[];
}

/** Staff of the admin's school with their current-year section assignments. Admin only. */
export async function listStaff(admin: Staff): Promise<StaffMember[]> {
  const supabase = await createClient();
  const [{ data: profiles, error }, { data: assignments, error: assignmentsError }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, role, is_active")
      .eq("school_id", admin.schoolId)
      .order("full_name"),
    supabase
      .from("teacher_assignments")
      .select("id, teacher_id, sections!inner(name, classes!inner(name, sort_order, academic_years!inner(is_active)))")
      .eq("school_id", admin.schoolId)
      .eq("sections.classes.academic_years.is_active", true),
  ]);
  if (error) throw error;
  if (assignmentsError) throw assignmentsError;

  // Emails live in Supabase Auth, which only the service role can read. Only
  // ids already visible to this admin (their own school) are looked up.
  const emails = new Map<string, string | null>();
  const authAdmin = createAdminClient().auth.admin;
  await Promise.all(
    profiles.map(async (p) => {
      const { data } = await authAdmin.getUserById(p.id);
      emails.set(p.id, data.user?.email ?? null);
    }),
  );

  return profiles.map((p) => ({
    id: p.id,
    fullName: p.full_name,
    email: emails.get(p.id) ?? null,
    role: p.role,
    isActive: p.is_active,
    assignments: assignments
      .filter((a) => a.teacher_id === p.id)
      .sort((a, b) => a.sections.classes.sort_order - b.sections.classes.sort_order)
      .map((a) => ({ id: a.id, sectionLabel: `${a.sections.classes.name} – ${a.sections.name}` })),
  }));
}
