# Uttam Niketan — ERP Technical Audit

**Date:** 2026-11-17
**Scope:** Read-only technical audit of the existing codebase and infrastructure before extending the system into a full School Management ERP. No application code, database schema, or production configuration was changed as part of this audit.

---

## 0. Critical finding — two divergent codebases exist under this project name

Before the stack/architecture review, this needs to be flagged because it changes the starting point of the whole engagement:

| | Local scaffold | Actual live project |
|---|---|---|
| Location | `~/Desktop/uttam-niketan` (this machine) | GitHub `bugs101196/uttam_niketan` (public repo), not present on this machine until this audit cloned it to a scratch folder |
| Git remote | **None** — never pushed, despite its own `PROJECT_ROADMAP.md` decision log claiming it was pushed to a GitHub repo `bugs101196/uttam-niketan` (hyphen) | Real, active, pushed to `main`, last push 2026-11-02 |
| Stack versions | Next.js 16.4.3, React 19.3.0 | Next.js 15.5.28, React 19.1.0 |
| Content | Every page is a literal "Placeholder — pending school-approved content" shell (`PlaceholderPage` component). No Supabase client code, no migrations, no API routes, no auth logic. | Full auth, RLS, attendance engine, staff/student management, WhatsApp notifications, bilingual public site with real school content, 5 applied-in-SQL migrations, ~130 automated tests, handover docs |
| Deployed to `https://uttamniketan.vercel.app`? | No | **Yes** — this is what the Vercel project `uttam_niketan` actually serves |

**What this means:** the "current project context" in this audit's brief (early-stage scaffold, Supabase "already connected" in the generic sense, website needing to be "extended" into an ERP) describes the stale local folder, not reality. The real project — built across prior **claude.ai web sessions** (commit authors show `Claude Opus 5.5`, with session links), not this local Claude Code CLI — is already a substantial, mostly-complete School Management ERP. It is not a blank slate to extend; it is a near-finished Weeks 1–4 build (per its own roadmap) with one missing piece: the **live Supabase database has env vars wired up but the schema migrations have never been applied to it**, so staff login does not yet work on the public URL.

All findings below are about the **real project** (`bugs101196/uttam_niketan`), inspected via a fresh read-only clone, plus the Vercel project's deployment history and (key names only, no values) environment variables, since no Supabase MCP/CLI connection was available in this session to query the live database directly.

**Recommendation before anything else:** confirm with the project owner (1) which codebase is authoritative — everything below assumes it is `bugs101196/uttam_niketan` — and (2) whether the stale `~/Desktop/uttam-niketan` folder can be archived/deleted to avoid future confusion. Do not build on the local scaffold.

---

## 1. Current technology stack

| Layer | Technology | Notes |
|---|---|---|
| Framework | Next.js 15.5.28, App Router | `engines.node` pinned to `22.x` — an open range previously broke Google Fonts on Vercel's Node 26 |
| Language | TypeScript 5, `strict: true` | |
| UI | React 19.1.0, Tailwind CSS 4 (`@tailwindcss/postcss`) | No component library (shadcn/MUI etc.) — hand-built accessible components |
| Validation | Zod 4 | Request/form validation, paired with DB constraints |
| Database | Supabase (PostgreSQL), accessed via `@supabase/supabase-js` 2.118 and `@supabase/ssr` 0.12.7 | |
| Auth | Supabase Auth (email/password), no self-service sign-up | |
| Messaging | WhatsApp Business Cloud API (direct `fetch`, no SDK) | Modes: `off` / `test` / `live`, currently `off` |
| Hosting | Vercel, project `uttam_niketan` (team `aksundram44-9592s-projects`) | Production alias `uttamniketan.vercel.app`; pushes to `main` auto-deploy to production |
| Scheduled jobs | Vercel Cron → `/api/cron/notifications`, daily at 04:30 UTC | Hobby-plan limit (1 run/day); real-time sends happen inline after attendance submit, this is a safety-net retry |
| Testing | Vitest (3 projects: `unit`, `db`, `api`), Playwright + `@axe-core/playwright` for accessibility checks | ~130 test cases across unit/db/api; DB tests need a local Postgres 15+/Supabase stack, not run in this audit |
| Tooling | ESLint 9, Prettier 3, `tsc --noEmit`, `npm run check` (lint+typecheck+test) | |
| Repo | GitHub `bugs101196/uttam_niketan`, public, single `main` branch at audit time | No CI workflow file found (`.github/workflows` absent) — checks run manually via `npm run check` |

---

## 2. Existing folder structure

```
uttam_niketan/
├── src/
│   ├── app/
│   │   ├── (public)/          # Home, About, Academics, Admissions, Notices, Gallery[+photo], Contact
│   │   ├── (auth)/login/      # Staff login (form + server action)
│   │   ├── (dashboard)/       # Protected app: dashboard, students, attendance, staff, settings, reports
│   │   ├── api/cron/notifications/   # Vercel Cron target (Bearer CRON_SECRET)
│   │   ├── api/webhooks/whatsapp/    # Meta Cloud API status webhook
│   │   ├── auth/signout/      # Route handler
│   │   ├── actions/locale.ts  # Server action for language switch
│   │   ├── middleware.ts      # Session refresh + redirect-to-login convenience gate
│   │   ├── sitemap.ts / robots.ts / not-found.tsx / layout.tsx
│   ├── components/layout/     # Header, footer, nav, language switch, announcement bar, skip link, logo
│   ├── content/                # notices.ts, gallery.ts — EN/HI content as typed data, not hardcoded JSX
│   ├── i18n/                   # config.ts, dictionaries.ts (EN/HI strings), server.ts
│   ├── lib/
│   │   ├── auth/staff.ts       # getStaff / requireStaff / requireAdmin
│   │   ├── auth/paths.ts       # protected-path matcher + open-redirect-safe "next" resolver
│   │   ├── supabase/server.ts  # RLS-bound client (default)
│   │   ├── supabase/admin.ts   # service-role client (admin-gated, explicitly documented as RLS-bypassing)
│   │   ├── whatsapp/           # client, config, webhook signature verification, worker
│   │   ├── validation/         # Zod schemas: student, staff, classes
│   │   ├── attendance.ts, attendance-status.ts, dates.ts, db-errors.ts, env.ts, school.ts, themes.ts
│   ├── services/                # attendance.ts, classes.ts, staff.ts, students.ts — query/mutation layer above raw Supabase calls
│   ├── types/database.ts        # Generated from the live schema (`npm run gen:types`)
│   └── assets/                  # Logo, real gallery photos
├── supabase/
│   ├── migrations/               # 5 timestamped SQL files (see §3)
│   ├── setup/                    # 01-school.sql, 02-principal-profile.sql (one-time production bootstrap)
│   ├── config.toml, seed.sql
├── tests/
│   ├── unit/   (attendance, classes, dictionaries, gallery, notices, themes, validation, whatsapp)
│   ├── db/     (academic-years, attendance, notifications, rls, schema — against a real Postgres)
│   └── api/    (direct-api.test.ts — attacks the Supabase Data API directly, bypassing the UI)
├── docs/
│   ├── PROJECT_ROADMAP.md        # Source-of-truth plan, status tracker, defect register, decision log
│   ├── whatsapp-templates.md
│   ├── school/content-checklist.pdf/html
│   └── handover/ (admin-guide, teacher-guide, setup-guide, operations, known-issues)
├── scripts/ (create-admin.mjs, seed-dev-users.mjs)
├── CLAUDE.md                     # Working rules + live status + "gotchas learned the hard way"
└── vercel.json                   # cron schedule only
```

This already matches — closely, in naming and intent — the "suggested project structure" in the roadmap's own architecture section. Route groups cleanly separate public, auth, and dashboard concerns; `lib/`, `services/`, and `types/` are populated, not stubs.

---

## 3. Supabase architecture

No live-database inspection was possible in this session (no Supabase MCP/CLI connection, no local Docker stack running). Everything below is from the migration SQL in the repo plus the Vercel project's environment-variable **names** (values were not displayed).

### Connection state

- Vercel's **native Supabase integration** provisioned a project and wired `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, plus raw Postgres connection vars — all present in Vercel's **Production** environment. So the connection exists.
- `CRON_SECRET` is **not** in the production environment variable list. The notification cron route fails closed without it (see §6), and the handover docs independently confirm it hasn't been added yet.
- Per `docs/handover/known-issues.md` (#1 and #11) and `docs/handover/setup-guide.md`: the 5 migrations, the `supabase/setup/*.sql` bootstrap (school + 11 classes/sections), disabling public sign-up, and creating the principal's account have **not been run against the hosted database yet**. Staff login on the live site is expected not to work until that's done. This is a pending owner action, not a code defect.
- No **preview** environment variables exist, so preview deployments show "staff login not set up" by design (documented, accepted).

### Schema (from `supabase/migrations/`, applied order)

| Migration | Adds |
|---|---|
| `20261026000100_core_schema.sql` | Tables: `schools`, `profiles`, `academic_years`, `classes`, `sections`, `students`, `teacher_assignments`, `attendance_sessions`, `attendance_records`, `audit_logs`. Helper functions: `set_updated_at`, `check_teacher_assignment_role`, `prevent_audit_log_change` (append-only guard). |
| `20261026000200_auth_rls_attendance.sql` | **RLS enabled on 10 tables, 20 policies.** Security-definer helpers (`private.current_school_id`, `private.is_admin`, `private.is_assigned_to_section`, `private.can_take_attendance`), a trigger (`protect_profile_fields`) preventing self-escalation, and the transactional attendance functions: `open_attendance_session`, `save_attendance_draft`, `submit_attendance_session`, `correct_attendance_record`, `lock_attendance_session`. |
| `20261026000300_absence_notifications.sql` | `notification_jobs` table (RLS on, 1 policy), dedupe-key function, `enqueue_absence_notification`/`cancel_absence_notification`, worker-facing `claim_notification_jobs`/`complete_notification_job`/`apply_whatsapp_status`. Extends `submit_attendance_session` and `correct_attendance_record` to queue/cancel jobs atomically with the attendance write. |
| `20261027000100_academic_year_management.sql` | `set_active_academic_year`, `copy_class_structure` (year rollover support). |
| `20261031000100_website_theme.sql` | `schools.website_theme` column + public `website_theme()` function (cosmetic, unrelated to ERP data). |

This is a real, deliberate schema — UUID PKs, explicit status enums, uniqueness constraints (admission number per school, one session per section/date, one record per session/student), and attendance writes routed exclusively through `SECURITY DEFINER` functions rather than raw table writes from the client. That last point matters: it means the attendance invariants the roadmap specifies (no duplicate submissions, atomic job creation, audit trail) are enforced in the database, not just hoped for in application code.

### Storage, triggers, functions beyond the above

- No Supabase Storage buckets referenced in code — gallery photos are committed as static assets (`src/assets/gallery/`), not uploaded via Storage. Reasonable for the current photo volume; will need revisiting if the school wants self-service photo uploads.
- `prevent_audit_log_change` and `protect_profile_fields` are the only triggers found; both are integrity guards (block UPDATE/DELETE on audit logs, block a user from changing their own role/school/active flag).

### Row Level Security — design as written

- Every exposed table has explicit per-role policies (admin vs. teacher), not a blanket "authenticated" policy.
- Teacher access to a section is derived from a `teacher_assignments` row, not from a client-supplied section ID — matches the roadmap's explicit requirement.
- One documented gap (project's own `known-issues.md` #5): teachers can read guardian phone columns via the Supabase Data API directly (the UI just doesn't show them). Flagged by the project itself as "data minimisation, not an access breach" — worth a column-level policy or a `SECURITY INVOKER` view if the school's privacy stance requires it.

---

## 4. Existing functionality

### Public website (bilingual EN/HI)

Home, About, Academics, Admissions, Notices, Gallery (+ per-photo pages), Contact — all live with real school content (name, Mahnar/Vaishali address with PIN 844506, phone numbers, email, logo), not placeholders. Includes: language switch (cookie-backed, server action), news/announcement strip, admissions-soon banner, sitemap.ts/robots.ts, OG image, skip-link and focus-ring accessibility pass, reduced-motion support, 404/error/loading states.

### Staff application (behind auth)

- **Dashboard** — overview/landing.
- **Students** — list/search, create, detail/edit, attendance history per student, status badges, enrolment status.
- **Staff** — create teacher/admin accounts (via service-role `auth.admin.createUser`, temporary password shown once), teacher-to-section assignment management.
- **Attendance** — roster entry, session detail, roster editor, correction form, session status badge, draft → submit → lock lifecycle, all backed by the DB functions in §3.
- **Reports** — attendance reporting page.
- **Settings** — school settings, classes & academic-year management (CRUD with inline forms), a "run queue" button (manually trigger the notification worker).

### WhatsApp notifications (built, intentionally **off**)

Full pipeline exists: job enqueue on absence (atomic with attendance submission), dedupe key, Cloud API client, webhook with HMAC signature verification (`x-hub-signature-256`) and a separate subscription-handshake GET, idempotent status application via RPC, a cron safety-net route protected by a timing-safe `CRON_SECRET` comparison. `WHATSAPP_MODE=off` by default — nothing sends until the school's Meta Business setup and template approval are done (tracked in `docs/whatsapp-templates.md`).

### Not yet built / explicitly out of scope per the roadmap

CSV import/export, year-end student promotion UI (DB functions exist, no screen), fees, exams/report cards, homework, payroll, transport, a parent-facing login/portal, native mobile apps, offline attendance sync, Hindi UI for the staff app (public site only).

---

## 5. Reusable components

| Target ERP module | What already exists and is reusable |
|---|---|
| Admin dashboard | `requireAdmin()` gate, `(dashboard)/settings` pattern (inline CRUD forms, server actions, `revalidatePath`), `dashboard-nav.tsx`, error/loading boundaries |
| Teacher dashboard | `requireStaff()` + role check pattern, section-scoped queries already proven in attendance/students services |
| Parent dashboard | **Nothing exists today** — no parent identity, login, or data-scoping model. This is new, not an extension (see §8) |
| Student management | `services/students.ts`, `lib/validation/student.ts`, `student-form.tsx`, status badges, attendance-history view — directly reusable for any ERP student module |
| Attendance | The entire transactional engine (§3) plus roster editor UI and correction workflow — this is already a complete, tested attendance module |
| Fee management | Nothing exists. `schools`/`students`/`academic_years` tables give a foundation to hang a `fee_structures`/`invoices`/`payments` schema off of, following the same RLS + `SECURITY DEFINER` function pattern already established |
| Notices/announcements | `src/content/notices.ts` (typed, bilingual) + `notice-card.tsx` + `AnnouncementBar` — currently static/content-as-code, not DB-backed or admin-editable. Would need a `notices` table + admin CRUD to become dynamic (the roadmap already anticipated this: "Admin controls for publishing/unpublishing notices... if time permits") |
| Auth/authorization scaffold | `lib/auth/staff.ts`, `lib/auth/paths.ts`, `middleware.ts`, the RLS/function pattern in the migrations — this is the piece every new ERP module should plug into rather than reinvent |
| i18n | `src/i18n/*` + `src/content/*` pattern for bilingual content — reusable for any new bilingual screen |

---

## 6. Security assessment

**Overall: notably better than typical early-stage builds.** Server-side authorization is enforced consistently (`requireStaff`/`requireAdmin` at the top of every protected page and action, not just hidden UI), RLS backs it up at the database layer, and the two places that need extra care — the service-role client and webhook/cron endpoints — are deliberately isolated and documented.

**Strengths observed directly in code:**
- `middleware.ts` uses `supabase.auth.getUser()` (which revalidates the token with Supabase Auth) rather than trusting `getSession()` — a common real-world mistake, correctly avoided here.
- The service-role client (`lib/supabase/admin.ts`) is isolated in one file, carries an explicit "BYPASSES RLS, only after `requireAdmin()`" comment, and every call site I inspected (`staff/actions.ts`) does call `requireAdmin()` first and scopes to the admin's own school.
- `protect_profile_fields` trigger blocks a user from elevating their own role/school/active-status even if a client request tried to.
- Student creation derives `class_id`/`school_id` from the server-verified section, never trusts the client for these.
- WhatsApp webhook verifies HMAC-SHA256 signatures before parsing; the cron route does a **timing-safe** `Bearer` token comparison and **fails closed** if `CRON_SECRET` is unset — the right default.
- `safeNextPath()` explicitly blocks open-redirect via a crafted `?next=` login parameter (checks for `//`, backslashes, and that the target is actually a protected path).
- ~130 automated tests include a dedicated `tests/api/direct-api.test.ts` that attacks the Supabase Data API directly (bypassing the app's own UI/action layer) — this is exactly the kind of test the roadmap's security baseline calls for ("test direct API/SQL access as well as UI behavior") and it's actually present, not just planned.

**Gaps / things to verify before go-live:**
1. **Hosted DB migrations not yet applied** (§3) — until this is done, there is no functioning auth boundary on the live site at all, because there's no `profiles` table to check against. This is the single blocking item.
2. **No CI pipeline** — `npm run check` (lint + typecheck + test) is a documented manual step, not enforced on push/PR. Nothing stops a future change from merging to `main` (which auto-deploys to production) without it being run.
3. **Guardian phone columns readable by teachers via the raw Data API** (known-issues #5, self-reported) — low severity as scoped (data minimization, not a cross-tenant/role breach), but worth closing with a column-level policy before any ERP module exposes more guardian PII (fees, portal).
4. **No branch protection / review gate observed** on `main` (single-branch repo, direct pushes deploy to production per `vercel.json`/project settings). Fine for a solo-developer project at this stage; worth revisiting once more contributors or an ERP's higher-stakes modules (fees, parent portal) are added.
5. **`SUPABASE_JWT_SECRET` present in env but not referenced anywhere in `src/`** — appears to be an unused artifact of the Vercel integration's default provisioning, not a code risk, but worth pruning if confirmed unused.
6. Public gallery photos: the project's own resume notes flag that guardian permission for photos showing children's faces has **not yet been confirmed** with the school — a privacy/consent gap, not a code gap, but relevant to any ERP feature that surfaces more student data publicly.

No evidence of the client-trusted-pricing or unauthenticated-write classes of flaw seen in other audits of this user's projects (e.g. the Crevita Foods order pipeline) — this codebase's authorization model is materially more mature.

---

## 7. Technical risks

| Risk | Impact on ERP extension | Mitigation |
|---|---|---|
| Two divergent codebases under the same project name (§0) | Building against the wrong one wastes effort and risks shipping a regression to the placeholder scaffold instead of the live app | Confirm `bugs101196/uttam_niketan` is canonical; archive/delete the local stale folder |
| Hosted Supabase migrations unapplied | Nothing in the staff app — including any new ERP module — can be verified against the real production database until this is done | Run `docs/handover/setup-guide.md` end-to-end before any new feature work targets production |
| No parent/guardian identity model exists at all | "Parent dashboard" in the ERP brief is new ground-up work, not an extension of an existing role | Design parent auth (likely phone/OTP, not email/password given the audience) and a strict RLS scoping to a guardian's own children before any UI work |
| Fees/exams/payroll have zero schema or screens today | Each is a full new module, not a gap-fill | Scope and sequence as separate change requests per the roadmap's own §24 process; do not let "ERP" scope creep into one undifferentiated effort |
| No CI enforcement on `main` | A future change (by this session or another) could regress auth/RLS behavior without the existing 130 tests ever running | Add a GitHub Actions workflow running `npm run check` (+ `test:db`/`test:api` against an ephemeral Postgres) on PRs before merging ERP work |
| Single admin-owner operational model (Vercel/GitHub/Supabase all under one personal account, `CLAUDE.md` names one owner + one approver) | Fine at current scale; a multi-role ERP (fees handled by an accountant role, say) will outgrow a two-role admin/teacher model | Re-examine the role model (§8) before adding modules that need more than admin/teacher |
| WhatsApp cron is daily-only on Vercel's Hobby plan | Acceptable today (real-time send is inline; cron is just retry safety-net) but will not scale to time-sensitive ERP notifications (fee due dates, exam alerts) without a paid plan or a different queue | Revisit hosting tier if/when notification volume or urgency grows with new modules |
| Public repo | Fine today (no secrets committed; `.env.local` git-ignored, verified) — but as an ERP with more sensitive logic lands, consider whether a public repo is still the right call | School/owner decision, not a code issue |

---

## 8. Proposed ERP architecture

The existing codebase already implements the **Admin** and **Teacher** sides of the ERP almost completely (students, attendance, staff, reports, settings). The architecture work that remains is almost entirely about adding a third role — **Parent/Guardian** — without disturbing what's live, plus the modules explicitly deferred so far (notices-as-data, fees, year-end promotion).

### Routing

Keep the existing route-group separation; add one new group rather than touching the existing ones:

```
src/app/
├── (public)/        # unchanged — public marketing site
├── (auth)/           # extend: add /login/parent (separate from staff /login) or a mode switch on one form
├── (dashboard)/      # unchanged — staff app (admin + teacher)
└── (guardian)/        # NEW — parent/guardian portal, e.g. /portal, /portal/attendance, /portal/notices
```

Rationale for a **separate route group and a separate Supabase Auth identity space** for guardians, rather than reusing `profiles`:
- `profiles` today is staff-only (`role: admin | teacher`) with RLS written around that assumption (`private.is_admin`, `private.is_assigned_to_section`). Overloading it with a `parent` role risks subtle RLS mistakes in policies not written with a parent's much narrower data needs in mind.
- A guardian's authorization question is fundamentally different: "which specific `students.id` rows is this person the guardian of," not "which section is this teacher assigned to." That's a new join table (`guardian_links` or similar: `guardian_user_id`, `student_id`), not a reuse of `teacher_assignments`.
- Keeping it a separate identity space means a bug in the new, less-tested guardian code path cannot accidentally widen staff access, and vice versa.

### Authentication strategy

- **Staff (admin/teacher):** unchanged — Supabase Auth email/password, no self-service sign-up, `requireStaff`/`requireAdmin`.
- **Parent/guardian:** recommend **phone-number OTP** over email/password — matches the audience (guardians in Bihar are far more likely to have a reliable phone than a checked email, and the WhatsApp integration already has verified phone numbers on file). Supabase Auth supports phone OTP directly; this avoids building a parallel auth system. If WhatsApp OTP delivery is wanted instead of SMS, that's a separate integration decision, not a blocker.
- Either way: same non-negotiable from `CLAUDE.md` — "security is enforced server-side... UI checks are convenience only" — applies to the new role exactly as it does to staff today.

### Authorization approach

- New `role` value `guardian` is **not** added to `profiles.role` (which is staff-only by the current schema's own design intent). Instead: a separate `guardians` table (own auth user id, contact info) + `guardian_students` link table, with its own RLS policies (`private.is_guardian_of(student_id)`-style helper, mirroring the existing `private.is_assigned_to_section` pattern).
- Guardian-facing reads should go through narrow views or functions (e.g., `guardian_student_attendance_summary()`), not direct table grants — avoids repeating the "readable-but-hidden" column gap already flagged for teachers (§6.3).
- All guardian writes (if any — e.g., acknowledging a notice) go through `SECURITY DEFINER` functions, consistent with how attendance writes work today. Keep client table access read-only, as the existing `CLAUDE.md` rule already states for attendance.

### Sequencing within the existing repo

Each new ERP module should land as its own migration file (never editing an applied one — already the house rule in `CLAUDE.md`) and its own route subtree, following the same Goal → Scope → Implementation → Security → Tests → Acceptance pattern the roadmap already mandates. Given the architecture above, a representative migration sequence would be: `guardians` + `guardian_students` + RLS → notices-as-table (if the admin-editable notices feature is wanted) → fees schema → year-end promotion screen (the DB functions already exist; only the UI is missing).

---

## 9. Recommended implementation sequence

1. **Resolve the two-codebase situation.** Get explicit confirmation that `bugs101196/uttam_niketan` is the project to build on; archive the stale `~/Desktop/uttam-niketan` folder so no one (human or agent) edits it by mistake in a future session.
2. **Finish what's already started, not new ERP work first.** Run the 5-migration + bootstrap + principal-account setup (`docs/handover/setup-guide.md`) against the live Supabase project. Nothing below can be verified end-to-end on production until this is done — and it's a 20-minute, no-terminal task the owner can do independently.
3. **Add CI** (`npm run check` + `test:db`/`test:api` on an ephemeral Postgres) on pull requests, before adding ERP surface area that raises the cost of a regression slipping through.
4. **Close the two self-identified, low-effort security/privacy gaps** while the codebase is still small: the teacher-readable guardian-phone column (§6.3), and getting the school's explicit sign-off on identifiable child photos in the public gallery (§6.6).
5. **Design the guardian/parent data model and RLS** (§8) as its own change request, reviewed before any UI is built — this is new ground, not a tweak to existing policies, and is the highest-risk piece of the ERP extension from a data-privacy standpoint (it's the first time a non-staff person gets any system access to student data).
6. **Build the parent portal incrementally**, narrowest slice first: read-only attendance view for a guardian's own children, before notices, before anything else — it reuses the most already-tested code (the attendance engine) and has the clearest, simplest RLS shape to validate.
7. **Only then** take up the modules with no existing foundation at all (fees, year-end promotion UI, admin-editable notices) as separately scoped change requests, in the order the school actually needs them — not all at once.
8. Throughout: keep following this repo's own `CLAUDE.md` working rules (migrations are additive-only, service-role client stays admin-gated and school-scoped, attendance-style writes go through `SECURITY DEFINER` functions, update `docs/PROJECT_ROADMAP.md`'s status tracker/decision log as each step lands) — they are well-chosen and already proven across four weeks of real work on this project.

---

*This audit made no changes to application code, database schema, Vercel configuration, or any secret values. It read: the local `~/Desktop/uttam-niketan` folder, a fresh read-only clone of `bugs101196/uttam_niketan` (public GitHub repo) into a scratch directory, the live site's rendered HTML, and Vercel project/deployment/environment-variable **metadata** (no secret values were requested or displayed) via the Vercel MCP connector.*
