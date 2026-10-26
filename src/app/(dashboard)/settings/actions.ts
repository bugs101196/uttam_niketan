"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/staff";
import { createClient } from "@/lib/supabase/server";
import { processNotificationQueue } from "@/lib/whatsapp/worker";

export async function setMessagingEnabled(enabled: boolean) {
  const admin = await requireAdmin();
  const supabase = await createClient();
  // RLS lets admins update only their own school.
  const { error } = await supabase.from("schools").update({ whatsapp_enabled: enabled }).eq("id", admin.schoolId);
  if (error) console.error("settings: messaging toggle failed", error.code);
  revalidatePath("/settings");
}

export interface QueueRunState {
  message?: string;
  tone?: "success" | "error" | "info";
}

export async function runNotificationQueue(): Promise<QueueRunState> {
  await requireAdmin();
  try {
    const r = await processNotificationQueue({ limit: 50 });
    revalidatePath("/settings");
    if (r.status === "disabled") {
      return { tone: "info", message: "Sending is switched off on the server (WHATSAPP_MODE), so nothing was sent." };
    }
    return {
      tone: "success",
      message: `Sent ${r.sent}, will retry ${r.retried}, failed ${r.failed}, skipped ${r.skipped}.`,
    };
  } catch (error) {
    console.error("settings: queue run failed", (error as Error).message);
    return { tone: "error", message: "The queue could not be processed. Please try again." };
  }
}
