import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

// Builds a throwaway database from the real migration files before the
// database tests run. Point TEST_DATABASE_ADMIN_URL at any PostgreSQL 15+
// server you can create databases on (e.g. the one `supabase start` runs).
const ADMIN_URL = process.env.TEST_DATABASE_ADMIN_URL ?? "postgres://postgres:postgres@127.0.0.1:54322/postgres";
const TEST_DB = process.env.TEST_DATABASE_NAME ?? "uttam_niketan_test";

const root = path.resolve(__dirname, "../..");

async function sqlFiles(): Promise<string[]> {
  const dir = path.join(root, "supabase/migrations");
  const names = (await readdir(dir)).filter((n) => n.endsWith(".sql")).sort();
  return [path.join(root, "tests/db/supabase-shim.sql"), ...names.map((n) => path.join(dir, n))];
}

export default async function setup(project: TestProject) {
  const admin = new Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${TEST_DB} with (force)`);
  await admin.query(`create database ${TEST_DB}`);
  await admin.end();

  const url = new URL(ADMIN_URL);
  url.pathname = `/${TEST_DB}`;
  const db = new Client({ connectionString: url.toString() });
  await db.connect();
  try {
    for (const file of await sqlFiles()) {
      try {
        await db.query(await readFile(file, "utf8"));
      } catch (error) {
        throw new Error(`Failed applying ${path.relative(root, file)}: ${(error as Error).message}`);
      }
    }
  } finally {
    await db.end();
  }

  project.provide("databaseUrl", url.toString());
}
