# Uttam Niketan — notes for Claude

Paid client project: bilingual public website + school management app for Uttam Niketan
(Nursery–Class 8, Bihar). Owner/developer: Ashutosh (GitHub `bugs101196`). Client approver: the principal.

Read `docs/PROJECT_ROADMAP.md` before planning or changing anything; it is the source of truth
for scope, priorities, the working method (Goal → Scope → Implementation → Security → Tests →
Acceptance → Follow-up) and the Definition of Done. Update its status tracker, progress log,
defect register and decision log when milestones change (see the `ship-feature` skill).

## Rules

- Priority order: database integrity → auth/permissions → students → attendance → testing → WhatsApp.
- Never add scope silently; raise a change request (roadmap §24).
- Fictional data only. No secrets in code, docs, commits or chat; `.env.local` is git-ignored.
- Schema changes go in a new file in `supabase/migrations/`; never edit an applied migration. Then `npm run gen:types`.
- Security is enforced server-side (`requireStaff` / `requireAdmin` on every page and action) and by RLS; UI checks are convenience only.
- Use the RLS client (`@/lib/supabase/server`) by default. The service-role client (`@/lib/supabase/admin`) only after `requireAdmin()`, scoped to the admin's school.
- Attendance is written only through the database functions (`open_attendance_session`, `save_attendance_draft`, `submit_attendance_session`, `correct_attendance_record`, `lock_attendance_session`); clients have read-only table access.
- Before committing: `npm run check`; also `npm run test:api` when touching auth/RLS (see the `local-stack` skill).
- Commit or push only when asked; work on a feature branch, merge to `main` when the user says so (fast-forward).

## Status (update when it changes)

- **Done:** Weeks 1–3 on `main`: foundation, auth/permissions, students, staff/assignments, attendance (roster, draft/submit, corrections, lock, history) and reports.
- **Week 4:** WhatsApp notification system (queue, worker, signed webhook, Settings page; **off by default**, modes off/test/live), QA sweep, backup/restore rehearsal and handover docs (`docs/handover/`) on branch `week-4-notifications-handover`.
- **Classes & years:** admin screen `Settings → Classes & academic year` (migration `20261027000100`) on branch `classes-and-years`; year-end student promotion is still a change request.
- **Live:** https://uttamniketan.vercel.app (Vercel project `uttam_niketan`, team `aksundram44-9592s-projects`; pushes to `main` deploy to production). Staff login there needs the hosted database set up.
- **Next:** school demo and acceptance; WhatsApp go-live only after the checklist in `docs/whatsapp-templates.md`. Post-MVP items are change requests (`docs/handover/known-issues.md`).
- **Waiting on the owner:** apply migrations to the hosted Supabase project (Vercel's Supabase integration) and turn off sign-ups there; first real admin via `scripts/create-admin.mjs`; set `CRON_SECRET` in Vercel (see `docs/handover/operations.md`).
- **Waiting on the school:** content/logo/address, class & section names, attendance correction rules, late/excused usage and the 75% threshold, required student fields, whether teachers need guardian phones, Hindi staff UI, CSV import, email vs phone login for teachers.

## Gotchas learned the hard way

- `sections` has no direct relationship to `academic_years`; filter the active year through `classes!inner(academic_years!inner(is_active))`.
- In local `supabase/config.toml`, `[auth] enable_signup = false` blocks sign-up; `[auth.email] enable_signup` must stay `true` or email login is disabled entirely.
- Supabase reports "User is banned" even with a wrong password, so login must keep one generic error message.
- Run the Docker `pg_dump`/`pg_restore` inside `supabase_db_uttam_niketan` (PG 17); the host has PG 16 tools.
- In Playwright, scope selectors: header "Sign out" is also a submit button, and headings often sit inside a wrapper `div` (no `h2 + p` sibling).
- After a successful `useActionState` submit React resets the form; echo `values` + bump `attempt` (form `key`) to keep input on errors.
