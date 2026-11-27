import { afterAll, describe, expect, it } from "vitest";
import { closePool, createSchool, createUser, withTx, type SchoolFixture, type Tx } from "./helpers";

afterAll(closePool);

// Students in 1A: [0] consented with a phone (eligible), [1] phone but no
// consent, [2] consented but no phone -- same eligibility shape as the
// absence queue's tests/db/notifications.test.ts.
async function setupMessaging(tx: Tx, f: SchoolFixture, enabled = true) {
  await tx.query("system", "update public.schools set whatsapp_enabled = $1 where id = $2", [enabled, f.schoolId]);
  await tx.query(
    "system",
    "update public.students set guardian_phone = '+919999900001', guardian_notifications_consent = true where id = $1",
    [f.students1A[0]],
  );
  await tx.query(
    "system",
    "update public.students set guardian_phone = '+919999900002', guardian_notifications_consent = false where id = $1",
    [f.students1A[1]],
  );
  await tx.query(
    "system",
    "update public.students set guardian_phone = null, guardian_notifications_consent = true where id = $1",
    [f.students1A[2]],
  );
}

/** Inserts an invoice directly with a due date, bypassing create_invoice so tests can control it. */
async function insertInvoice(
  tx: Tx,
  f: { schoolId: string; studentId: string; yearId: string },
  options: { daysFromToday: number; totalAmount?: number; label?: string },
) {
  const [row] = await tx.query<{ id: string }>(
    "system",
    `insert into public.student_invoices (school_id, student_id, academic_year_id, label, total_amount, due_date)
     values ($1, $2, $3, $4, $5, (select current_date) + $6) returning id`,
    [f.schoolId, f.studentId, f.yearId, options.label ?? "Term 1", options.totalAmount ?? 1000, options.daysFromToday],
  );
  return row.id;
}

async function payInFull(tx: Tx, f: { schoolId: string; invoiceId: string; adminId: string }, amount = 1000) {
  await tx.query(
    "system",
    `insert into public.fee_payments (school_id, invoice_id, amount, method, received_by, recorded_via)
     values ($1, $2, $3, 'cash', $4, $4)`,
    [f.schoolId, f.invoiceId, amount, f.adminId],
  );
  await tx.query(
    "system",
    "update public.student_invoices set status = 'paid' where id = $1 and total_amount <= $2",
    [f.invoiceId, amount],
  );
}

const reminderJobs = (tx: Tx, schoolId: string) =>
  tx.query<{ id: string; invoice_id: string; status: string; attempts: number; recipient_phone: string }>(
    "system",
    "select id, invoice_id, status, attempts, recipient_phone from public.fee_reminder_jobs where school_id = $1",
    [schoolId],
  );

const scan = (tx: Tx) => tx.query<{ scan_overdue_invoices_for_reminders: number }>(
  "service",
  "select public.scan_overdue_invoices_for_reminders()",
);

describe("create_invoice due date", () => {
  it("stores an optional due date, defaulting to none", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      const [withDate] = await tx.query<{ due_date: string | null }>(
        f.adminId,
        "select due_date from public.create_invoice($1, $2, $3)",
        [f.students1A[0], "Term 1", "2026-12-31"],
      );
      expect(withDate.due_date).toBe("2026-12-31");

      const [withoutDate] = await tx.query<{ due_date: string | null }>(
        f.adminId,
        "select due_date from public.create_invoice($1, $2)",
        [f.students1A[1], "Term 1"],
      );
      expect(withoutDate.due_date).toBeNull();
    }));
});

describe("scan_overdue_invoices_for_reminders", () => {
  it("queues a reminder for an overdue, unpaid, consenting invoice", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      await setupMessaging(tx, f);
      const invoiceId = await insertInvoice(tx, { ...f, studentId: f.students1A[0] }, { daysFromToday: -5 });
      await scan(tx);
      const jobs = await reminderJobs(tx, f.schoolId);
      expect(jobs).toHaveLength(1);
      expect(jobs[0]).toMatchObject({ invoice_id: invoiceId, status: "queued", recipient_phone: "+919999900001" });
    }));

  it("queues nothing before the due date", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      await setupMessaging(tx, f);
      await insertInvoice(tx, { ...f, studentId: f.students1A[0] }, { daysFromToday: 5 });
      await scan(tx);
      expect(await reminderJobs(tx, f.schoolId)).toHaveLength(0);
    }));

  it("queues nothing with no due date at all", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      await setupMessaging(tx, f);
      const [row] = await tx.query<{ id: string }>(
        "system",
        `insert into public.student_invoices (school_id, student_id, academic_year_id, label, total_amount)
         values ($1, $2, $3, 'Term 1', 1000) returning id`,
        [f.schoolId, f.students1A[0], f.yearId],
      );
      await scan(tx);
      expect(await reminderJobs(tx, f.schoolId)).toHaveLength(0);
      void row;
    }));

  it("queues nothing while the school has messaging turned off", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      await setupMessaging(tx, f, false);
      await insertInvoice(tx, { ...f, studentId: f.students1A[0] }, { daysFromToday: -5 });
      await scan(tx);
      expect(await reminderJobs(tx, f.schoolId)).toHaveLength(0);
    }));

  it("queues nothing for a guardian without consent or without a phone", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      await setupMessaging(tx, f);
      await insertInvoice(tx, { ...f, studentId: f.students1A[1] }, { daysFromToday: -5 }); // no consent
      await insertInvoice(tx, { ...f, studentId: f.students1A[2] }, { daysFromToday: -5 }); // no phone
      await scan(tx);
      expect(await reminderJobs(tx, f.schoolId)).toHaveLength(0);
    }));

  it("does not duplicate a job that is already queued", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      await setupMessaging(tx, f);
      await insertInvoice(tx, { ...f, studentId: f.students1A[0] }, { daysFromToday: -5 });
      await scan(tx);
      await scan(tx);
      expect(await reminderJobs(tx, f.schoolId)).toHaveLength(1);
    }));

  it("reactivates a cancelled job if the invoice becomes unpaid again", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      await setupMessaging(tx, f);
      const invoiceId = await insertInvoice(tx, { ...f, studentId: f.students1A[0] }, { daysFromToday: -5 });
      await scan(tx);

      await payInFull(tx, { schoolId: f.schoolId, invoiceId, adminId: f.adminId });
      await tx.query("service", "select * from public.claim_fee_reminder_jobs(10)"); // runs the auto-cancel step
      expect((await reminderJobs(tx, f.schoolId))[0].status).toBe("cancelled");

      // Undo the payment directly (test fixture only -- app code never deletes a fee_payments row):
      // the invoice is unpaid again.
      await tx.query("system", "delete from public.fee_payments where invoice_id = $1", [invoiceId]);
      await tx.query("system", "update public.student_invoices set status = 'unpaid' where id = $1", [invoiceId]);

      await scan(tx);
      const jobs = await reminderJobs(tx, f.schoolId);
      expect(jobs).toHaveLength(1);
      expect(jobs[0].status).toBe("queued");
    }));
});

describe("claim_fee_reminder_jobs / complete_fee_reminder_job", () => {
  async function queuedJob(tx: Tx) {
    const f = await createSchool(tx);
    await setupMessaging(tx, f);
    const invoiceId = await insertInvoice(tx, { ...f, studentId: f.students1A[0] }, { daysFromToday: -5 });
    await scan(tx);
    const [job] = await reminderJobs(tx, f.schoolId);
    return { f, jobId: job.id, invoiceId };
  }

  it("claims a due job with the details the template needs, and only once", () =>
    withTx(async (tx) => {
      const { jobId } = await queuedJob(tx);
      const claimed = await tx.query<{ id: string; student_name: string; balance: number; invoice_label: string }>(
        "service",
        "select * from public.claim_fee_reminder_jobs(10)",
      );
      const mine = claimed.find((c) => c.id === jobId)!;
      expect(mine).toMatchObject({ student_name: "Student 1", invoice_label: "Term 1" });
      expect(Number(mine.balance)).toBe(1000);
      const again = await tx.query<{ id: string }>("service", "select id from public.claim_fee_reminder_jobs(10)");
      expect(again.find((c) => c.id === jobId)).toBeUndefined();
    }));

  it("cancels a queued reminder once the guardian withdraws consent, instead of sending to a stale recipient", () =>
    withTx(async (tx) => {
      const { f, jobId } = await queuedJob(tx);
      await tx.query("system", "update public.students set guardian_notifications_consent = false where id = $1", [
        f.students1A[0],
      ]);
      const claimed = await tx.query<{ id: string }>("service", "select id from public.claim_fee_reminder_jobs(10)");
      expect(claimed.find((c) => c.id === jobId)).toBeUndefined();
      const [job] = await tx.query<{ status: string }>(
        "system",
        "select status from public.fee_reminder_jobs where id = $1",
        [jobId],
      );
      expect(job.status).toBe("cancelled");
    }));

  it("cancels a queued reminder once the school's messaging switch is turned off", () =>
    withTx(async (tx) => {
      const { f, jobId } = await queuedJob(tx);
      await tx.query("system", "update public.schools set whatsapp_enabled = false where id = $1", [f.schoolId]);
      const claimed = await tx.query<{ id: string }>("service", "select id from public.claim_fee_reminder_jobs(10)");
      expect(claimed.find((c) => c.id === jobId)).toBeUndefined();
      const [job] = await tx.query<{ status: string }>(
        "system",
        "select status from public.fee_reminder_jobs where id = $1",
        [jobId],
      );
      expect(job.status).toBe("cancelled");
    }));

  it("sends to the guardian's current phone number, not a stale one stored at enqueue time", () =>
    withTx(async (tx) => {
      const { f, jobId } = await queuedJob(tx);
      await tx.query("system", "update public.students set guardian_phone = '+919999900099' where id = $1", [
        f.students1A[0],
      ]);
      const claimed = await tx.query<{ id: string; recipient_phone: string }>(
        "service",
        "select * from public.claim_fee_reminder_jobs(10)",
      );
      expect(claimed.find((c) => c.id === jobId)?.recipient_phone).toBe("+919999900099");
    }));

  it("cancels a job recovered from a crashed worker if it is no longer eligible, instead of re-sending it", () =>
    withTx(async (tx) => {
      const { f, jobId } = await queuedJob(tx);
      await tx.query("service", "select * from public.claim_fee_reminder_jobs(10)"); // now 'processing'
      await tx.query("system", "update public.students set guardian_notifications_consent = false where id = $1", [
        f.students1A[0],
      ]);
      // Simulate a crashed worker: stuck in 'processing' long enough to be recovered.
      await tx.query("system", "alter table public.fee_reminder_jobs disable trigger fee_reminder_jobs_set_updated_at");
      await tx.query("system", "update public.fee_reminder_jobs set updated_at = now() - interval '15 minutes' where id = $1", [
        jobId,
      ]);
      await tx.query("system", "alter table public.fee_reminder_jobs enable trigger fee_reminder_jobs_set_updated_at");

      const claimed = await tx.query<{ id: string }>("service", "select id from public.claim_fee_reminder_jobs(10)");
      expect(claimed.find((c) => c.id === jobId)).toBeUndefined();
      const [job] = await tx.query<{ status: string }>(
        "system",
        "select status from public.fee_reminder_jobs where id = $1",
        [jobId],
      );
      expect(job.status).toBe("cancelled");
    }));

  it("reschedules a successful send a month out while the invoice stays unpaid", () =>
    withTx(async (tx) => {
      const { f, jobId } = await queuedJob(tx);
      await tx.query("service", "select * from public.claim_fee_reminder_jobs(10)");
      await tx.query("service", "select public.complete_fee_reminder_job($1, 'sent', 'wamid.TEST1')", [jobId]);
      const [job] = await tx.query<{ status: string; provider_message_id: string; due_in_about_a_month: boolean }>(
        "system",
        `select status, provider_message_id,
                (next_attempt_at between now() + interval '27 days' and now() + interval '33 days') as due_in_about_a_month
         from public.fee_reminder_jobs where school_id = $1`,
        [f.schoolId],
      );
      expect(job.status).toBe("queued");
      expect(job.provider_message_id).toBe("wamid.TEST1");
      expect(job.due_in_about_a_month).toBe(true);
    }));

  it("cancels the job instead of rescheduling once the invoice is settled", () =>
    withTx(async (tx) => {
      const { f, jobId, invoiceId } = await queuedJob(tx);
      await tx.query("service", "select * from public.claim_fee_reminder_jobs(10)");
      await payInFull(tx, { schoolId: f.schoolId, invoiceId, adminId: f.adminId });
      await tx.query("service", "select public.complete_fee_reminder_job($1, 'sent', 'wamid.TEST2')", [jobId]);
      const [job] = await tx.query<{ status: string }>(
        "system",
        "select status from public.fee_reminder_jobs where school_id = $1",
        [f.schoolId],
      );
      expect(job.status).toBe("cancelled");
    }));

  it("retries transient failures with backoff and gives up after the last attempt", () =>
    withTx(async (tx) => {
      const { jobId } = await queuedJob(tx);
      await tx.query("system", "update public.fee_reminder_jobs set max_attempts = 2 where id = $1", [jobId]);

      await tx.query("service", "select * from public.claim_fee_reminder_jobs(10)");
      await tx.query("service", "select public.complete_fee_reminder_job($1, 'retry', null, 'HTTP 503')", [jobId]);
      let [job] = await tx.query<{ status: string; due_later: boolean }>(
        "system",
        "select status, next_attempt_at > now() as due_later from public.fee_reminder_jobs where id = $1",
        [jobId],
      );
      expect(job).toEqual({ status: "queued", due_later: true });

      await tx.query("system", "update public.fee_reminder_jobs set next_attempt_at = now() where id = $1", [jobId]);
      await tx.query("service", "select * from public.claim_fee_reminder_jobs(10)");
      await tx.query("service", "select public.complete_fee_reminder_job($1, 'retry', null, 'HTTP 503')", [jobId]);
      [job] = await tx.query("system", "select status from public.fee_reminder_jobs where id = $1", [jobId]);
      expect(job.status).toBe("failed");
    }));

  it("auto-cancels a queued job once its invoice is paid, even before it is claimed", () =>
    withTx(async (tx) => {
      const { f, invoiceId } = await queuedJob(tx);
      await payInFull(tx, { schoolId: f.schoolId, invoiceId, adminId: f.adminId });
      await tx.query("service", "select * from public.claim_fee_reminder_jobs(10)");
      const [job] = await tx.query<{ status: string }>(
        "system",
        "select status from public.fee_reminder_jobs where school_id = $1",
        [f.schoolId],
      );
      expect(job.status).toBe("cancelled");
    }));
});

describe("apply_whatsapp_status for fee reminders", () => {
  it("updates delivered/read timestamps on a fee reminder job by provider message id", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      await setupMessaging(tx, f);
      await insertInvoice(tx, { ...f, studentId: f.students1A[0] }, { daysFromToday: -5 });
      await scan(tx);
      const [job] = await reminderJobs(tx, f.schoolId);
      await tx.query("service", "select * from public.claim_fee_reminder_jobs(10)");
      await tx.query("service", "select public.complete_fee_reminder_job($1, 'sent', 'wamid.FEE1')", [job.id]);

      const apply = "select public.apply_whatsapp_status($1, $2, now(), $3) as changed";
      expect((await tx.query("service", apply, ["wamid.FEE1", "delivered", null]))[0].changed).toBe(true);
      const [row] = await tx.query<{ delivered_at: string | null; status: string }>(
        "system",
        "select delivered_at, status from public.fee_reminder_jobs where id = $1",
        [job.id],
      );
      expect(row.delivered_at).not.toBeNull();
      // Unlike the absence queue, status is already back to 'queued' for next month -- delivery tracking never moves it.
      expect(row.status).toBe("queued");
    }));
});

describe("fee reminder access control", () => {
  it("lets admins read their school's log and hides it from teachers and office", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      const officeId = await createUser(tx, f.schoolId, "office");
      await setupMessaging(tx, f);
      await insertInvoice(tx, { ...f, studentId: f.students1A[0] }, { daysFromToday: -5 });
      await scan(tx);
      expect(await tx.query(f.adminId, "select id from public.fee_reminder_jobs")).toHaveLength(1);
      expect(await tx.query(f.teacherId, "select id from public.fee_reminder_jobs")).toHaveLength(0);
      expect(await tx.query(officeId, "select id from public.fee_reminder_jobs")).toHaveLength(0);
      const anon = await tx.fails("anon", "select id from public.fee_reminder_jobs");
      expect(anon.code).toBe("42501");
    }));

  it("lets nobody but the server run the worker or scan functions", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      for (const actor of [f.adminId, f.teacherId, "anon"]) {
        expect((await tx.fails(actor, "select * from public.claim_fee_reminder_jobs(10)")).code).toBe("42501");
        expect(
          (await tx.fails(actor, "select public.complete_fee_reminder_job(gen_random_uuid(), 'sent', 'x', null)"))
            .code,
        ).toBe("42501");
        expect((await tx.fails(actor, "select public.scan_overdue_invoices_for_reminders()")).code).toBe("42501");
      }
    }));

  it("blocks clients from writing jobs directly", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      await setupMessaging(tx, f);
      await insertInvoice(tx, { ...f, studentId: f.students1A[0] }, { daysFromToday: -5 });
      await scan(tx);
      const error = await tx.fails(f.adminId, "update public.fee_reminder_jobs set status = 'sent'");
      expect(error.code).toBe("42501");
    }));
});
