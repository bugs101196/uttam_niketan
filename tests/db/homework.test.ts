import { afterAll, describe, expect, it } from "vitest";
import { assignTeacher, closePool, createGuardian, createSchool, createUser, Tx, withTx } from "./helpers";

afterAll(closePool);

async function insertHomework(
  tx: Tx,
  f: { schoolId: string; sectionId: string; createdBy: string },
  dueDate: string,
) {
  const [row] = await tx.query<{ id: string }>(
    "system",
    `insert into public.homework (school_id, section_id, subject, description_en, description_hi, due_date, created_by)
     values ($1, $2, 'Maths', 'Do exercise 3', 'exercise 3 karo', $3, $4) returning id`,
    [f.schoolId, f.sectionId, dueDate, f.createdBy],
  );
  return row.id;
}

describe("homework row level security", () => {
  it("lets an admin see homework school-wide but not from another school", () =>
    withTx(async (tx) => {
      const a = await createSchool(tx);
      const b = await createSchool(tx);
      await insertHomework(tx, { schoolId: a.schoolId, sectionId: a.section1A, createdBy: a.adminId }, a.today);
      await insertHomework(tx, { schoolId: a.schoolId, sectionId: a.section1B, createdBy: a.adminId }, a.today);
      await insertHomework(tx, { schoolId: b.schoolId, sectionId: b.section1A, createdBy: b.adminId }, b.today);

      const rows = await tx.query<{ school_id: string }>(a.adminId, "select school_id from public.homework");
      expect(rows).toHaveLength(2);
      expect(rows.every((r) => r.school_id === a.schoolId)).toBe(true);
    }));

  it("lets office staff see homework school-wide, same as admin", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      const officeId = await createUser(tx, f.schoolId, "office");
      await insertHomework(tx, { schoolId: f.schoolId, sectionId: f.section1A, createdBy: f.adminId }, f.today);
      await insertHomework(tx, { schoolId: f.schoolId, sectionId: f.section1B, createdBy: f.adminId }, f.today);

      const rows = await tx.query(officeId, "select id from public.homework");
      expect(rows).toHaveLength(2);
    }));

  it("lets an assigned teacher see only their own section's homework", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      await insertHomework(tx, { schoolId: f.schoolId, sectionId: f.section1A, createdBy: f.adminId }, f.today);
      await insertHomework(tx, { schoolId: f.schoolId, sectionId: f.section1B, createdBy: f.adminId }, f.today);

      const rows = await tx.query<{ section_id: string }>(f.teacherId, "select section_id from public.homework");
      expect(rows).toHaveLength(1);
      expect(rows[0].section_id).toBe(f.section1A);
    }));

  it("shows an unassigned teacher no homework at all", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      await insertHomework(tx, { schoolId: f.schoolId, sectionId: f.section1A, createdBy: f.adminId }, f.today);
      expect(await tx.query(f.otherTeacherId, "select id from public.homework")).toHaveLength(0);
    }));

  it("lets a guardian see homework only for their own child's section", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      const h1A = await insertHomework(tx, { schoolId: f.schoolId, sectionId: f.section1A, createdBy: f.adminId }, f.today);
      await insertHomework(tx, { schoolId: f.schoolId, sectionId: f.section1B, createdBy: f.adminId }, f.today);
      const guardianId = await createGuardian(tx, f.schoolId, [f.students1A[0]]);

      const rows = await tx.query<{ id: string }>(guardianId, "select id from public.homework");
      expect(rows.map((r) => r.id)).toEqual([h1A]);
    }));

  it("shows anonymous visitors no homework", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      await insertHomework(tx, { schoolId: f.schoolId, sectionId: f.section1A, createdBy: f.adminId }, f.today);
      const error = await tx.fails("anon", "select * from public.homework");
      expect(error.code).toBe("42501");
    }));

  it("lets an admin create homework for any section in their school", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      await tx.query(
        f.adminId,
        `insert into public.homework (school_id, section_id, subject, description_en, description_hi, due_date, created_by)
         values ($1, $2, 'Science', 'Read ch 2', 'adhyay 2 padho', $3, $4)`,
        [f.schoolId, f.section1B, f.today, f.adminId],
      );
      const rows = await tx.query(f.adminId, "select id from public.homework");
      expect(rows).toHaveLength(1);
    }));

  it("blocks a teacher from creating homework for a section they are not assigned to", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      const error = await tx.fails(
        f.teacherId,
        `insert into public.homework (school_id, section_id, subject, description_en, description_hi, due_date, created_by)
         values ($1, $2, 'Science', 'Read ch 2', 'adhyay 2 padho', $3, $4)`,
        [f.schoolId, f.section1B, f.today, f.teacherId],
      );
      expect(error.code).toBe("42501");
    }));

  it("blocks a teacher from posting homework under someone else's name", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      const error = await tx.fails(
        f.teacherId,
        `insert into public.homework (school_id, section_id, subject, description_en, description_hi, due_date, created_by)
         values ($1, $2, 'Science', 'Read ch 2', 'adhyay 2 padho', $3, $4)`,
        [f.schoolId, f.section1A, f.today, f.adminId],
      );
      expect(error.code).toBe("42501");
    }));

  it("blocks office staff from creating homework (view-only)", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      const officeId = await createUser(tx, f.schoolId, "office");
      const error = await tx.fails(
        officeId,
        `insert into public.homework (school_id, section_id, subject, description_en, description_hi, due_date, created_by)
         values ($1, $2, 'Science', 'Read ch 2', 'adhyay 2 padho', $3, $4)`,
        [f.schoolId, f.section1A, f.today, officeId],
      );
      expect(error.code).toBe("42501");
    }));

  it("rejects homework whose section does not actually belong to the claimed school", () =>
    withTx(async (tx) => {
      const a = await createSchool(tx);
      const b = await createSchool(tx);
      // RLS alone would allow this (school_id = a's own school, admin of a) --
      // the homework_section_school_fk composite FK is what must catch it,
      // since section b.section1A really belongs to school b.
      const error = await tx.fails(
        a.adminId,
        `insert into public.homework (school_id, section_id, subject, description_en, description_hi, due_date, created_by)
         values ($1, $2, 'Science', 'Read ch 2', 'adhyay 2 padho', $3, $4)`,
        [a.schoolId, b.section1A, a.today, a.adminId],
      );
      expect(["42501", "23503"]).toContain(error.code);
    }));

  it("lets an admin edit any homework row in their school", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      const id = await insertHomework(tx, { schoolId: f.schoolId, sectionId: f.section1A, createdBy: f.teacherId }, f.today);
      await tx.query(f.adminId, "update public.homework set subject = 'Changed' where id = $1", [id]);
      const [row] = await tx.query<{ subject: string }>("system", "select subject from public.homework where id = $1", [id]);
      expect(row.subject).toBe("Changed");
    }));

  it("lets the original teacher-author edit their own homework on their assigned section", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      const id = await insertHomework(tx, { schoolId: f.schoolId, sectionId: f.section1A, createdBy: f.teacherId }, f.today);
      await tx.query(f.teacherId, "update public.homework set subject = 'Changed' where id = $1", [id]);
      const [row] = await tx.query<{ subject: string }>("system", "select subject from public.homework where id = $1", [id]);
      expect(row.subject).toBe("Changed");
    }));

  it("blocks a co-teacher on the same section from editing another teacher's homework post", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      const coTeacherId = await createUser(tx, f.schoolId, "teacher");
      await assignTeacher(tx, f, coTeacherId, f.section1A);
      const id = await insertHomework(tx, { schoolId: f.schoolId, sectionId: f.section1A, createdBy: f.teacherId }, f.today);

      await tx.query(coTeacherId, "update public.homework set subject = 'Changed' where id = $1", [id]);
      const [row] = await tx.query<{ subject: string }>("system", "select subject from public.homework where id = $1", [id]);
      expect(row.subject).not.toBe("Changed");
    }));

  it("blocks office staff from editing homework (view-only)", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      const officeId = await createUser(tx, f.schoolId, "office");
      const id = await insertHomework(tx, { schoolId: f.schoolId, sectionId: f.section1A, createdBy: f.adminId }, f.today);

      await tx.query(officeId, "update public.homework set subject = 'Changed' where id = $1", [id]);
      const [row] = await tx.query<{ subject: string }>("system", "select subject from public.homework where id = $1", [id]);
      expect(row.subject).not.toBe("Changed");
    }));

  it("blocks an admin from editing homework in another school", () =>
    withTx(async (tx) => {
      const a = await createSchool(tx);
      const b = await createSchool(tx);
      const id = await insertHomework(tx, { schoolId: b.schoolId, sectionId: b.section1A, createdBy: b.adminId }, b.today);

      await tx.query(a.adminId, "update public.homework set subject = 'Changed' where id = $1", [id]);
      const [row] = await tx.query<{ subject: string }>("system", "select subject from public.homework where id = $1", [id]);
      expect(row.subject).not.toBe("Changed");
    }));

  it("lets only an admin delete homework -- not the teacher-author, not office", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      const officeId = await createUser(tx, f.schoolId, "office");
      const teacherOwnId = await insertHomework(tx, { schoolId: f.schoolId, sectionId: f.section1A, createdBy: f.teacherId }, f.today);

      await tx.query(f.teacherId, "delete from public.homework where id = $1", [teacherOwnId]);
      await tx.query(officeId, "delete from public.homework where id = $1", [teacherOwnId]);
      expect(await tx.query("system", "select id from public.homework where id = $1", [teacherOwnId])).toHaveLength(1);

      await tx.query(f.adminId, "delete from public.homework where id = $1", [teacherOwnId]);
      expect(await tx.query("system", "select id from public.homework where id = $1", [teacherOwnId])).toHaveLength(0);
    }));
});
