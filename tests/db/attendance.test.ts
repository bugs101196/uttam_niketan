import { afterAll, describe, expect, it } from "vitest";
import { closePool, createSchool, records, withTx, type SchoolFixture, type Tx } from "./helpers";

afterAll(closePool);

async function openSession(tx: Tx, actor: string, f: SchoolFixture, sectionId = f.section1A, date = f.today) {
  const [session] = await tx.query<{ id: string; status: string }>(
    actor,
    "select * from public.open_attendance_session($1, $2)",
    [sectionId, date],
  );
  return session;
}

const submit = "select * from public.submit_attendance_session($1, $2)";

describe("attendance workflow", () => {
  it("opens a session idempotently", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      const first = await openSession(tx, f.teacherId, f);
      const second = await openSession(tx, f.teacherId, f);
      expect(second.id).toBe(first.id);
      expect(first.status).toBe("draft");
    }));

  it("refuses sessions for unassigned sections, inactive teachers and future dates", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      const open = "select public.open_attendance_session($1, $2)";
      expect((await tx.fails(f.teacherId, open, [f.section1B, f.today])).code).toBe("42501");
      expect((await tx.fails(f.otherTeacherId, open, [f.section1A, f.today])).code).toBe("42501");
      expect((await tx.fails(f.inactiveTeacherId, open, [f.section1A, f.today])).code).toBe("42501");
      expect((await tx.fails("anon", open, [f.section1A, f.today])).code).toBe("42501");

      const [{ tomorrow }] = await tx.query<{ tomorrow: string }>("system", "select ($1::date + 1)::text as tomorrow", [
        f.today,
      ]);
      expect((await tx.fails(f.teacherId, open, [f.section1A, tomorrow])).code).toBe("22023");
    }));

  it("refuses a section from another school even for an admin", () =>
    withTx(async (tx) => {
      const a = await createSchool(tx);
      const b = await createSchool(tx);
      const error = await tx.fails(a.adminId, "select public.open_attendance_session($1, $2)", [b.section1A, a.today]);
      expect(error.code).toBe("42501");
    }));

  it("saves a draft and reopens it with the saved statuses", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      const session = await openSession(tx, f.teacherId, f);
      await tx.query(f.teacherId, "select public.save_attendance_draft($1, $2)", [
        session.id,
        records(f.students1A.slice(0, 2), (i) => (i === 0 ? "absent" : "present")),
      ]);
      // Changing one status again updates rather than duplicates.
      await tx.query(f.teacherId, "select public.save_attendance_draft($1, $2)", [
        session.id,
        records([f.students1A[0]], () => "present"),
      ]);
      const rows = await tx.query<{ student_id: string; status: string; marked_by: string }>(
        f.teacherId,
        "select student_id, status, marked_by from public.attendance_records where session_id = $1 order by student_id",
        [session.id],
      );
      expect(rows).toHaveLength(2);
      expect(rows.every((r) => r.status === "present" && r.marked_by === f.teacherId)).toBe(true);
    }));

  it("rejects records for students outside the section, duplicates and bad statuses", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      const session = await openSession(tx, f.teacherId, f);
      const save = "select public.save_attendance_draft($1, $2)";
      expect((await tx.fails(f.teacherId, save, [session.id, records([f.students1B[0]])])).code).toBe("22023");
      expect((await tx.fails(f.teacherId, save, [session.id, records([f.students1A[0], f.students1A[0]])])).code).toBe(
        "22023",
      );
      expect((await tx.fails(f.teacherId, save, [session.id, records([f.students1A[0]], () => "asleep")])).code).toBe(
        "22023",
      );
    }));

  it("does not let another teacher touch a session they are not assigned to", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      const session = await openSession(tx, f.teacherId, f);
      const error = await tx.fails(f.otherTeacherId, "select public.save_attendance_draft($1, $2)", [
        session.id,
        records(f.students1A),
      ]);
      expect(error.code).toBe("P0002");
      expect(await tx.query(f.otherTeacherId, "select * from public.attendance_sessions")).toHaveLength(0);
    }));

  it("requires every active student before submitting", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      const session = await openSession(tx, f.teacherId, f);
      const error = await tx.fails(f.teacherId, submit, [session.id, records(f.students1A.slice(0, 2))]);
      expect(error.code).toBe("22023");
      expect(error.message).toMatch(/missing for 1 student/);
      // Nothing from the failed submit was kept.
      const [state] = await tx.query<{ status: string }>(
        "system",
        "select status from public.attendance_sessions where id = $1",
        [session.id],
      );
      expect(state.status).toBe("draft");
    }));

  it("ignores inactive students when checking the roster", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      await tx.query("system", "update public.students set enrollment_status = 'transferred' where id = $1", [
        f.students1A[2],
      ]);
      const session = await openSession(tx, f.teacherId, f);
      const [submitted] = await tx.query<{ status: string }>(f.teacherId, submit, [
        session.id,
        records(f.students1A.slice(0, 2)),
      ]);
      expect(submitted.status).toBe("submitted");
    }));

  it("submits atomically, records who submitted, and writes an audit entry", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      const session = await openSession(tx, f.teacherId, f);
      const [submitted] = await tx.query<{ status: string; submitted_by: string }>(f.teacherId, submit, [
        session.id,
        records(f.students1A, (i) => (i === 1 ? "absent" : "present")),
      ]);
      expect(submitted.status).toBe("submitted");
      expect(submitted.submitted_by).toBe(f.teacherId);

      const [log] = await tx.query<{ action: string; details: { absent_count: number } }>(
        "system",
        "select action, details from public.audit_logs where entity_id = $1",
        [session.id],
      );
      expect(log.action).toBe("attendance.submitted");
      expect(log.details.absent_count).toBe(1);
    }));

  it("treats a repeated submit as a safe no-op", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      const session = await openSession(tx, f.teacherId, f);
      await tx.query(f.teacherId, submit, [session.id, records(f.students1A)]);
      // A network retry, even with different data, must not change anything.
      const [again] = await tx.query<{ status: string }>(f.teacherId, submit, [
        session.id,
        records(f.students1A, () => "absent"),
      ]);
      expect(again.status).toBe("submitted");

      const rows = await tx.query<{ status: string }>(
        "system",
        "select status from public.attendance_records where session_id = $1",
        [session.id],
      );
      expect(rows).toHaveLength(f.students1A.length);
      expect(rows.every((r) => r.status === "present")).toBe(true);
      const logs = await tx.query("system", "select 1 from public.audit_logs where entity_id = $1", [session.id]);
      expect(logs).toHaveLength(1);
    }));

  it("blocks draft edits after submission", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      const session = await openSession(tx, f.teacherId, f);
      await tx.query(f.teacherId, submit, [session.id, records(f.students1A)]);
      const error = await tx.fails(f.teacherId, "select public.save_attendance_draft($1, $2)", [
        session.id,
        records(f.students1A, () => "absent"),
      ]);
      expect(error.code).toBe("55000");
    }));

  it("refuses to submit when the roster changed after the draft", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      const session = await openSession(tx, f.teacherId, f);
      await tx.query(f.teacherId, "select public.save_attendance_draft($1, $2)", [session.id, records(f.students1A)]);
      // Student moves to 1B after the draft was saved.
      await tx.query("system", "update public.students set section_id = $1, roll_no = 9 where id = $2", [
        f.section1B,
        f.students1A[0],
      ]);
      const error = await tx.fails(f.teacherId, submit, [session.id, records(f.students1A.slice(1))]);
      expect(error.code).toBe("22023");
      expect(error.message).toMatch(/roster changed/);
    }));

  it("lets only an admin correct submitted attendance, with a reason and an audit entry", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      const session = await openSession(tx, f.teacherId, f);
      await tx.query(f.teacherId, submit, [session.id, records(f.students1A)]);
      const correct = "select * from public.correct_attendance_record($1, $2, $3, $4)";

      expect((await tx.fails(f.teacherId, correct, [session.id, f.students1A[0], "absent", "typo"])).code).toBe(
        "42501",
      );
      expect((await tx.fails(f.adminId, correct, [session.id, f.students1A[0], "absent", "  "])).code).toBe("22023");

      const [record] = await tx.query<{ status: string; marked_by: string }>(f.adminId, correct, [
        session.id,
        f.students1A[0],
        "absent",
        "Teacher marked the wrong child",
      ]);
      expect(record.status).toBe("absent");
      expect(record.marked_by).toBe(f.adminId);

      const [log] = await tx.query<{ details: { from: string; to: string; reason: string } }>(
        f.adminId,
        "select details from public.audit_logs where action = 'attendance.corrected'",
      );
      expect(log.details).toMatchObject({ from: "present", to: "absent", reason: "Teacher marked the wrong child" });
    }));

  it("prevents corrections once a session is locked", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      const session = await openSession(tx, f.teacherId, f);
      await tx.query(f.teacherId, submit, [session.id, records(f.students1A)]);
      expect((await tx.fails(f.teacherId, "select public.lock_attendance_session($1)", [session.id])).code).toBe(
        "42501",
      );
      await tx.query(f.adminId, "select public.lock_attendance_session($1)", [session.id]);
      const error = await tx.fails(f.adminId, "select public.correct_attendance_record($1, $2, $3, $4)", [
        session.id,
        f.students1A[0],
        "absent",
        "too late",
      ]);
      expect(error.code).toBe("55000");
    }));

  it("never counts an unsubmitted session as absences", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      await openSession(tx, f.teacherId, f);
      const [{ n }] = await tx.query<{ n: number }>(
        "system",
        "select count(*)::int as n from public.attendance_records where status = 'absent'",
      );
      expect(n).toBe(0);
    }));
});
