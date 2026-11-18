"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/staff";
import { describeDbError } from "@/lib/db-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { linkStudentSchema, newGuardianSchema } from "@/lib/validation/guardian";
import { fieldErrors } from "@/lib/validation/student";
import { findStudentByAdmissionNo } from "@/services/guardians";

export interface GuardianActionState {
  message?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
  attempt?: number;
}

const next = (prev: GuardianActionState) => (prev.attempt ?? 0) + 1;

/**
 * Creates the guardian's sign-in identity (phone, no password — they sign in
 * with OTP once that's built) and their guardians row, in the admin's school.
 * No child is linked here; that is always a separate, explicit step.
 */
export async function createGuardian(prev: GuardianActionState, formData: FormData): Promise<GuardianActionState> {
  const admin = await requireAdmin();
  const parsed = newGuardianSchema.safeParse({
    full_name: formData.get("full_name"),
    phone: formData.get("phone"),
    preferred_language: formData.get("preferred_language") || "hi",
  });
  if (!parsed.success) {
    return { message: "Please correct the highlighted fields.", fieldErrors: fieldErrors(parsed.error), attempt: next(prev) };
  }

  // Creating the auth identity needs the service role; the school always comes from the signed-in admin.
  const service = createAdminClient();
  const { data: created, error: createError } = await service.auth.admin.createUser({
    phone: parsed.data.phone,
    phone_confirm: true,
  });
  if (createError || !created.user) {
    const exists = createError?.code === "phone_exists" || /already/i.test(createError?.message ?? "");
    if (!exists) console.error("createGuardian: auth user", createError?.message);
    return exists
      ? { message: "A parent account with this phone number already exists.", fieldErrors: { phone: "Already in use" }, attempt: next(prev) }
      : { message: "The account could not be created. Please try again.", attempt: next(prev) };
  }

  const { error: guardianError } = await service.from("guardians").insert({
    id: created.user.id,
    school_id: admin.schoolId,
    full_name: parsed.data.full_name,
    phone: parsed.data.phone,
    preferred_language: parsed.data.preferred_language,
  });
  if (guardianError) {
    console.error("createGuardian: guardians", guardianError.code, guardianError.message);
    await service.auth.admin.deleteUser(created.user.id);
    return { message: "The account could not be created. Please try again.", attempt: next(prev) };
  }

  revalidatePath("/parents");
  return { success: `${parsed.data.full_name} can now sign in with ${parsed.data.phone} once parent login is live.`, attempt: next(prev) };
}

export async function linkStudent(prev: GuardianActionState, formData: FormData): Promise<GuardianActionState> {
  await requireAdmin();
  const admissionNo = String(formData.get("admission_no") ?? "").trim();
  if (!admissionNo) {
    return { message: "Enter the student's admission number.", fieldErrors: { admission_no: "Required" }, attempt: next(prev) };
  }
  const student = await findStudentByAdmissionNo(admissionNo);
  if (!student) {
    return { message: "No student found with that admission number.", fieldErrors: { admission_no: "Not found" }, attempt: next(prev) };
  }

  const parsed = linkStudentSchema.safeParse({
    guardian_id: formData.get("guardian_id"),
    student_id: student.id,
    relationship: formData.get("relationship") ?? "",
  });
  if (!parsed.success) {
    return { message: "Choose a parent/guardian.", fieldErrors: fieldErrors(parsed.error), attempt: next(prev) };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("guardian_students").insert({
    guardian_id: parsed.data.guardian_id,
    student_id: parsed.data.student_id,
    relationship: parsed.data.relationship,
  });
  if (error) {
    if (error.code !== "23505") console.error("linkStudent", error.code, error.message);
    return { ...describeDbError(error), attempt: next(prev) };
  }

  revalidatePath("/parents");
  return { success: `Linked to ${student.full_name}.`, attempt: next(prev) };
}

export async function unlinkStudent(guardianId: string, studentId: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("guardian_students")
    .delete()
    .eq("guardian_id", guardianId)
    .eq("student_id", studentId);
  if (error) console.error("unlinkStudent", error.code, error.message);
  revalidatePath("/parents");
}

export async function setGuardianActive(guardianId: string, active: boolean) {
  const admin = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("guardians")
    .update({ is_active: active })
    .eq("id", guardianId)
    .eq("school_id", admin.schoolId);
  if (error) {
    console.error("setGuardianActive", error.code, error.message);
    return;
  }

  // Also block sign-in at the Auth level, same as a disabled staff account.
  await createAdminClient().auth.admin.updateUserById(guardianId, { ban_duration: active ? "none" : "876000h" });
  revalidatePath("/parents");
}
