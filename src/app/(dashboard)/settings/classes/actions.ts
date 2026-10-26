"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/staff";
import { createClient } from "@/lib/supabase/server";
import { fieldErrors } from "@/lib/validation/student";
import { academicYearSchema, classSchema, sectionSchema } from "@/lib/validation/classes";

export interface FormState {
  message?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
}

type DbError = { code?: string; message?: string };

function log(action: string, error: DbError) {
  console.error(`classes.${action}`, { code: error.code, message: error.message });
}

function refresh() {
  // Class and section names appear across the staff app.
  revalidatePath("/", "layout");
}

const DUPLICATE: Record<string, string> = {
  academic_years_school_id_name_key: "A year with this name already exists.",
  classes_unique_name_per_year: "A class with this name already exists in this year.",
  sections_unique_name_per_class: "This class already has a section with that name.",
};

function duplicateMessage(error: DbError): string | null {
  if (error.code !== "23505") return null;
  const key = Object.keys(DUPLICATE).find((k) => error.message?.includes(k));
  return key ? DUPLICATE[key] : "That name is already in use.";
}

// ---------------------------------------------------------------------------
// Academic years
// ---------------------------------------------------------------------------

export async function createAcademicYear(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = academicYearSchema.safeParse({
    name: formData.get("name"),
    start_date: formData.get("start_date"),
    end_date: formData.get("end_date"),
    copy_structure: formData.get("copy_structure") === "on",
  });
  if (!parsed.success) return { message: "Please check the year details.", fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { data: year, error } = await supabase
    .from("academic_years")
    .insert({
      school_id: admin.schoolId,
      name: parsed.data.name,
      start_date: parsed.data.start_date,
      end_date: parsed.data.end_date,
    })
    .select("id")
    .single();
  if (error || !year) {
    if (error) log("createYear", error);
    const dup = error ? duplicateMessage(error) : null;
    return dup ? { message: dup, fieldErrors: { name: dup } } : { message: "The year could not be created." };
  }

  let copied = 0;
  if (parsed.data.copy_structure) {
    const { data: active } = await supabase.from("academic_years").select("id").eq("is_active", true).maybeSingle();
    if (active) {
      const { data, error: copyError } = await supabase.rpc("copy_class_structure", {
        p_from_year: active.id,
        p_to_year: year.id,
      });
      if (copyError) {
        log("copyStructure", copyError);
        refresh();
        return { message: "The year was created, but the classes could not be copied. Add them below." };
      }
      copied = data ?? 0;
    }
  }

  refresh();
  return {
    success: `Year ${parsed.data.name} created${copied ? ` with ${copied} sections copied from the current year` : ""}. It is not active yet.`,
  };
}

export async function activateAcademicYear(yearId: string): Promise<FormState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_active_academic_year", { p_year_id: yearId });
  if (error) {
    log("activateYear", error);
    return { message: "The year could not be made active." };
  }
  refresh();
  return { success: "Active year changed." };
}

// ---------------------------------------------------------------------------
// Classes
// ---------------------------------------------------------------------------

export async function createClass(yearId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = classSchema.safeParse({ name: formData.get("name"), sort_order: formData.get("sort_order") || 0 });
  if (!parsed.success) return { message: "Please check the class.", fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.from("classes").insert({
    school_id: admin.schoolId,
    academic_year_id: yearId,
    name: parsed.data.name,
    sort_order: parsed.data.sort_order,
  });
  if (error) {
    log("createClass", error);
    const dup = duplicateMessage(error);
    return dup ? { message: dup, fieldErrors: { name: dup } } : { message: "The class could not be added." };
  }
  refresh();
  return { success: `${parsed.data.name} added. Now add its sections.` };
}

export async function updateClass(classId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = classSchema.safeParse({ name: formData.get("name"), sort_order: formData.get("sort_order") });
  if (!parsed.success) return { message: "Please check the class.", fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("classes")
    .update({ name: parsed.data.name, sort_order: parsed.data.sort_order })
    .eq("id", classId)
    .select("id");
  if (error || !data?.length) {
    if (error) log("updateClass", error);
    const dup = error ? duplicateMessage(error) : null;
    return dup ? { message: dup, fieldErrors: { name: dup } } : { message: "The class could not be saved." };
  }
  refresh();
  return { success: "Saved." };
}

export async function deleteClass(classId: string): Promise<FormState> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.from("classes").delete().eq("id", classId).select("id");
  if (error) {
    log("deleteClass", error);
    return {
      message:
        error.code === "23503"
          ? "This class still has sections or students. Delete its empty sections first."
          : "The class could not be deleted.",
    };
  }
  if (!data?.length) return { message: "The class could not be found." };
  refresh();
  return { success: "Class deleted." };
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

export async function createSection(classId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = sectionSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { message: "Please check the section.", fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  // School and year come from the class (RLS returns it only for this admin's school).
  const { data: cls } = await supabase
    .from("classes")
    .select("id, school_id, academic_year_id")
    .eq("id", classId)
    .maybeSingle();
  if (!cls) return { message: "The class could not be found." };

  const { error } = await supabase.from("sections").insert({
    class_id: cls.id,
    school_id: cls.school_id,
    academic_year_id: cls.academic_year_id,
    name: parsed.data.name,
  });
  if (error) {
    log("createSection", error);
    const dup = duplicateMessage(error);
    return dup ? { message: dup, fieldErrors: { name: dup } } : { message: "The section could not be added." };
  }
  refresh();
  return { success: `Section ${parsed.data.name} added.` };
}

export async function renameSection(sectionId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = sectionSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { message: "Please check the section.", fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sections")
    .update({ name: parsed.data.name })
    .eq("id", sectionId)
    .select("id");
  if (error || !data?.length) {
    if (error) log("renameSection", error);
    const dup = error ? duplicateMessage(error) : null;
    return dup ? { message: dup, fieldErrors: { name: dup } } : { message: "The section could not be saved." };
  }
  refresh();
  return { success: "Saved." };
}

export async function deleteSection(sectionId: string): Promise<FormState> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.from("sections").delete().eq("id", sectionId).select("id");
  if (error) {
    log("deleteSection", error);
    return {
      message:
        error.code === "23503"
          ? "This section still has students, teacher assignments or attendance records, so it cannot be deleted."
          : "The section could not be deleted.",
    };
  }
  if (!data?.length) return { message: "The section could not be found." };
  refresh();
  return { success: "Section deleted." };
}
