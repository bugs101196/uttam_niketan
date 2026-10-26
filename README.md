# Uttam Niketan

Public website and school management app for Uttam Niketan (Nursery–Class 8, Bihar).

- **Roadmap and source of truth:** [`docs/PROJECT_ROADMAP.md`](docs/PROJECT_ROADMAP.md)
- **Stack:** Next.js App Router + TypeScript, Tailwind CSS, Supabase (PostgreSQL, Auth, RLS), Vercel

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in values; never commit real secrets
npm run dev                  # http://localhost:3000
```

### Local Supabase

```bash
npx supabase start            # Postgres, Auth and the Data API in Docker; applies migrations + seed.sql
npx supabase status           # prints the local URL and keys for .env.local
node --env-file=.env.local scripts/seed-dev-users.mjs   # fictional staff, password dev-password-123
```

Dev users (local only): `admin@example.test`, `teacher1@example.test` (Class 1 – A),
`teacher2@example.test` (Class 2 – A, Class 3 – A) and `disabled@example.test`.
After changing the schema, run `npm run gen:types` to regenerate `src/types/database.ts`.

### Staff accounts

There is no public sign-up (disable "Allow new users to sign up" in the hosted project's
Auth settings too). Create the first principal/admin with:

```bash
node --env-file=.env.local scripts/create-admin.mjs --email principal@school.example --name "Principal Name"
```

It prints a temporary password once. The admin then creates teacher accounts, resets
passwords, disables accounts and assigns sections from the **Staff** page.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run test:unit` | Unit tests |
| `npm run test:db` | Database tests: builds a throwaway database from `supabase/migrations` and checks constraints, RLS and the attendance workflow |
| `npm run test:api` | Attacks the real local Data API as anonymous, teacher, disabled and admin users (needs `SUPABASE_API_TEST_URL` / `_ANON_KEY`; skipped otherwise) |
| `npm run gen:types` | Regenerate database types from the local Supabase |
| `npm run check` | Lint + typecheck + all tests (run before every PR) |

### Database tests

`npm run test:db` needs a PostgreSQL 15+ server you can create databases on. Set
`TEST_DATABASE_ADMIN_URL` (default `postgres://postgres:postgres@127.0.0.1:54322/postgres`,
which matches `supabase start`). `tests/db/supabase-shim.sql` stands in for Supabase's
`auth` schema and API roles; it is for tests only.

## Project layout

```text
src/app/(public)/      Public website (home, about, academics, admissions, notices, gallery, contact)
src/app/(auth)/        Staff login and sign-out actions
src/app/(dashboard)/   Staff app: dashboard, students, staff (admin)
src/app/actions/       Server actions (language switch)
src/middleware.ts      Session refresh + redirect to login for staff pages
src/components/        Layout and form components
src/lib/auth/          requireStaff / requireAdmin and safe redirect helpers
src/lib/supabase/      User (RLS) client and server-only service-role client
src/lib/validation/    Zod schemas shared by forms and server actions
src/services/          Data access for students and staff
src/i18n/              English/Hindi dictionaries and locale helpers
scripts/               Admin provisioning and local dev user seeding
supabase/migrations/   Versioned SQL migrations (schema, RLS, attendance functions)
supabase/seed.sql      Fictional development data
tests/db/              Database integrity, RLS and attendance tests
tests/api/             Direct Data API security tests against a running Supabase
tests/unit/            Unit tests
docs/                  Project roadmap
```

## Database at a glance

- Every table has RLS. Anonymous visitors can read nothing.
- Admins manage their own school. Teachers see only students and attendance for sections
  they are assigned to in the active academic year.
- Attendance is written only through database functions (`open_attendance_session`,
  `save_attendance_draft`, `submit_attendance_session`, `correct_attendance_record`,
  `lock_attendance_session`), which check permissions, validate the roster and write
  atomically. Submissions are idempotent; corrections are admin-only and audited.

## Data and secrets

Use fictional data only in development, tests, screenshots and issues. Never commit real
student/guardian details, passwords or keys. The Supabase service-role key is server-only.
