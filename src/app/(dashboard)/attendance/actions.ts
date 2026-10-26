"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import {
  attendanceRecordsSchema,
  correctionSchema,
  describeAttendanceError,
  startSessionSchema,
} from "@/lib/attendance";
import { requireAdmin, requireStaff } from "@/lib/auth/staff";
import { createClient } from "@/lib/supabase/server";
import { processNotificationQueue } from "@/lib/whatsapp/worker";

/** Sends any absence alerts the database just queued, after the response is sent. */
function sendQueuedAlerts() {
  after(async () => {
    try {
      await processNotificationQueue();
    } catch (error) {
      // The daily cron run retries anything left queued.
      console.error("attendance: notification run failed", (error as Error).message);
    }
  });
}

// Every action re-checks the user, validates input with Zod, then calls a
// database function that checks permissions again, derives the acting user
// from the session and writes atomically.

export interface AttendanceActionResult {
  ok: boolean;
  message?: string;
}

function logError(action: string, error: { code?: string; message?: string }) {
  console.error(`attendance.${action}`, { code: error.code, message: error.message });
}

/** Opens (or reopens) the session for a section and date, then goes to it. */
export async function startAttendance(formData: FormData) {
  await requireStaff();
  const parsed = startSessionSchema.safeParse({ section_id: formData.get("section_id"), date: formData.get("date") });
  if (!parsed.success) redirect("/attendance?error=invalid");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("open_attendance_session", {
    p_section_id: parsed.data.section_id,
    p_date: parsed.data.date,
  });
  if (error || !data) {
    if (error) logError("start", error);
    // Pass a fixed key, never message text, so links cannot inject wording into the page.
    const text = error?.message ?? "";
    const key = /future date/i.test(text)
      ? "future"
      : /outside the academic year/i.test(text)
        ? "outside-year"
        : error?.code === "42501"
          ? "forbidden"
          : "failed";
    redirect(`/attendance?date=${parsed.data.date}&error=${key}`);
  }
  redirect(`/attendance/${data.id}`);
}

export async function saveAttendanceDraft(sessionId: string, records: unknown): Promise<AttendanceActionResult> {
  await requireStaff();
  const parsed = attendanceRecordsSchema.safeParse(records);
  if (!parsed.success) return { ok: false, message: "Some marks are not valid. Reload the page and try again." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_attendance_draft", { p_session_id: sessionId, p_records: parsed.data });
  if (error) {
    logError("saveDraft", error);
    return { ok: false, message: describeAttendanceError(error) };
  }
  return { ok: true };
}

export async function submitAttendance(sessionId: string, records: unknown): Promise<AttendanceActionResult> {
  await requireStaff();
  const parsed = attendanceRecordsSchema.safeParse(records);
  if (!parsed.success) return { ok: false, message: "Some marks are not valid. Reload the page and try again." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_attendance_session", {
    p_session_id: sessionId,
    p_records: parsed.data,
  });
  if (error) {
    logError("submit", error);
    return { ok: false, message: describeAttendanceError(error) };
  }
  revalidatePath("/attendance");
  revalidatePath(`/attendance/${sessionId}`);
  sendQueuedAlerts();
  return { ok: true };
}

export interface CorrectionState {
  message?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
}

export async function correctAttendance(
  sessionId: string,
  _prev: CorrectionState,
  formData: FormData,
): Promise<CorrectionState> {
  await requireAdmin();
  const parsed = correctionSchema.safeParse({
    student_id: formData.get("student_id"),
    status: formData.get("status"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    const reason = parsed.error.issues.find((i) => i.path[0] === "reason");
    return { message: "Please check the correction.", fieldErrors: reason ? { reason: reason.message } : undefined };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("correct_attendance_record", {
    p_session_id: sessionId,
    p_student_id: parsed.data.student_id,
    p_status: parsed.data.status,
    p_reason: parsed.data.reason,
  });
  if (error) {
    logError("correct", error);
    return { message: describeAttendanceError(error) };
  }
  revalidatePath(`/attendance/${sessionId}`);
  sendQueuedAlerts();
  return { success: "Correction saved and recorded in the history." };
}

export async function lockAttendance(sessionId: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("lock_attendance_session", { p_session_id: sessionId });
  if (error) logError("lock", error);
  revalidatePath(`/attendance/${sessionId}`);
  revalidatePath("/attendance");
}
