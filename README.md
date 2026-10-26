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

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run test:unit` | Unit tests |
| `npm run test:db` | Database tests: builds a throwaway database from `supabase/migrations` and checks constraints, RLS and the attendance workflow |
| `npm run check` | Lint + typecheck + all tests (run before every PR) |

### Database tests

`npm run test:db` needs a PostgreSQL 15+ server you can create databases on. Set
`TEST_DATABASE_ADMIN_URL` (default `postgres://postgres:postgres@127.0.0.1:54322/postgres`,
which matches `supabase start`). `tests/db/supabase-shim.sql` stands in for Supabase's
`auth` schema and API roles; it is for tests only.

## Project layout

```text
src/app/(public)/      Public website (home, about, academics, admissions, notices, gallery, contact)
src/app/actions/       Server actions (language switch)
src/components/layout/ Header, footer, language switch, shared page shells
src/i18n/              English/Hindi dictionaries and locale helpers
supabase/migrations/   Versioned SQL migrations (schema, RLS, attendance functions)
supabase/seed.sql      Fictional development data
tests/db/              Database integrity, RLS and attendance tests
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
