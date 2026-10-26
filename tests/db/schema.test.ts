import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { closePool, createSchool, withTx } from "./helpers";

afterAll(closePool);

const insertStudent = `
  insert into public.students (school_id, admission_no, full_name, class_id, section_id)
  values ($1, $2, 'New Student', $3, $4)`;

describe("schema integrity", () => {
  it("rejects a duplicate admission number in the same school, ignoring case", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      await tx.query("system", insertStudent, [f.schoolId, "UN-100", f.class1Id, f.section1A]);
      const error = await tx.fails("system", insertStudent, [f.schoolId, "un-100", f.class1Id, f.section1A]);
      expect(error.code).toBe("23505");
    }));

  it("allows the same admission number in a different school", () =>
    withTx(async (tx) => {
      const a = await createSchool(tx);
      const b = await createSchool(tx);
      await tx.query("system", insertStudent, [a.schoolId, "UN-100", a.class1Id, a.section1A]);
      await tx.query("system", insertStudent, [b.schoolId, "UN-100", b.class1Id, b.section1A]);
    }));

  it("rejects a student whose section belongs to a different class", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      const error = await tx.fails("system", insertStudent, [f.schoolId, "UN-1", f.class2Id, f.section1A]);
      expect(error.code).toBe("23503");
    }));

  it("rejects a student placed in another school's class", () =>
    withTx(async (tx) => {
      const a = await createSchool(tx);
      const b = await createSchool(tx);
      const error = await tx.fails("system", insertStudent, [a.schoolId, "UN-1", b.class1Id, b.section1A]);
      expect(error.code).toBe("23503");
    }));

  it("rejects badly formatted guardian phone numbers", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      const error = await tx.fails(
        "system",
        `insert into public.students (school_id, admission_no, full_name, class_id, section_id, guardian_phone)
         values ($1, 'UN-2', 'Phone Test', $2, $3, '98765 43210')`,
        [f.schoolId, f.class1Id, f.section1A],
      );
      expect(error.code).toBe("23514");
    }));

  it("rejects duplicate class names within an academic year, ignoring case", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      const error = await tx.fails(
        "system",
        "insert into public.classes (school_id, academic_year_id, name) values ($1, $2, 'class 1')",
        [f.schoolId, f.yearId],
      );
      expect(error.code).toBe("23505");
    }));

  it("rejects a section whose class is in another academic year", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      const [{ id: otherYear }] = await tx.query<{ id: string }>(
        "system",
        `insert into public.academic_years (school_id, name, start_date, end_date)
         values ($1, 'Next', '2030-04-01', '2031-03-31') returning id`,
        [f.schoolId],
      );
      const error = await tx.fails(
        "system",
        "insert into public.sections (class_id, school_id, academic_year_id, name) values ($1, $2, $3, 'C')",
        [f.class1Id, f.schoolId, otherYear],
      );
      expect(error.code).toBe("23503");
    }));

  it("allows only one active academic year per school", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      const error = await tx.fails(
        "system",
        `insert into public.academic_years (school_id, name, start_date, end_date, is_active)
         values ($1, 'Another', '2030-04-01', '2031-03-31', true)`,
        [f.schoolId],
      );
      expect(error.code).toBe("23505");
    }));

  it("only lets teachers be assigned to sections", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      const error = await tx.fails(
        "system",
        "insert into public.teacher_assignments (school_id, teacher_id, section_id, academic_year_id) values ($1, $2, $3, $4)",
        [f.schoolId, f.adminId, f.section2A, f.yearId],
      );
      expect(error.code).toBe("23514");
    }));

  it("rejects a duplicate attendance session for a section and date", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      const insertSession = `
        insert into public.attendance_sessions (school_id, section_id, attendance_date, created_by)
        values ($1, $2, $3, $4)`;
      await tx.query("system", insertSession, [f.schoolId, f.section1A, f.today, f.adminId]);
      const error = await tx.fails("system", insertSession, [f.schoolId, f.section1A, f.today, f.adminId]);
      expect(error.code).toBe("23505");
    }));

  it("refuses to delete a student who has attendance history", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      const [session] = await tx.query<{ id: string }>(
        f.teacherId,
        "select id from public.open_attendance_session($1, $2)",
        [f.section1A, f.today],
      );
      await tx.query(f.teacherId, "select public.save_attendance_draft($1, $2)", [
        session.id,
        JSON.stringify([{ student_id: f.students1A[0], status: "present" }]),
      ]);
      const error = await tx.fails("system", "delete from public.students where id = $1", [f.students1A[0]]);
      expect(error.code).toBe("23503");
    }));

  it("keeps audit logs append-only", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      await tx.query(
        "system",
        "insert into public.audit_logs (school_id, action, entity_type, entity_id) values ($1, 'test', 'test', $2)",
        [f.schoolId, randomUUID()],
      );
      const error = await tx.fails("system", "delete from public.audit_logs where school_id = $1", [f.schoolId]);
      expect(error.code).toBe("42501");
    }));
});
