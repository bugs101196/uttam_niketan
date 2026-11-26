import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendAbsenceTemplate, sendFeeReminderTemplate } from "./client";
import { whatsappConfig, type WhatsAppConfig } from "./config";

export interface ClaimedJob {
  id: string;
  recipient_phone: string;
  template_language: "en" | "hi";
  student_name: string;
  class_label: string;
  attendance_date: string;
  attempts: number;
}

/** The two database calls the worker needs; injectable for tests. */
export interface QueueStore {
  claim(limit: number): Promise<ClaimedJob[]>;
  complete(
    jobId: string,
    outcome: "sent" | "retry" | "failed" | "skipped",
    messageId?: string,
    error?: string,
  ): Promise<void>;
}

export interface QueueRunResult {
  status: "disabled" | "ran";
  sent: number;
  retried: number;
  failed: number;
  skipped: number;
}

function serviceRoleStore(): QueueStore {
  // Service role is required: these functions are not granted to signed-in users.
  const db = createAdminClient();
  return {
    async claim(limit) {
      const { data, error } = await db.rpc("claim_notification_jobs", { p_limit: limit });
      if (error) throw new Error(`claim_notification_jobs failed: ${error.code}`);
      return (data ?? []) as ClaimedJob[];
    },
    async complete(jobId, outcome, messageId, err) {
      const { error } = await db.rpc("complete_notification_job", {
        p_job_id: jobId,
        p_outcome: outcome,
        p_provider_message_id: messageId,
        p_error: err,
      });
      if (error) throw new Error(`complete_notification_job failed: ${error.code}`);
    },
  };
}

export interface ClaimedFeeReminderJob {
  id: string;
  recipient_phone: string;
  template_language: "en" | "hi";
  student_name: string;
  class_label: string;
  invoice_label: string;
  balance: number;
  due_date: string;
  attempts: number;
}

/** Same shape as QueueStore, for the fee-reminder queue. */
export interface FeeReminderQueueStore {
  claim(limit: number): Promise<ClaimedFeeReminderJob[]>;
  complete(
    jobId: string,
    outcome: "sent" | "retry" | "failed" | "skipped",
    messageId?: string,
    error?: string,
  ): Promise<void>;
}

function feeReminderServiceRoleStore(): FeeReminderQueueStore {
  const db = createAdminClient();
  return {
    async claim(limit) {
      const { data, error } = await db.rpc("claim_fee_reminder_jobs", { p_limit: limit });
      if (error) throw new Error(`claim_fee_reminder_jobs failed: ${error.code}`);
      return (data ?? []) as ClaimedFeeReminderJob[];
    },
    async complete(jobId, outcome, messageId, err) {
      const { error } = await db.rpc("complete_fee_reminder_job", {
        p_job_id: jobId,
        p_outcome: outcome,
        p_provider_message_id: messageId,
        p_error: err,
      });
      if (error) throw new Error(`complete_fee_reminder_job failed: ${error.code}`);
    },
  };
}

/**
 * Finds newly-overdue invoices and queues reminders for them. Safe to call
 * every run -- dedupe_key means an invoice already queued or settled is
 * left alone.
 */
async function scanOverdueInvoices(): Promise<number> {
  const db = createAdminClient();
  const { data, error } = await db.rpc("scan_overdue_invoices_for_reminders");
  if (error) throw new Error(`scan_overdue_invoices_for_reminders failed: ${error.code}`);
  return data ?? 0;
}

/**
 * Sends due fee reminders for overdue invoices. Bounded per run; safe to
 * call concurrently. Does nothing unless WHATSAPP_MODE is test or live and
 * the Cloud API settings are present -- same gating as absence alerts. A
 * reminder keeps recurring monthly for the same invoice until it is paid or
 * waived; see complete_fee_reminder_job in the 20261126000100 migration.
 */
export async function processFeeReminderQueue(
  options: {
    limit?: number;
    config?: WhatsAppConfig;
    store?: FeeReminderQueueStore;
    scan?: () => Promise<number>;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<QueueRunResult> {
  const config = options.config ?? whatsappConfig();
  const result: QueueRunResult = { status: "ran", sent: 0, retried: 0, failed: 0, skipped: 0 };
  if (config.mode === "off" || !config.configured) return { ...result, status: "disabled" };

  await (options.scan ?? scanOverdueInvoices)();

  const store = options.store ?? feeReminderServiceRoleStore();
  const jobs = await store.claim(options.limit ?? 20);

  for (const job of jobs) {
    if (config.mode === "test" && !config.testRecipients.has(job.recipient_phone)) {
      await store.complete(job.id, "skipped", undefined, "Test mode: not a test recipient");
      result.skipped += 1;
      continue;
    }

    const sent = await sendFeeReminderTemplate(
      config,
      {
        to: job.recipient_phone,
        language: job.template_language,
        studentName: job.student_name,
        classLabel: job.class_label,
        balance: job.balance,
        dueDate: job.due_date,
      },
      options.fetchImpl,
    );

    if (sent.ok) {
      await store.complete(job.id, "sent", sent.messageId);
      result.sent += 1;
    } else if (sent.permanent) {
      await store.complete(job.id, "failed", undefined, sent.error);
      result.failed += 1;
    } else {
      await store.complete(job.id, "retry", undefined, sent.error);
      result.retried += 1;
    }
  }
  return result;
}

/**
 * Sends due absence alerts. Bounded per run; safe to call concurrently (the
 * database hands each job to one worker). Does nothing unless WHATSAPP_MODE is
 * test or live and the Cloud API settings are present.
 */
export async function processNotificationQueue(
  options: { limit?: number; config?: WhatsAppConfig; store?: QueueStore; fetchImpl?: typeof fetch } = {},
): Promise<QueueRunResult> {
  const config = options.config ?? whatsappConfig();
  const result: QueueRunResult = { status: "ran", sent: 0, retried: 0, failed: 0, skipped: 0 };
  if (config.mode === "off" || !config.configured) return { ...result, status: "disabled" };

  const store = options.store ?? serviceRoleStore();
  const jobs = await store.claim(options.limit ?? 20);

  for (const job of jobs) {
    if (config.mode === "test" && !config.testRecipients.has(job.recipient_phone)) {
      await store.complete(job.id, "skipped", undefined, "Test mode: not a test recipient");
      result.skipped += 1;
      continue;
    }

    const sent = await sendAbsenceTemplate(
      config,
      {
        to: job.recipient_phone,
        language: job.template_language,
        studentName: job.student_name,
        classLabel: job.class_label,
        date: job.attendance_date,
      },
      options.fetchImpl,
    );

    if (sent.ok) {
      await store.complete(job.id, "sent", sent.messageId);
      result.sent += 1;
    } else if (sent.permanent) {
      await store.complete(job.id, "failed", undefined, sent.error);
      result.failed += 1;
    } else {
      // The database turns a retry into "failed" once attempts run out.
      await store.complete(job.id, "retry", undefined, sent.error);
      result.retried += 1;
    }
  }
  return result;
}
