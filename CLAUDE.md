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

- **Done (all on `main`, live):** Weeks 1–4 — foundation, auth/permissions, students, staff/assignments, attendance (roster, draft/submit, corrections, lock, history), reports, WhatsApp notification system (**off by default**; modes off/test/live), QA, backup rehearsal, handover docs, production setup guide, Settings → Classes & academic year, and (2026-10-31) the school logo, icons/share card, real address (PIN 844506), phone numbers and Google Map.
- **Next change request:** year-end student promotion into the next year's classes (see `docs/handover/known-issues.md`).
- **Live:** https://uttamniketan.vercel.app (Vercel project `uttam_niketan`, team `aksundram44-9592s-projects`; pushes to `main` deploy to production). Staff login there needs the hosted database set up.
- **Next:** school demo and acceptance; WhatsApp go-live only after the checklist in `docs/whatsapp-templates.md`. Post-MVP items are change requests (`docs/handover/known-issues.md`).
- **Waiting on the owner:** hosted database setup per `docs/handover/setup-guide.md` (5 migrations, school setup SQL, sign-ups off, principal account) and `CRON_SECRET` in Vercel.
- **Waiting on the school:** content/logo/address, class & section names, attendance correction rules, late/excused usage and the 75% threshold, required student fields, whether teachers need guardian phones, Hindi staff UI, CSV import, email vs phone login for teachers.

## ▶️ Resume here (as of 2026-10-31)

0. **Finish CR-002 website colour themes** (owner asked for it). Done: migration
   `20261031000100_website_theme.sql` (`schools.website_theme`, public `website_theme()`), types,
   `src/lib/themes.ts` (5 themes) and `tests/unit/themes.test.ts` (WCAG contrast). To do: admin
   Settings → "Website colours" (radio swatches, server action with `requireAdmin` + `isThemeKey`,
   update own school, `revalidatePath("/", "layout")`); apply in root layout via `themeStyle()` on
   `<html style>` (read with a cookie-less anon client + `unstable_cache`, fall back to
   `DEFAULT_THEME` if Supabase is not configured or errors); themeColor in `generateViewport`;
   DB test (check constraint, anon can call `website_theme()`, teacher cannot update); API test;
   roadmap change-request + decision log entries; browser check.
   Also done 2026-10-31 (live on main): logo everywhere + icons + share card, address with PIN
   844506, phones 90979 77171 / 83407 55682, Google Map + directions on Contact,
   `docs/school/content-checklist.pdf` for the principal (waiting for answers).
   `docs/school/content-checklist.html` needs `prettier --write`.

## Earlier resume notes (2026-10-27)

1. Ask whether the owner finished `docs/handover/setup-guide.md` (hosted Supabase: 5 migrations in the SQL
   Editor, `supabase/setup/01-school.sql`, sign-ups off, principal via Authentication → Users +
   `02-principal-profile.sql`, `CRON_SECRET` in Vercel + redeploy). Help with any error they paste.
2. Once set up, verify the live staff flow at https://uttamniketan.vercel.app/login (principal → Staff →
   teacher → Students → attendance → Reports). Vercel tools can check deployments/runtime errors; the
   container cannot open `vercel.app` directly (proxy), use `web_fetch_vercel_url`.
3. Then: year-end promotion change request (move students into next year's sections), school content,
   WhatsApp go-live checklist, school demo.

Cloud containers restart between sessions: start Docker and local Supabase with the `local-stack` skill
before running `test:db`/`test:api` or the app.

## Gotchas learned the hard way

- `sections` has no direct relationship to `academic_years`; filter the active year through `classes!inner(academic_years!inner(is_active))`.
- In local `supabase/config.toml`, `[auth] enable_signup = false` blocks sign-up; `[auth.email] enable_signup` must stay `true` or email login is disabled entirely.
- Public site content that is real school data lives in `src/i18n/dictionaries.ts` (text) and `src/lib/school.ts` (phones, map links); the logo source is `src/assets/logo.png`, shown via `SchoolLogo`; icons are `src/app/icon.png`, `apple-icon.png`, `favicon.ico`, `opengraph-image.jpg`.
- The container cannot reach google.com, so the Contact-page map iframe renders blank in local screenshots; that is expected.
- After pushing to `main`, check with Vercel `list_deployments`/`list_deployment_events` until READY (builds can sit QUEUED for a minute); `web_fetch_vercel_url` on the production alias is unreliable.
- Supabase reports "User is banned" even with a wrong password, so login must keep one generic error message.
- Run the Docker `pg_dump`/`pg_restore` inside `supabase_db_uttam_niketan` (PG 17); the host has PG 16 tools.
- In Playwright, scope selectors: header "Sign out" is also a submit button, and headings often sit inside a wrapper `div` (no `h2 + p` sibling).
- After a successful `useActionState` submit React resets the form; echo `values` + bump `attempt` (form `key`) to keep input on errors (done generically in `settings/classes/inline-form.tsx`).
- Use `useId()` for input ids in reusable form components; label-derived ids collide when the form repeats on a page.
- A shell `kill`/`pkill` pattern that also appears in the same command line kills your own shell; stop servers with `ps -eo pid,args | awk '$2 ~ /^next-server/ {print $1}' | xargs -r kill` as its own command.
