import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/types/database";

// Calls the real Supabase Data API the way a malicious signed-in user could,
// bypassing the app's UI and server code entirely. Needs a local stack with
// the dev users (`supabase start`, then scripts/seed-dev-users.mjs).
// Skipped when SUPABASE_API_TEST_URL is not set.

const url = process.env.SUPABASE_API_TEST_URL;
const anonKey = process.env.SUPABASE_API_TEST_ANON_KEY ?? "";
const PASSWORD = "dev-password-123";

type Client = SupabaseClient<Database>;

function client(): Client {
  return createClient<Database>(url!, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function signedIn(email: string): Promise<Client> {
  const c = client();
  const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`Sign-in failed for ${email}: ${error.message}`);
  return c;
}

describe.skipIf(!url)("direct Data API access", () => {
  let anon: Client;
  let teacher: Client;
  let disabled: Client;
  let admin: Client;
  let teacherId: string;
  let class2SectionId: string;

  beforeAll(async () => {
    anon = client();
    teacher = await signedIn("teacher1@example.test");
    admin = await signedIn("admin@example.test");
    // A disabled user can still hold a valid Supabase session; RLS must ignore it.
    disabled = await signedIn("disabled@example.test");
    teacherId = (await teacher.auth.getUser()).data.user!.id;
    const { data } = await admin.from("sections").select("id, classes!inner(name)").eq("classes.name", "Class 2");
    class2SectionId = data![0].id;
  });

  afterAll(async () => {
    await Promise.all([teacher, admin, disabled].map((c) => c.auth.signOut()));
  });

  it("returns nothing to anonymous visitors", async () => {
    for (const table of ["students", "profiles", "schools", "attendance_records"] as const) {
      const { data, error } = await anon.from(table).select("*");
      expect(error?.code === "42501" || data?.length === 0).toBe(true);
    }
  });

  it("does not let anyone sign up publicly", async () => {
    const { error } = await anon.auth.signUp({
      email: `intruder-${Date.now()}@example.test`,
      password: "x-password-123",
    });
    expect(error).not.toBeNull();
  });

  it("limits a teacher to students in assigned sections", async () => {
    const { data } = await teacher.from("students").select("id, section_id, sections!inner(name, classes!inner(name))");
    expect(new Set(data!.map((s) => s.sections.classes.name))).toEqual(new Set(["Class 1"]));

    // Exactly the students an admin sees in the teacher's sections: no more, no fewer.
    const { data: assigned } = await teacher.from("teacher_assignments").select("section_id");
    const { data: expected } = await admin
      .from("students")
      .select("id")
      .in(
        "section_id",
        assigned!.map((a) => a.section_id),
      );
    expect(data!.map((s) => s.id).sort()).toEqual(expected!.map((s) => s.id).sort());
    expect(data!.length).toBeGreaterThan(0);
  });

  it("ignores a filter that asks for another section", async () => {
    const { data } = await teacher.from("students").select("id").eq("section_id", class2SectionId);
    expect(data).toEqual([]);
  });

  it("gives a disabled account no data", async () => {
    const { data } = await disabled.from("students").select("id");
    expect(data).toEqual([]);
    const { error } = await disabled.rpc("open_attendance_session", {
      p_section_id: class2SectionId,
      p_date: new Date().toISOString().slice(0, 10),
    });
    expect(error?.code).toBe("42501");
  });

  it("blocks a teacher from writing students", async () => {
    const { data: sections } = await teacher.from("teacher_assignments").select("section_id");
    const { data: classRow } = await teacher
      .from("sections")
      .select("class_id, school_id")
      .eq("id", sections![0].section_id)
      .single();
    const { error } = await teacher.from("students").insert({
      school_id: classRow!.school_id,
      class_id: classRow!.class_id,
      section_id: sections![0].section_id,
      admission_no: `HACK-${Date.now()}`,
      full_name: "Should Not Exist",
    });
    expect(error?.code).toBe("42501");

    const { data: updated } = await teacher
      .from("students")
      .update({ full_name: "Changed" })
      .not("id", "is", null)
      .select("id");
    expect(updated).toEqual([]);
  });

  it("blocks a teacher from promoting themselves", async () => {
    const { data } = await teacher.from("profiles").update({ role: "admin" }).eq("id", teacherId).select("role");
    expect(data).toEqual([]);
    const { data: me } = await teacher.from("profiles").select("role").eq("id", teacherId).single();
    expect(me!.role).toBe("teacher");
  });

  it("blocks a teacher from assigning themselves to another section", async () => {
    const { data: section } = await admin
      .from("sections")
      .select("school_id, academic_year_id")
      .eq("id", class2SectionId)
      .single();
    const { error } = await teacher.from("teacher_assignments").insert({
      teacher_id: teacherId,
      section_id: class2SectionId,
      school_id: section!.school_id,
      academic_year_id: section!.academic_year_id,
    });
    expect(error?.code).toBe("42501");
  });

  it("blocks a teacher from taking attendance for another section", async () => {
    const { error } = await teacher.rpc("open_attendance_session", {
      p_section_id: class2SectionId,
      p_date: new Date().toISOString().slice(0, 10),
    });
    expect(error?.code).toBe("42501");
  });

  it("blocks direct writes to attendance and audit tables, even for admins", async () => {
    const { error: attendance } = await admin.from("attendance_records").delete().not("id", "is", null);
    expect(attendance?.code).toBe("42501");
    const { error: audit } = await admin.from("audit_logs").delete().not("id", "is", null);
    expect(audit?.code).toBe("42501");
  });

  it("hides the other teachers' profiles from a teacher", async () => {
    const { data } = await teacher.from("profiles").select("id");
    expect(data!.map((p) => p.id)).toEqual([teacherId]);
  });
});
