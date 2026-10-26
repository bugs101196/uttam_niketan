"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNextPath } from "@/lib/auth/paths";
import { createClient } from "@/lib/supabase/server";

export interface LoginState {
  error?: string;
  email?: string;
}

const credentials = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const parsed = credentials.safeParse({ email, password: formData.get("password") });
  if (!parsed.success) return { error: "Enter your email address and password.", email };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  // One message for unknown email, wrong password and disabled (banned) accounts.
  // Supabase reports a ban even when the password is wrong, so naming it here
  // would reveal which emails belong to disabled accounts.
  if (error || !data.user) {
    return {
      error: "Email or password is incorrect. If your account has been disabled, please contact the school office.",
      email,
    };
  }

  const { data: profile } = await supabase.from("profiles").select("is_active").eq("id", data.user.id).maybeSingle();

  if (!profile?.is_active) {
    await supabase.auth.signOut();
    return { error: "This account is disabled. Please contact the school administrator.", email };
  }

  redirect(safeNextPath(formData.get("next")));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
