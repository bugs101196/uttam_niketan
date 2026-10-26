"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/staff";
import { describeDbError } from "@/lib/db-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { fieldErrors } from "@/lib/validation/student";
import { assignmentSchema, newStaffSchema, temporaryPassword } from "@/lib/validation/staff";

export interface StaffActionState {
  message?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
  // Shown once after creating an account or resetting a password.
  credentials?: { email: string; password: string };
  attempt?: number;
}

const next = (prev: StaffActionState) => (prev.attempt ?? 0) + 1;

/** A profile in the admin's own school, read through RLS. */
async function profileInSchool(profileId: string, schoolId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, is_active")
    .eq("id", profileId)
    .eq("school_id", schoolId)
    .maybeSingle();
  return data;
}

export async function createStaffAccount(prev: StaffActionState, formData: FormData): Promise<StaffActionState> {
  const admin = await requireAdmin();
  const parsed = newStaffSchema.safeParse({
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return {
      message: "Please correct the highlighted fields.",
      fieldErrors: fieldErrors(parsed.error),
      attempt: next(prev),
    };
  }

  // Creating auth users needs the service role; the school always comes from the signed-in admin.
  const service = createAdminClient();
  const password = temporaryPassword();
  const { data: created, error: createError } = await service.auth.admin.createUser({
    email: parsed.data.email,
    password,
    email_confirm: true,
  });
  if (createError || !created.user) {
    const exists = createError?.code === "email_exists" || /already/i.test(createError?.message ?? "");
    if (!exists) console.error("createStaffAccount: auth user", createError?.message);
    return exists
      ? {
          message: "An account with this email already exists.",
          fieldErrors: { email: "Already in use" },
          attempt: next(prev),
        }
      : { message: "The account could not be created. Please try again.", attempt: next(prev) };
  }

  const { error: profileError } = await service.from("profiles").insert({
    id: created.user.id,
    school_id: admin.schoolId,
    full_name: parsed.data.full_name,
    role: parsed.data.role,
  });
  if (profileError) {
    console.error("createStaffAccount: profile", profileError.code, profileError.message);
    await service.auth.admin.deleteUser(created.user.id);
    return { message: "The account could not be created. Please try again.", attempt: next(prev) };
  }

  revalidatePath("/staff");
  return {
    success: `${parsed.data.full_name} can now sign in.`,
    credentials: { email: parsed.data.email, password },
    attempt: next(prev),
  };
}

export async function setStaffActive(profileId: string, active: boolean) {
  const admin = await requireAdmin();
  if (profileId === admin.id) return; // also blocked by a database trigger
  if (!(await profileInSchool(profileId, admin.schoolId))) return;

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ is_active: active }).eq("id", profileId);
  if (error) {
    console.error("setStaffActive", error.code, error.message);
    return;
  }

  // Also block sign-in and token refresh at the Auth level. The app and RLS
  // already deny a disabled profile on every request.
  await createAdminClient().auth.admin.updateUserById(profileId, { ban_duration: active ? "none" : "876000h" });
  revalidatePath("/staff");
}

export async function resetStaffPassword(profileId: string, prev: StaffActionState): Promise<StaffActionState> {
  const admin = await requireAdmin();
  const profile = await profileInSchool(profileId, admin.schoolId);
  if (!profile || profileId === admin.id) {
    return { message: "Password could not be reset.", attempt: next(prev) };
  }

  const service = createAdminClient();
  const password = temporaryPassword();
  const { data, error } = await service.auth.admin.updateUserById(profileId, { password });
  if (error || !data.user?.email) {
    console.error("resetStaffPassword", error?.message);
    return { message: "Password could not be reset.", attempt: next(prev) };
  }
  return {
    success: `New temporary password for ${profile.full_name}.`,
    credentials: { email: data.user.email, password },
    attempt: next(prev),
  };
}

export async function assignSection(prev: StaffActionState, formData: FormData): Promise<StaffActionState> {
  const admin = await requireAdmin();
  const parsed = assignmentSchema.safeParse({
    teacher_id: formData.get("teacher_id"),
    section_id: formData.get("section_id"),
  });
  if (!parsed.success) {
    return { message: "Choose a teacher and a section.", fieldErrors: fieldErrors(parsed.error), attempt: next(prev) };
  }

  const supabase = await createClient();
  const { data: section } = await supabase
    .from("sections")
    .select("id, academic_year_id, classes!inner(academic_years!inner(is_active))")
    .eq("id", parsed.data.section_id)
    .eq("school_id", admin.schoolId)
    .eq("classes.academic_years.is_active", true)
    .maybeSingle();
  if (!section) {
    return { message: "Choose a section in the current academic year.", attempt: next(prev) };
  }

  const { error } = await supabase.from("teacher_assignments").insert({
    school_id: admin.schoolId,
    teacher_id: parsed.data.teacher_id,
    section_id: section.id,
    academic_year_id: section.academic_year_id,
  });
  if (error) {
    if (error.code !== "23505") console.error("assignSection", error.code, error.message);
    // The database rejects non-teachers and teachers from other schools.
    return { ...describeDbError(error), attempt: next(prev) };
  }

  revalidatePath("/staff");
  return { success: "Section assigned.", attempt: next(prev) };
}

export async function removeAssignment(assignmentId: string) {
  const admin = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("teacher_assignments")
    .delete()
    .eq("id", assignmentId)
    .eq("school_id", admin.schoolId);
  if (error) console.error("removeAssignment", error.code, error.message);
  revalidatePath("/staff");
}
