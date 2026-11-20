"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/staff";
import { createClient } from "@/lib/supabase/server";
import { feeAmountSchema, feeHeadSchema } from "@/lib/validation/fees";
import { fieldErrors } from "@/lib/validation/student";

export interface FormState {
  message?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
}

type DbError = { code?: string; message?: string };

function log(action: string, error: DbError) {
  console.error(`fees-settings.${action}`, { code: error.code, message: error.message });
}

function refresh() {
  revalidatePath("/settings/fees");
}

const DUPLICATE: Record<string, string> = {
  fee_heads_school_id_name_key: "A fee head with this name already exists.",
  fee_structures_class_id_fee_head_id_key:
    "An amount is already set for this class and fee head -- edit it instead of adding a new one.",
};

function duplicateMessage(error: DbError): string | null {
  if (error.code !== "23505") return null;
  const key = Object.keys(DUPLICATE).find((k) => error.message?.includes(k));
  return key ? DUPLICATE[key] : "That already exists.";
}

// ---------------------------------------------------------------------------
// Fee heads
// ---------------------------------------------------------------------------

export async function createFeeHead(prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = feeHeadSchema.safeParse({ name: formData.get("name"), name_hi: formData.get("name_hi") });
  if (!parsed.success) return { message: "Please check the details.", fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("fee_heads")
    .insert({ school_id: admin.schoolId, name: parsed.data.name, name_hi: parsed.data.name_hi });
  if (error) {
    const dup = duplicateMessage(error);
    if (!dup) log("createFeeHead", error);
    return { message: dup ?? "Could not add the fee head." };
  }
  refresh();
  return { success: "Fee head added." };
}

export async function renameFeeHead(id: string, prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = feeHeadSchema.safeParse({ name: formData.get("name"), name_hi: formData.get("name_hi") });
  if (!parsed.success) return { message: "Please check the details.", fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("fee_heads")
    .update({ name: parsed.data.name, name_hi: parsed.data.name_hi })
    .eq("id", id);
  if (error) {
    const dup = duplicateMessage(error);
    if (!dup) log("renameFeeHead", error);
    return { message: dup ?? "Could not save changes." };
  }
  refresh();
  return { success: "Saved." };
}

export async function deleteFeeHead(id: string): Promise<FormState> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.from("fee_heads").delete().eq("id", id).select("id");
  if (error) {
    log("deleteFeeHead", error);
    return {
      message: error.code === "23503" ? "This fee head is used in a fee structure and can't be deleted." : "Could not delete the fee head.",
    };
  }
  if (!data?.length) return { message: "The fee head could not be found." };
  refresh();
  return { success: "Fee head deleted." };
}

// ---------------------------------------------------------------------------
// Fee structures (per-class pricing)
// ---------------------------------------------------------------------------

export async function setFeeAmount(classId: string, yearId: string, prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = feeAmountSchema.safeParse({
    fee_head_id: formData.get("fee_head_id"),
    amount: formData.get("amount"),
  });
  if (!parsed.success) return { message: "Please check the details.", fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.from("fee_structures").upsert(
    {
      school_id: admin.schoolId,
      academic_year_id: yearId,
      class_id: classId,
      fee_head_id: parsed.data.fee_head_id,
      amount: parsed.data.amount,
    },
    { onConflict: "class_id,fee_head_id" },
  );
  if (error) {
    log("setFeeAmount", error);
    return { message: "Could not save the amount." };
  }
  refresh();
  return { success: "Saved." };
}

export async function deleteFeeStructureEntry(id: string): Promise<FormState> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.from("fee_structures").delete().eq("id", id).select("id");
  if (error) {
    log("deleteFeeStructureEntry", error);
    return { message: "Could not remove this amount." };
  }
  if (!data?.length) return { message: "That amount could not be found." };
  refresh();
  return { success: "Removed." };
}
