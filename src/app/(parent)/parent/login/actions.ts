"use server";

import { redirect } from "next/navigation";
import { safeParentNextPath } from "@/lib/auth/paths";
import { createClient } from "@/lib/supabase/server";
import { requestOtpSchema, verifyOtpSchema } from "@/lib/validation/parent-auth";

export interface ParentLoginState {
  step: "phone" | "otp";
  phone?: string;
  error?: string;
}


export async function requestParentOtp(_prev: ParentLoginState, formData: FormData): Promise<ParentLoginState> {
  const parsed = requestOtpSchema.safeParse({ phone: formData.get("phone") });
  if (!parsed.success) {
    return { step: "phone", error: parsed.error.issues[0]?.message ?? "Enter a valid mobile number." };
  }

  const supabase = await createClient();
  // shouldCreateUser: false -- accounts are provisioned by an admin only
  // (src/app/(dashboard)/parents/actions.ts createGuardian), never by a
  // visitor entering a phone number here. See docs/ERP_ARCHITECTURE.md §18
  // Phase 3 / §8.4 for why parents are never self-registered.
  const { error } = await supabase.auth.signInWithOtp({
    phone: parsed.data.phone,
    options: { shouldCreateUser: false },
  });

  if (error) {
    // One message regardless of cause (unregistered number vs. a transient
    // provider error) -- same reasoning as staff login's single error
    // message: do not reveal which phone numbers are registered.
    return {
      step: "phone",
      phone: parsed.data.phone,
      error: "This number isn't registered for parent access yet, or the code could not be sent. Please contact the school office.",
    };
  }

  return { step: "otp", phone: parsed.data.phone };
}

export async function verifyParentOtp(prev: ParentLoginState, formData: FormData): Promise<ParentLoginState> {
  const parsed = verifyOtpSchema.safeParse({
    phone: formData.get("phone"),
    token: formData.get("token"),
  });
  if (!parsed.success) {
    return { step: "otp", phone: prev.phone, error: parsed.error.issues[0]?.message ?? "Enter the 6-digit code." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    phone: parsed.data.phone,
    token: parsed.data.token,
    type: "sms",
  });
  if (error || !data.user) {
    return { step: "otp", phone: parsed.data.phone, error: "That code is incorrect or has expired. Please try again." };
  }

  const { data: guardian } = await supabase.from("guardians").select("is_active").eq("id", data.user.id).maybeSingle();
  if (!guardian?.is_active) {
    await supabase.auth.signOut();
    return { step: "phone", error: "This account is disabled. Please contact the school office." };
  }

  redirect(safeParentNextPath(formData.get("next")));
}

export async function signOutGuardian() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/parent/login");
}
