#!/usr/bin/env node
// Provisions the first principal/admin account. There is no public sign-up;
// every other account is created by an admin from the Staff page.
//
// Usage (reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY):
//   node --env-file=.env.local scripts/create-admin.mjs --email principal@example.com --name "Principal Name"
// Options:
//   --school-id <uuid>   required only if the database has more than one school
//
// A random temporary password is printed once. Share it privately and ask the
// admin to change it after first login.

import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    name: { type: "string" },
    "school-id": { type: "string" },
  },
});

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

const email = values.email?.trim().toLowerCase();
const fullName = values.name?.trim();
if (!email || !fullName) fail('--email and --name are required, e.g. --email a@b.com --name "Full Name"');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) fail("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

let schoolId = values["school-id"];
if (!schoolId) {
  const { data: schools, error } = await supabase.from("schools").select("id, name");
  if (error) fail(error.message);
  if (schools.length !== 1) {
    fail(`Found ${schools.length} schools; pass --school-id. ${schools.map((s) => `${s.id} (${s.name})`).join(", ")}`);
  }
  schoolId = schools[0].id;
}

const password = randomBytes(12).toString("base64url");
const { data: created, error: createError } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});
if (createError) fail(createError.message);

const { error: profileError } = await supabase
  .from("profiles")
  .insert({ id: created.user.id, school_id: schoolId, full_name: fullName, role: "admin" });
if (profileError) {
  // Do not leave an auth user without a profile behind.
  await supabase.auth.admin.deleteUser(created.user.id);
  fail(profileError.message);
}

console.log(`Admin created: ${email}`);
console.log(`Temporary password (shown once): ${password}`);
