import { afterAll, describe, expect, it } from "vitest";
import { closePool, createSchool, records, withTx, type SchoolFixture, type Tx } from "./helpers";

afterAll(closePool);

// Students in 1A: [0] consented with a phone, [1] phone but no consent,
// [2] consented but no phone. Only [0] is eligible for absence alerts.
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

async function submitAllAbsent(tx: Tx, f: SchoolFixture) {
  const [session] = await tx.query<{ id: string }>(
    f.teacherId,
    "select id from public.open_attendance_session($1, $2)",
    [f.section1A, f.today],
  );
  await tx.query(f.teacherId, "select public.submit_attendance_session($1, $2)", [
    session.id,
    records(f.students1A, () => "absent"),
  ]);
  return session.id;
}

const jobs = (tx: Tx, schoolId: string) =>
  tx.query<{ id: string; student_id: string; status: string; attempts: number; recipient_phone: string }>(
    "system",
    "select id, student_id, status, attempts, recipient_phone from public.notification_jobs where school_id = $1",
    [schoolId],
  );

describe("absence notification queue", () => {
  it("queues one job per eligible absent student when attendance is submitted", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      await setupMessaging(tx, f);
      await submitAllAbsent(tx, f);
      const queued = await jobs(tx, f.schoolId);
      expect(queued).toHaveLength(1);
      expect(queued[0]).toMatchObject({
        student_id: f.students1A[0],
        status: "queued",
        recipient_phone: "+919999900001",
      });
    }));

  it("queues nothing while the school has messaging turned off", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      await setupMessaging(tx, f, false);
      await submitAllAbsent(tx, f);
      expect(await jobs(tx, f.schoolId)).toHaveLength(0);
    }));

  it("queues nothing for present students or drafts", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      await setupMessaging(tx, f);
      const [session] = await tx.query<{ id: string }>(
        f.teacherId,
        "select id from public.open_attendance_session($1, $2)",
        [f.section1A, f.today],
      );
      await tx.query(f.teacherId, "select public.save_attendance_draft($1, $2)", [
        session.id,
        records(f.students1A, () => "absent"),
      ]);
      expect(await jobs(tx, f.schoolId)).toHaveLength(0);
      await tx.query(f.teacherId, "select public.submit_attendance_session($1, $2)", [
        session.id,
        records(f.students1A, () => "present"),
      ]);
      expect(await jobs(tx, f.schoolId)).toHaveLength(0);
    }));

  it("never queues twice when a submit is retried", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      await setupMessaging(tx, f);
      const sessionId = await submitAllAbsent(tx, f);
      await tx.query(f.teacherId, "select public.submit_attendance_session($1, $2)", [
        sessionId,
        records(f.students1A, () => "absent"),
      ]);
      expect(await jobs(tx, f.schoolId)).toHaveLength(1);
    }));

  it("cancels an unsent alert when an admin corrects the absence, and requeues if corrected back", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      await setupMessaging(tx, f);
      const sessionId = await submitAllAbsent(tx, f);
      const correct = "select public.correct_attendance_record($1, $2, $3, $4)";

      await tx.query(f.adminId, correct, [sessionId, f.students1A[0], "present", "Arrived late, was in class"]);
      expect((await jobs(tx, f.schoolId))[0].status).toBe("cancelled");

      await tx.query(f.adminId, correct, [sessionId, f.students1A[0], "absent", "Left before roll call"]);
      const after = await jobs(tx, f.schoolId);
      expect(after).toHaveLength(1);
      expect(after[0].status).toBe("queued");
    }));

  it("does not cancel or requeue an alert that was already sent", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      await setupMessaging(tx, f);
      const sessionId = await submitAllAbsent(tx, f);
      await tx.query("system", "update public.notification_jobs set status = 'sent' where school_id = $1", [
        f.schoolId,
      ]);
      await tx.query(f.adminId, "select public.correct_attendance_record($1, $2, $3, $4)", [
        sessionId,
        f.students1A[0],
        "present",
        "Mistake",
      ]);
      expect((await jobs(tx, f.schoolId))[0].status).toBe("sent");
    }));
});

describe("notification worker functions", () => {
  async function queuedJob(tx: Tx) {
    const f = await createSchool(tx);
    await setupMessaging(tx, f);
    await submitAllAbsent(tx, f);
    const [job] = await jobs(tx, f.schoolId);
    return { f, jobId: job.id };
  }

  it("claims a due job with the details the template needs, and only once", () =>
    withTx(async (tx) => {
      const { jobId } = await queuedJob(tx);
      const claimed = await tx.query<{ id: string; student_name: string; class_label: string; attempts: number }>(
        "service",
        "select * from public.claim_notification_jobs(10)",
      );
      const mine = claimed.find((c) => c.id === jobId)!;
      expect(mine).toMatchObject({ student_name: "Student 1", class_label: "Class 1 – A", attempts: 1 });
      const again = await tx.query<{ id: string }>("service", "select id from public.claim_notification_jobs(10)");
      expect(again.find((c) => c.id === jobId)).toBeUndefined();
    }));

  it("marks a successful send and stores the provider message id", () =>
    withTx(async (tx) => {
      const { f, jobId } = await queuedJob(tx);
      await tx.query("service", "select * from public.claim_notification_jobs(10)");
      await tx.query("service", "select public.complete_notification_job($1, 'sent', 'wamid.TEST1')", [jobId]);
      const [job] = await tx.query<{ status: string; provider_message_id: string; sent_at: string }>(
        "system",
        "select status, provider_message_id, sent_at from public.notification_jobs where school_id = $1",
        [f.schoolId],
      );
      expect(job.status).toBe("sent");
      expect(job.provider_message_id).toBe("wamid.TEST1");
      expect(job.sent_at).not.toBeNull();
    }));

  it("retries transient failures with backoff and gives up after the last attempt", () =>
    withTx(async (tx) => {
      const { jobId } = await queuedJob(tx);
      await tx.query("system", "update public.notification_jobs set max_attempts = 2 where id = $1", [jobId]);

      await tx.query("service", "select * from public.claim_notification_jobs(10)");
      await tx.query("service", "select public.complete_notification_job($1, 'retry', null, 'HTTP 503')", [jobId]);
      let [job] = await tx.query<{ status: string; due_later: boolean }>(
        "system",
        "select status, next_attempt_at > now() as due_later from public.notification_jobs where id = $1",
        [jobId],
      );
      expect(job).toEqual({ status: "queued", due_later: true });

      // Not due yet, so not claimed.
      const early = await tx.query<{ id: string }>("service", "select id from public.claim_notification_jobs(10)");
      expect(early.find((c) => c.id === jobId)).toBeUndefined();

      await tx.query("system", "update public.notification_jobs set next_attempt_at = now() where id = $1", [jobId]);
      await tx.query("service", "select * from public.claim_notification_jobs(10)");
      await tx.query("service", "select public.complete_notification_job($1, 'retry', null, 'HTTP 503')", [jobId]);
      [job] = await tx.query("system", "select status from public.notification_jobs where id = $1", [jobId]);
      expect(job.status).toBe("failed");
    }));

  it("fails permanent errors immediately", () =>
    withTx(async (tx) => {
      const { jobId } = await queuedJob(tx);
      await tx.query("service", "select * from public.claim_notification_jobs(10)");
      await tx.query("service", "select public.complete_notification_job($1, 'failed', null, 'Invalid recipient')", [
        jobId,
      ]);
      const [job] = await tx.query<{ status: string; last_error: string }>(
        "system",
        "select status, last_error from public.notification_jobs where id = $1",
        [jobId],
      );
      expect(job).toEqual({ status: "failed", last_error: "Invalid recipient" });
    }));

  it("expires alerts for absences more than two days old instead of sending them late", () =>
    withTx(async (tx) => {
      const { jobId } = await queuedJob(tx);
      await tx.query(
        "system",
        "update public.notification_jobs set attendance_date = attendance_date - 3 where id = $1",
        [jobId],
      );
      const claimed = await tx.query<{ id: string }>("service", "select id from public.claim_notification_jobs(10)");
      expect(claimed.find((c) => c.id === jobId)).toBeUndefined();
      const [job] = await tx.query("system", "select status from public.notification_jobs where id = $1", [jobId]);
      expect(job.status).toBe("skipped");
    }));

  it("recovers a job left in processing by a crashed worker", () =>
    withTx(async (tx) => {
      const { jobId } = await queuedJob(tx);
      await tx.query("service", "select * from public.claim_notification_jobs(10)");
      // Disable the updated_at trigger's effect by backdating directly.
      await tx.query("system", "alter table public.notification_jobs disable trigger notification_jobs_set_updated_at");
      await tx.query(
        "system",
        "update public.notification_jobs set updated_at = now() - interval '15 minutes' where id = $1",
        [jobId],
      );
      await tx.query("system", "alter table public.notification_jobs enable trigger notification_jobs_set_updated_at");
      const claimed = await tx.query<{ id: string; attempts: number }>(
        "service",
        "select id, attempts from public.claim_notification_jobs(10)",
      );
      expect(claimed.find((c) => c.id === jobId)?.attempts).toBe(2);
    }));
});

describe("provider status callbacks", () => {
  async function sentJob(tx: Tx) {
    const f = await createSchool(tx);
    await setupMessaging(tx, f);
    await submitAllAbsent(tx, f);
    const [job] = await jobs(tx, f.schoolId);
    await tx.query("service", "select * from public.claim_notification_jobs(10)");
    await tx.query("service", "select public.complete_notification_job($1, 'sent', $2)", [job.id, `wamid.${job.id}`]);
    return { jobId: job.id, messageId: `wamid.${job.id}` };
  }
  const apply = "select public.apply_whatsapp_status($1, $2, now(), $3) as changed";
  const statusOf = async (tx: Tx, id: string) =>
    (await tx.query<{ status: string }>("system", "select status from public.notification_jobs where id = $1", [id]))[0]
      .status;

  it("moves forward through delivered and read, ignoring repeats and out-of-order events", () =>
    withTx(async (tx) => {
      const { jobId, messageId } = await sentJob(tx);
      expect((await tx.query("service", apply, [messageId, "delivered", null]))[0].changed).toBe(true);
      expect((await tx.query("service", apply, [messageId, "delivered", null]))[0].changed).toBe(false);
      expect((await tx.query("service", apply, [messageId, "read", null]))[0].changed).toBe(true);
      // A late "sent" or "delivered" must not move the status backwards.
      expect((await tx.query("service", apply, [messageId, "sent", null]))[0].changed).toBe(false);
      expect((await tx.query("service", apply, [messageId, "delivered", null]))[0].changed).toBe(false);
      expect(await statusOf(tx, jobId)).toBe("read");
    }));

  it("accepts a failure before delivery but not after", () =>
    withTx(async (tx) => {
      const first = await sentJob(tx);
      await tx.query("service", apply, [first.messageId, "failed", "Recipient not on WhatsApp"]);
      expect(await statusOf(tx, first.jobId)).toBe("failed");

      const second = await sentJob(tx);
      await tx.query("service", apply, [second.messageId, "delivered", null]);
      await tx.query("service", apply, [second.messageId, "failed", "late failure"]);
      expect(await statusOf(tx, second.jobId)).toBe("delivered");
    }));

  it("ignores unknown message ids", () =>
    withTx(async (tx) => {
      expect((await tx.query("service", apply, ["wamid.unknown", "delivered", null]))[0].changed).toBe(false);
    }));
});

describe("notification access control", () => {
  it("lets admins read their school's log and hides it from teachers", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      await setupMessaging(tx, f);
      await submitAllAbsent(tx, f);
      expect(await tx.query(f.adminId, "select id from public.notification_jobs")).toHaveLength(1);
      expect(await tx.query(f.teacherId, "select id from public.notification_jobs")).toHaveLength(0);
      const anon = await tx.fails("anon", "select id from public.notification_jobs");
      expect(anon.code).toBe("42501");
    }));

  it("lets nobody but the server run the worker or webhook functions", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      for (const actor of [f.adminId, f.teacherId, "anon"]) {
        expect((await tx.fails(actor, "select * from public.claim_notification_jobs(10)")).code).toBe("42501");
        expect((await tx.fails(actor, "select public.apply_whatsapp_status('x', 'read', now(), null)")).code).toBe(
          "42501",
        );
        expect(
          (await tx.fails(actor, "select public.complete_notification_job(gen_random_uuid(), 'sent', 'x', null)")).code,
        ).toBe("42501");
      }
    }));

  it("blocks clients from writing jobs directly", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      await setupMessaging(tx, f);
      await submitAllAbsent(tx, f);
      const error = await tx.fails(f.adminId, "update public.notification_jobs set status = 'sent'");
      expect(error.code).toBe("42501");
    }));
});
