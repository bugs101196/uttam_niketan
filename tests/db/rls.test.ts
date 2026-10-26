import { afterAll, describe, expect, it } from "vitest";
import { closePool, createSchool, withTx } from "./helpers";

afterAll(closePool);

const countStudents = "select count(*)::int as n from public.students";

describe("row level security", () => {
  it("shows anonymous visitors nothing", () =>
    withTx(async (tx) => {
      await createSchool(tx);
      const error = await tx.fails("anon", "select * from public.students");
      expect(error.code).toBe("42501");
    }));

  it("lets an admin see every student in their school and none in another", () =>
    withTx(async (tx) => {
      const a = await createSchool(tx);
      const b = await createSchool(tx);
      const rows = await tx.query<{ school_id: string }>(a.adminId, "select school_id from public.students");
      expect(rows).toHaveLength(a.students1A.length + a.students1B.length);
      expect(rows.every((r) => r.school_id === a.schoolId)).toBe(true);
      expect(rows.some((r) => r.school_id === b.schoolId)).toBe(false);
    }));

  it("lets a teacher see only students in assigned sections", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      const rows = await tx.query<{ id: string }>(f.teacherId, "select id from public.students");
      expect(rows.map((r) => r.id).sort()).toEqual([...f.students1A].sort());
    }));

  it("shows an unassigned teacher no students", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      const [{ n }] = await tx.query<{ n: number }>(f.otherTeacherId, countStudents);
      expect(n).toBe(0);
    }));

  it("cuts off a deactivated teacher even if still assigned", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      const [{ n }] = await tx.query<{ n: number }>(f.inactiveTeacherId, countStudents);
      expect(n).toBe(0);
    }));

  it("cuts off a teacher whose assignment is in an inactive academic year", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      await tx.query("system", "update public.academic_years set is_active = false where id = $1", [f.yearId]);
      const [{ n }] = await tx.query<{ n: number }>(f.teacherId, countStudents);
      expect(n).toBe(0);
    }));

  it("does not let a teacher create or edit students", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      const insert = await tx.fails(
        f.teacherId,
        `insert into public.students (school_id, admission_no, full_name, class_id, section_id)
         values ($1, 'T-1', 'Sneaky', $2, $3)`,
        [f.schoolId, f.class1Id, f.section1A],
      );
      expect(insert.code).toBe("42501");

      await tx.query(f.teacherId, "update public.students set full_name = 'Changed' where id = $1", [f.students1A[0]]);
      const [row] = await tx.query<{ full_name: string }>(
        "system",
        "select full_name from public.students where id = $1",
        [f.students1A[0]],
      );
      expect(row.full_name).not.toBe("Changed");
    }));

  it("lets an admin create a student but not in another school", () =>
    withTx(async (tx) => {
      const a = await createSchool(tx);
      const b = await createSchool(tx);
      const sql = `insert into public.students (school_id, admission_no, full_name, class_id, section_id)
                   values ($1, 'A-1', 'New', $2, $3)`;
      await tx.query(a.adminId, sql, [a.schoolId, a.class1Id, a.section1A]);
      const error = await tx.fails(a.adminId, sql, [b.schoolId, b.class1Id, b.section1A]);
      expect(error.code).toBe("42501");
    }));

  it("does not let a teacher manage classes or assignments", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      const cls = await tx.fails(
        f.teacherId,
        "insert into public.classes (school_id, academic_year_id, name) values ($1, $2, 'Class 9')",
        [f.schoolId, f.yearId],
      );
      expect(cls.code).toBe("42501");
      const assign = await tx.fails(
        f.teacherId,
        "insert into public.teacher_assignments (school_id, teacher_id, section_id, academic_year_id) values ($1, $2, $3, $4)",
        [f.schoolId, f.teacherId, f.section1B, f.yearId],
      );
      expect(assign.code).toBe("42501");
    }));

  it("does not let users change their own role or active status", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      // Teachers cannot update profiles at all (no matching policy: zero rows).
      await tx.query(f.teacherId, "update public.profiles set role = 'admin' where id = $1", [f.teacherId]);
      const [teacher] = await tx.query<{ role: string }>("system", "select role from public.profiles where id = $1", [
        f.teacherId,
      ]);
      expect(teacher.role).toBe("teacher");

      // Admins cannot demote or deactivate themselves.
      const error = await tx.fails(f.adminId, "update public.profiles set is_active = false where id = $1", [
        f.adminId,
      ]);
      expect(error.code).toBe("42501");
    }));

  it("lets an admin deactivate a teacher but not move them to another school", () =>
    withTx(async (tx) => {
      const a = await createSchool(tx);
      const b = await createSchool(tx);
      await tx.query(a.adminId, "update public.profiles set is_active = false where id = $1", [a.teacherId]);
      const [row] = await tx.query<{ is_active: boolean }>(
        "system",
        "select is_active from public.profiles where id = $1",
        [a.teacherId],
      );
      expect(row.is_active).toBe(false);

      const error = await tx.fails(a.adminId, "update public.profiles set school_id = $1 where id = $2", [
        b.schoolId,
        a.otherTeacherId,
      ]);
      expect(error.code).toBe("42501");
    }));

  it("blocks direct writes to attendance tables", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      const error = await tx.fails(
        f.adminId,
        `insert into public.attendance_sessions (school_id, section_id, attendance_date, created_by)
         values ($1, $2, $3, $4)`,
        [f.schoolId, f.section1A, f.today, f.adminId],
      );
      expect(error.code).toBe("42501");
    }));

  it("hides audit logs from teachers", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      await tx.query("system", "insert into public.audit_logs (school_id, action, entity_type) values ($1, 'x', 'x')", [
        f.schoolId,
      ]);
      expect(await tx.query(f.teacherId, "select * from public.audit_logs")).toHaveLength(0);
      expect(await tx.query(f.adminId, "select * from public.audit_logs")).toHaveLength(1);
    }));
});
