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

- **Done (all on `main`, live):** Weeks 1–4 — foundation, auth/permissions, students, staff/assignments, attendance (roster, draft/submit, corrections, lock, history), reports, WhatsApp notification system (**off by default**; modes off/test/live), QA, backup rehearsal, handover docs, production setup guide, Settings → Classes & academic year, (2026-10-31) the school logo, icons/share card, real address (PIN 844506), phone numbers and Google Map, and (2026-11-01) bilingual notices (`src/content/notices.ts`), gallery with real school photos (`src/content/gallery.ts`, `src/assets/gallery/`), email, news strip (`AnnouncementBar`), admissions-soon panel, and a UI/UX pass (focus ring, skip link, 404/error/loading states, active nav, motion with reduced-motion support).
- **Next change request:** year-end student promotion into the next year's classes (see `docs/handover/known-issues.md`).
- **Live:** https://uttamniketan.vercel.app (Vercel project `uttam_niketan`, team `aksundram44-9592s-projects`; pushes to `main` deploy to production). Staff login there needs the hosted database set up.
- **Next:** school demo and acceptance; WhatsApp go-live only after the checklist in `docs/whatsapp-templates.md`. Post-MVP items are change requests (`docs/handover/known-issues.md`).
- **Waiting on the owner:** hosted database setup per `docs/handover/setup-guide.md` (5 migrations, school setup SQL, sign-ups off, principal account) and `CRON_SECRET` in Vercel.
- **Waiting on the school:** content/logo/address, class & section names, attendance correction rules, late/excused usage and the 75% threshold, required student fields, whether teachers need guardian phones, Hindi staff UI, CSV import, email vs phone login for teachers.

## ▶️ Resume here (as of 2026-11-02)

**Waiting to merge:** branch `school-identity` (pushed, not on `main`; these notes live on it too).
It shows the school identity the owner asked for in the header, home hero and footer, EN + HI:
"Uttam Niketan / Deshrajpur, Mahnar, Vaishali – 844506 / Class NC to 8" (`meta.place`,
`meta.classRange` in dictionaries; PIN via `SchoolPlace` + `schoolPin` in `src/lib/school.ts`).
Merge (fast-forward) when the owner says so.

Open questions for the owner: should "Classes we offer: Nursery, LKG, UKG and Classes 1 to 8" become
"Class NC to 8"; a Hindi word for "NC" (kept as "NC"). Small fixes offered but not yet done: one
shared public button style, pending state on the language switch, Chhath notice shown three times on
the home page, "Nursery to Class 8" left in the meta description and Academics intro, prettier on
`eslint.config.mjs` / `next.config.ts`. Owner should check the Contact-page map pin on a phone.

Live on `main` (2026-11-01): Chhath Puja notice (EN+HI, home highlight until 16 Nov), gallery with
the school's 5 real photos, news strip with "admissions opening soon", admissions-soon panel,
school email, logo in its own shape, UI/UX pass. Routine content changes follow the
`site-content` skill.

1. **Ask the owner:** guardian permission for photos showing children's faces (roadmap §16); the
   sharper Gemini logo as an attached file (its checkerboard background is baked in and needs
   cutting out, plus the sparkle watermark bottom-right); photo dates/caption corrections.
2. **Small audit leftovers (anti-slop audit 2026-11-01):** one shared public button component (hero
   CTA is gold `bg-accent`, others maroon `bg-brand`); pending state on the language switch; the
   Chhath notice shows three times on the home page; `rounded-[2rem]` no longer used (fixed).
3. **Finish CR-002 website colour themes.** Done: migration `20261031000100_website_theme.sql`
   (`schools.website_theme`, public `website_theme()`), types, `src/lib/themes.ts` (5 themes),
   `tests/unit/themes.test.ts`. To do: admin Settings → "Website colours" (server action with
   `requireAdmin` + `isThemeKey`, `revalidatePath("/", "layout")`); apply in root layout via
   `themeStyle()` on `<html style>` (cookie-less anon client + `unstable_cache`, fall back to
   `DEFAULT_THEME`); DB + API tests; roadmap change-request entry; browser check. The hero now
   uses `drop-shadow`; themes change `--brand`/`--accent` only.
4. Hosted database setup (5 migrations) is still waiting on the owner; then the year-end promotion
   change request; content from the principal's checklist (`docs/school/content-checklist.pdf`).

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
- `package.json` pins `engines.node` to `22.x`: an open range let Vercel build on Node 26, where `next/font` Google Fonts fails.
- Images pasted into chat sometimes arrive only as pictures, not files (nothing in the session `images/` folder); ask the owner to attach them again.
- Public site content that is real school data lives in `src/i18n/dictionaries.ts` (text) and `src/lib/school.ts` (phones, map links); the logo source is `src/assets/logo.png`, shown via `SchoolLogo`; icons are `src/app/icon.png`, `apple-icon.png`, `favicon.ico`, `opengraph-image.jpg`.
- The container cannot reach google.com, so the Contact-page map iframe renders blank in local screenshots; that is expected.
- After pushing to `main`, check with Vercel `list_deployments`/`list_deployment_events` until READY (builds can sit QUEUED for a minute); `web_fetch_vercel_url` on the production alias is unreliable.
- Supabase reports "User is banned" even with a wrong password, so login must keep one generic error message.
- Run the Docker `pg_dump`/`pg_restore` inside `supabase_db_uttam_niketan` (PG 17); the host has PG 16 tools.
- In Playwright, scope selectors: header "Sign out" is also a submit button, and headings often sit inside a wrapper `div` (no `h2 + p` sibling).
- After a successful `useActionState` submit React resets the form; echo `values` + bump `attempt` (form `key`) to keep input on errors (done generically in `settings/classes/inline-form.tsx`).
- Use `useId()` for input ids in reusable form components; label-derived ids collide when the form repeats on a page.
- A shell `kill`/`pkill` pattern that also appears in the same command line kills your own shell; stop servers with `ps -eo pid,args | awk '$2 ~ /^next-server/ {print $1}' | xargs -r kill` as its own command.
