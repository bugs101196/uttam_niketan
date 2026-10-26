"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/staff";
import { describeDbError } from "@/lib/db-errors";
import { createClient } from "@/lib/supabase/server";
import { fieldErrors, parseStudentForm, type StudentInput } from "@/lib/validation/student";

export interface StudentFormState {
  message?: string;
  fieldErrors?: Record<string, string>;
  // Echo the submitted values so the form keeps what the user typed on error.
  values?: Record<string, string>;
  attempt?: number;
}

function submitted(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$")) values[key] = value;
  }
  return values;
}

/**
 * The class and school always come from the chosen section on the server,
 * never from the form, and the section must be in the active academic year.
 */
async function resolveSection(sectionId: string, schoolId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sections")
    .select("id, class_id, school_id, classes!inner(academic_years!inner(is_active))")
    .eq("id", sectionId)
    .eq("school_id", schoolId)
    .eq("classes.academic_years.is_active", true)
    .maybeSingle();
  return data;
}

async function prepare(
  formData: FormData,
  prev: StudentFormState,
): Promise<{ error: StudentFormState } | { input: StudentInput; classId: string; schoolId: string }> {
  const staff = await requireAdmin();
  const values = submitted(formData);
  const attempt = (prev.attempt ?? 0) + 1;

  const parsed = parseStudentForm(formData);
  if (!parsed.success) {
    return {
      error: {
        message: "Please correct the highlighted fields.",
        fieldErrors: fieldErrors(parsed.error),
        values,
        attempt,
      },
    };
  }

  const section = await resolveSection(parsed.data.section_id, staff.schoolId);
  if (!section) {
    return {
      error: {
        message: "Choose a valid class and section.",
        fieldErrors: { section_id: "Choose a class and section" },
        values,
        attempt,
      },
    };
  }

  return { input: parsed.data, classId: section.class_id, schoolId: staff.schoolId };
}

export async function createStudent(prev: StudentFormState, formData: FormData): Promise<StudentFormState> {
  const prepared = await prepare(formData, prev);
  if ("error" in prepared) return prepared.error;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("students")
    .insert({ ...prepared.input, school_id: prepared.schoolId, class_id: prepared.classId })
    .select("id")
    .single();

  if (error) {
    console.error("createStudent failed", { code: error.code, message: error.message });
    return { ...describeDbError(error), values: submitted(formData), attempt: (prev.attempt ?? 0) + 1 };
  }

  revalidatePath("/students");
  redirect(`/students/${data.id}?saved=created`);
}

export async function updateStudent(
  studentId: string,
  prev: StudentFormState,
  formData: FormData,
): Promise<StudentFormState> {
  const prepared = await prepare(formData, prev);
  if ("error" in prepared) return prepared.error;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("students")
    .update({ ...prepared.input, class_id: prepared.classId })
    .eq("id", studentId)
    .eq("school_id", prepared.schoolId)
    .select("id");

  if (error || !data?.length) {
    if (error) console.error("updateStudent failed", { code: error.code, message: error.message });
    const described = error ? describeDbError(error) : { message: "That student could not be found." };
    return { ...described, values: submitted(formData), attempt: (prev.attempt ?? 0) + 1 };
  }

  revalidatePath("/students");
  revalidatePath(`/students/${studentId}`);
  redirect(`/students/${studentId}?saved=updated`);
}
