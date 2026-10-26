import { randomUUID } from "node:crypto";
import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { inject } from "vitest";

const pool = new Pool({ connectionString: inject("databaseUrl") });

export async function closePool() {
  await pool.end();
}

type Actor = string | "anon" | "system";

export interface DbError {
  code: string;
  message: string;
}

/**
 * One transaction per test, rolled back at the end, so tests never see each
 * other's data. Each query runs as a chosen actor:
 *   - "system": the migration owner, bypasses RLS (fixtures only)
 *   - "anon": an unauthenticated visitor
 *   - a user id: an authenticated Supabase user with that id
 */
export class Tx {
  constructor(private readonly client: PoolClient) {}

  private async become(actor: Actor) {
    await this.client.query("reset role");
    const sub = actor === "anon" || actor === "system" ? "" : actor;
    await this.client.query("select set_config('request.jwt.claim.sub', $1, true)", [sub]);
    if (actor === "anon") await this.client.query("set role anon");
    else if (actor !== "system") await this.client.query("set role authenticated");
  }

  async query<T extends QueryResultRow = QueryResultRow>(actor: Actor, sql: string, params: unknown[] = []) {
    await this.become(actor);
    try {
      return (await this.client.query<T>(sql, params)).rows;
    } finally {
      await this.client.query("reset role");
    }
  }

  /** Runs a statement that must fail and returns the database error. */
  async fails(actor: Actor, sql: string, params: unknown[] = []): Promise<DbError> {
    await this.client.query("savepoint expect_failure");
    try {
      await this.become(actor);
      await this.client.query(sql, params);
    } catch (error) {
      await this.client.query("rollback to savepoint expect_failure");
      await this.client.query("reset role");
      const { code, message } = error as DbError;
      return { code, message };
    }
    await this.client.query("rollback to savepoint expect_failure");
    throw new Error(`Expected statement to fail but it succeeded: ${sql}`);
  }
}

export async function withTx(fn: (tx: Tx) => Promise<void>) {
  const client = await pool.connect();
  await client.query("begin");
  try {
    await fn(new Tx(client));
  } finally {
    await client.query("rollback");
    client.release();
  }
}

export interface SchoolFixture {
  schoolId: string;
  yearId: string;
  class1Id: string;
  class2Id: string;
  section1A: string;
  section1B: string;
  section2A: string;
  adminId: string;
  teacherId: string; // assigned to 1A
  otherTeacherId: string; // assigned to nothing
  inactiveTeacherId: string; // assigned to 1A but disabled
  students1A: string[];
  students1B: string[];
  today: string;
}

async function createUser(tx: Tx, schoolId: string, role: "admin" | "teacher", isActive = true) {
  const id = randomUUID();
  await tx.query("system", "insert into auth.users (id, email) values ($1, $2)", [id, `${id}@example.test`]);
  await tx.query(
    "system",
    "insert into public.profiles (id, school_id, full_name, role, is_active) values ($1, $2, $3, $4, $5)",
    [id, schoolId, `Test ${role}`, role, isActive],
  );
  return id;
}

async function createStudent(tx: Tx, f: { schoolId: string; classId: string; sectionId: string }, roll: number) {
  const [row] = await tx.query<{ id: string }>(
    "system",
    `insert into public.students (school_id, admission_no, full_name, class_id, section_id, roll_no)
     values ($1, $2, $3, $4, $5, $6) returning id`,
    [f.schoolId, `ADM-${randomUUID().slice(0, 8)}`, `Student ${roll}`, f.classId, f.sectionId, roll],
  );
  return row.id;
}

/** A school with an active year, two classes, three sections, staff and students. */
export async function createSchool(tx: Tx): Promise<SchoolFixture> {
  const [{ today }] = await tx.query<{ today: string }>(
    "system",
    "select to_char((now() at time zone 'Asia/Kolkata')::date, 'YYYY-MM-DD') as today",
  );
  const [{ id: schoolId }] = await tx.query<{ id: string }>(
    "system",
    "insert into public.schools (name) values ('Fixture School') returning id",
  );
  const [{ id: yearId }] = await tx.query<{ id: string }>(
    "system",
    `insert into public.academic_years (school_id, name, start_date, end_date, is_active)
     values ($1, 'Current', $2::date - 200, $2::date + 165, true) returning id`,
    [schoolId, today],
  );
  const mkClass = async (name: string, order: number) =>
    (
      await tx.query<{ id: string }>(
        "system",
        "insert into public.classes (school_id, academic_year_id, name, sort_order) values ($1, $2, $3, $4) returning id",
        [schoolId, yearId, name, order],
      )
    )[0].id;
  const mkSection = async (classId: string, name: string) =>
    (
      await tx.query<{ id: string }>(
        "system",
        "insert into public.sections (class_id, school_id, academic_year_id, name) values ($1, $2, $3, $4) returning id",
        [classId, schoolId, yearId, name],
      )
    )[0].id;

  const class1Id = await mkClass("Class 1", 1);
  const class2Id = await mkClass("Class 2", 2);
  const section1A = await mkSection(class1Id, "A");
  const section1B = await mkSection(class1Id, "B");
  const section2A = await mkSection(class2Id, "A");

  const adminId = await createUser(tx, schoolId, "admin");
  const teacherId = await createUser(tx, schoolId, "teacher");
  const otherTeacherId = await createUser(tx, schoolId, "teacher");
  const inactiveTeacherId = await createUser(tx, schoolId, "teacher", false);

  for (const t of [teacherId, inactiveTeacherId]) {
    await tx.query(
      "system",
      "insert into public.teacher_assignments (school_id, teacher_id, section_id, academic_year_id) values ($1, $2, $3, $4)",
      [schoolId, t, section1A, yearId],
    );
  }

  const students1A = [];
  for (const roll of [1, 2, 3]) {
    students1A.push(await createStudent(tx, { schoolId, classId: class1Id, sectionId: section1A }, roll));
  }
  const students1B = [];
  for (const roll of [1, 2]) {
    students1B.push(await createStudent(tx, { schoolId, classId: class1Id, sectionId: section1B }, roll));
  }

  return {
    schoolId,
    yearId,
    class1Id,
    class2Id,
    section1A,
    section1B,
    section2A,
    adminId,
    teacherId,
    otherTeacherId,
    inactiveTeacherId,
    students1A,
    students1B,
    today,
  };
}

export function records(studentIds: string[], status: (i: number) => string = () => "present") {
  return JSON.stringify(studentIds.map((student_id, i) => ({ student_id, status: status(i) })));
}
