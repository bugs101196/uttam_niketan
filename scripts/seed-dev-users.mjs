#!/usr/bin/env node
// LOCAL DEVELOPMENT ONLY. Creates fictional staff accounts with a known
// password for manual and browser testing, and assigns teachers to sections
// from supabase/seed.sql. Refuses to run against a non-local Supabase.
//
//   node --env-file=.env.local scripts/seed-dev-users.mjs

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const host = (() => {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
})();
if (!["127.0.0.1", "localhost"].includes(host) || !serviceKey) {
  console.error("Refusing to run: this script only targets a local Supabase (127.0.0.1/localhost).");
  process.exit(1);
}

export const DEV_PASSWORD = "dev-password-123";
const SCHOOL_ID = "00000000-0000-4000-8000-000000000001";
const YEAR_ID = "00000000-0000-4000-8000-000000000101";

const users = [
  { email: "admin@example.test", name: "Asha Admin", role: "admin" },
  { email: "teacher1@example.test", name: "Ravi Teacher", role: "teacher", sections: ["Class 1"] },
  { email: "teacher2@example.test", name: "Meena Teacher", role: "teacher", sections: ["Class 2", "Class 3"] },
  { email: "disabled@example.test", name: "Former Teacher", role: "teacher", sections: ["Class 1"], active: false },
];

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const { data: sections, error: sectionsError } = await supabase
  .from("sections")
  .select("id, name, classes(name)")
  .eq("school_id", SCHOOL_ID);
if (sectionsError) throw sectionsError;

const { data: existing } = await supabase.auth.admin.listUsers({ perPage: 200 });

for (const user of users) {
  let id = existing?.users.find((u) => u.email === user.email)?.id;
  if (!id) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: DEV_PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
    id = data.user.id;
  }

  const { error: profileError } = await supabase.from("profiles").upsert({
    id,
    school_id: SCHOOL_ID,
    full_name: user.name,
    role: user.role,
    is_active: user.active ?? true,
  });
  if (profileError) throw profileError;

  for (const className of user.sections ?? []) {
    const section = sections.find((s) => s.classes?.name === className && s.name === "A");
    const { error } = await supabase
      .from("teacher_assignments")
      .upsert(
        { school_id: SCHOOL_ID, teacher_id: id, section_id: section.id, academic_year_id: YEAR_ID },
        { onConflict: "teacher_id,section_id,academic_year_id", ignoreDuplicates: true },
      );
    if (error) throw error;
  }
  console.log(`${user.email} (${user.role}${user.active === false ? ", disabled" : ""})`);
}

console.log(`Password for all dev users: ${DEV_PASSWORD}`);
