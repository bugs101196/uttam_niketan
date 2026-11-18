"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireStaff } from "@/lib/auth/staff";
import { describeDbError } from "@/lib/db-errors";
import { homeworkSchema } from "@/lib/validation/homework";
import { createHomework, deleteHomework, updateHomework } from "@/services/homework";

export interface HomeworkActionState {
  message?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
  attempt?: number;
}

const next = (prev: HomeworkActionState) => (prev.attempt ?? 0) + 1;

function fieldErrors(error: ReturnType<typeof homeworkSchema.safeParse>["error"]) {
  const out: Record<string, string> = {};
  for (const issue of error?.issues ?? []) {
    const key = String(issue.path[0] ?? "");
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

export async function createHomeworkAction(prev: HomeworkActionState, formData: FormData): Promise<HomeworkActionState> {
  const staff = await requireStaff();
  const parsed = homeworkSchema.safeParse({
    section_id: formData.get("section_id"),
    subject: formData.get("subject"),
    description_en: formData.get("description_en"),
    description_hi: formData.get("description_hi"),
    due_date: formData.get("due_date"),
  });
  if (!parsed.success) {
    return { message: "Please correct the highlighted fields.", fieldErrors: fieldErrors(parsed.error), attempt: next(prev) };
  }

  try {
    await createHomework(staff, parsed.data);
  } catch (error) {
    const described = describeDbError(error as { code?: string; message?: string });
    return { ...described, attempt: next(prev) };
  }

  revalidatePath("/homework");
  return { success: "Homework posted.", attempt: next(prev) };
}

export async function updateHomeworkAction(
  id: string,
  prev: HomeworkActionState,
  formData: FormData,
): Promise<HomeworkActionState> {
  await requireStaff();
  const parsed = homeworkSchema.safeParse({
    section_id: formData.get("section_id"),
    subject: formData.get("subject"),
    description_en: formData.get("description_en"),
    description_hi: formData.get("description_hi"),
    due_date: formData.get("due_date"),
  });
  if (!parsed.success) {
    return { message: "Please correct the highlighted fields.", fieldErrors: fieldErrors(parsed.error), attempt: next(prev) };
  }

  try {
    await updateHomework(id, parsed.data);
  } catch (error) {
    const described = describeDbError(error as { code?: string; message?: string });
    return { ...described, attempt: next(prev) };
  }

  revalidatePath("/homework");
  redirect("/homework");
}

export async function deleteHomeworkAction(id: string) {
  await requireAdmin();
  await deleteHomework(id);
  revalidatePath("/homework");
}
