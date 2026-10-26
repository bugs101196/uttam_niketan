import { afterAll, describe, expect, it } from "vitest";
import { closePool, createSchool, withTx, type SchoolFixture, type Tx } from "./helpers";

afterAll(closePool);

async function addYear(tx: Tx, f: SchoolFixture, name = "Next year") {
  const [{ id }] = await tx.query<{ id: string }>(
    f.adminId,
    `insert into public.academic_years (school_id, name, start_date, end_date)
     values ($1, $2, '2030-04-01', '2031-03-31') returning id`,
    [f.schoolId, name],
  );
  return id;
}

const activeYears = (tx: Tx, schoolId: string) =>
  tx.query<{ id: string }>("system", "select id from public.academic_years where school_id = $1 and is_active", [
    schoolId,
  ]);

describe("switching the active academic year", () => {
  it("activates the chosen year and deactivates the old one in one step", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      const next = await addYear(tx, f);
      await tx.query(f.adminId, "select public.set_active_academic_year($1)", [next]);
      expect((await activeYears(tx, f.schoolId)).map((y) => y.id)).toEqual([next]);

      const [log] = await tx.query<{ action: string }>(
        "system",
        "select action from public.audit_logs where entity_id = $1",
        [next],
      );
      expect(log.action).toBe("academic_year.activated");
    }));

  it("is idempotent when the year is already active", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      await tx.query(f.adminId, "select public.set_active_academic_year($1)", [f.yearId]);
      expect((await activeYears(tx, f.schoolId)).map((y) => y.id)).toEqual([f.yearId]);
    }));

  it("refuses teachers and admins of other schools", () =>
    withTx(async (tx) => {
      const a = await createSchool(tx);
      const b = await createSchool(tx);
      const next = await addYear(tx, a);
      const call = "select public.set_active_academic_year($1)";
      expect((await tx.fails(a.teacherId, call, [next])).code).toBe("42501");
      expect((await tx.fails(b.adminId, call, [next])).code).toBe("42501");
      expect((await tx.fails("anon", call, [next])).code).toBe("42501");
      expect((await activeYears(tx, a.schoolId)).map((y) => y.id)).toEqual([a.yearId]);
    }));
});

describe("copying the class structure into a new year", () => {
  it("copies every class and section, without students", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      const next = await addYear(tx, f);
      const [{ copied }] = await tx.query<{ copied: number }>(
        f.adminId,
        "select public.copy_class_structure($1, $2) as copied",
        [f.yearId, next],
      );
      expect(copied).toBe(3);

      const structure = await tx.query<{ label: string }>(
        "system",
        `select c.name || ' ' || s.name as label from public.sections s join public.classes c on c.id = s.class_id
         where s.academic_year_id = $1 order by 1`,
        [next],
      );
      expect(structure.map((r) => r.label)).toEqual(["Class 1 A", "Class 1 B", "Class 2 A"]);
      const [{ n }] = await tx.query<{ n: number }>(
        "system",
        `select count(*)::int as n from public.students st join public.sections s on s.id = st.section_id
         where s.academic_year_id = $1`,
        [next],
      );
      expect(n).toBe(0);
    }));

  it("refuses a target year that already has classes, and the same year", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      const next = await addYear(tx, f);
      const copy = "select public.copy_class_structure($1, $2)";
      await tx.query(f.adminId, copy, [f.yearId, next]);
      expect((await tx.fails(f.adminId, copy, [f.yearId, next])).code).toBe("55000");
      expect((await tx.fails(f.adminId, copy, [f.yearId, f.yearId])).code).toBe("22023");
    }));

  it("refuses teachers and copying across schools", () =>
    withTx(async (tx) => {
      const a = await createSchool(tx);
      const b = await createSchool(tx);
      const next = await addYear(tx, a);
      const copy = "select public.copy_class_structure($1, $2)";
      expect((await tx.fails(a.teacherId, copy, [a.yearId, next])).code).toBe("42501");
      expect((await tx.fails(b.adminId, copy, [a.yearId, next])).code).toBe("42501");
      expect((await tx.fails(a.adminId, copy, [b.yearId, next])).code).toBe("42501");
    }));
});

describe("editing classes and sections", () => {
  it("lets an admin rename, but not to a duplicate name in the same year", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      await tx.query(f.adminId, "update public.classes set name = 'Class One' where id = $1", [f.class1Id]);
      const error = await tx.fails(f.adminId, "update public.classes set name = 'class 2' where id = $1", [f.class1Id]);
      expect(error.code).toBe("23505");
    }));

  it("refuses to delete a section that has students, or a class that has sections", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      expect((await tx.fails(f.adminId, "delete from public.sections where id = $1", [f.section1A])).code).toBe(
        "23503",
      );
      expect((await tx.fails(f.adminId, "delete from public.classes where id = $1", [f.class1Id])).code).toBe("23503");
    }));

  it("refuses to delete a section that still has a teacher assigned", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      await tx.query(
        "system",
        "update public.students set section_id = $1, roll_no = roll_no + 10 where section_id = $2",
        [f.section1B, f.section1A],
      );
      expect((await tx.fails(f.adminId, "delete from public.sections where id = $1", [f.section1A])).code).toBe(
        "23503",
      );
    }));

  it("lets an admin delete an empty section and class", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      await tx.query(f.adminId, "delete from public.sections where id = $1", [f.section2A]);
      await tx.query(f.adminId, "delete from public.classes where id = $1", [f.class2Id]);
      const [{ n }] = await tx.query<{ n: number }>(
        "system",
        "select count(*)::int as n from public.classes where id = $1",
        [f.class2Id],
      );
      expect(n).toBe(0);
    }));

  it("does not let a teacher change classes or sections", () =>
    withTx(async (tx) => {
      const f = await createSchool(tx);
      await tx.query(f.teacherId, "update public.classes set name = 'Hacked' where id = $1", [f.class1Id]);
      await tx.query(f.teacherId, "delete from public.sections where id = $1", [f.section2A]);
      const [row] = await tx.query<{ name: string; sections: number }>(
        "system",
        "select c.name, (select count(*)::int from public.sections where id = $2) as sections from public.classes c where c.id = $1",
        [f.class1Id, f.section2A],
      );
      expect(row).toEqual({ name: "Class 1", sections: 1 });
    }));
});
