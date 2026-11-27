# Uttam Niketan — Project Audit (Executive Summary)

**Date:** 2026-11-27
**Scope:** Read-only audit of the existing codebase, database, security posture, UX and technical debt, ahead of continuing the School Management ERP build. **No application code, database schema, or production configuration was changed to produce this audit.**
**Repo audited:** GitHub `bugs101196/uttam_niketan` (public), local clone `~/Desktop/uttam-niketan`, branch `main` at commit `b5a78a9`.
**Companion documents:** [`EXISTING_FEATURES.md`](./EXISTING_FEATURES.md) · [`DATABASE_AUDIT.md`](./DATABASE_AUDIT.md) · [`SECURITY_AUDIT.md`](./SECURITY_AUDIT.md) · [`TECHNICAL_DEBT.md`](./TECHNICAL_DEBT.md) · [`DEVELOPMENT_ROADMAP.md`](./DEVELOPMENT_ROADMAP.md)

**Relationship to prior audits:** This project already has two internal audit-style documents — [`docs/ERP_TECHNICAL_AUDIT.md`](./ERP_TECHNICAL_AUDIT.md) (2026-11-17) and [`docs/ERP_ARCHITECTURE.md`](./ERP_ARCHITECTURE.md) (2026-11-17, design doc). Both are still useful background, but **both predate most of what now exists**: at the time they were written, parent login, homework, fees, reports and fee reminders were all still proposals. This audit re-verifies everything directly against the current code and reports the project's real, current state — it does not take the earlier documents' claims on faith (per this task's own instruction not to assume a feature exists merely because its UI or a doc describes it).

---

## 0. Headline finding: this is not a greenfield ERP build

The brief that prompted this audit describes a school website that needs to be "extended" into an ERP. **That describes the project's state ten months ago, not today.** The repository already contains a largely-built, RLS-secured, tested School Management ERP covering attendance, student/staff management, a parent portal, homework, and a fee/invoicing ledger. Seven "phases" of ERP work (per the project's own `docs/ERP_ARCHITECTURE.md` §18 sequencing) have shipped and merged to `main`, plus one more feature (fee reminders) in progress. The only genuinely unbuilt major piece is **online payment gateway integration** (architecture's own "Phase 6"), which is explicitly blocked on the owner picking a provider.

**Do not treat this as a blank slate.** The highest-value audit finding is procedural, not technical: every planning document in this repo (`PROJECT_ROADMAP.md`, `known-issues.md`) **drifts out of date faster than the code ships**, and this has already caused two documented incidents (§4 below) where completed work sat unrecorded for days. Any new work should re-verify the roadmap's status tracker against `git log`/`gh pr list` before trusting it, exactly as this audit did.

---

## 1. Codebase audit at a glance

| # | Area | Finding |
|---|---|---|
| 1 | Project structure | Clean Next.js App Router layout: `(public)`, `(auth)`, `(dashboard)`, `(parent)` route groups; `lib/`, `services/`, `types/`, `supabase/migrations/`, `tests/{unit,db,api}/`. Matches the structure its own `CLAUDE.md`/roadmap describe. Full tree in [`EXISTING_FEATURES.md`](./EXISTING_FEATURES.md) §0. |
| 2 | Frontend architecture | Next.js 15.5.28 (App Router), React 19.1.0, TypeScript 5 (`strict: true`), Tailwind CSS 4. No component library — hand-built, accessible components. Server Components by default; client components only where interactivity requires it (attendance roster, forms). |
| 3 | Backend implementation | Next.js Server Actions + three Route Handlers (`/api/cron/notifications`, `/api/cron/fee-reminders`, `/api/webhooks/whatsapp`). No separate backend service. Business logic for every multi-step/financial write lives in **Postgres `SECURITY DEFINER` functions**, not in application code — see [`DATABASE_AUDIT.md`](./DATABASE_AUDIT.md). |
| 4 | Database configuration | Supabase (Postgres), 14 migrations, 2 schemas (`public`, `private`). `supabase/config.toml` present for local emulation; `supabase/.temp/project-ref` confirms this clone is linked to the live project. See [`DATABASE_AUDIT.md`](./DATABASE_AUDIT.md). |
| 5 | Supabase integration | `@supabase/supabase-js` 2.118, `@supabase/ssr` 0.12.7. Two client factories: `lib/supabase/server.ts` (RLS-bound, default) and `lib/supabase/admin.ts` (service-role, explicitly commented "BYPASSES RLS", used only after `requireAdmin()`). |
| 6 | Authentication | Two independent identity flows sharing one `auth.users` pool: staff (email/password, `lib/auth/staff.ts`) and parent (phone/OTP, `lib/auth/guardian.ts`). No public self-registration for staff; parents verify their own phone but are linked to a child only by an admin. See [`SECURITY_AUDIT.md`](./SECURITY_AUDIT.md) §2. |
| 7 | API routes / server actions | No public REST API surface beyond the 3 route handlers above (all either cron-secret-gated or webhook-signature-gated). All data mutation goes through Server Actions, each starting with `requireStaff()`/`requireAdmin()`/`requireGuardian()` — **verified directly** by grepping every `(dashboard)`/`(parent)` `page.tsx`/`actions.ts` for the guard call (29 files checked, 29 call a guard; the 2 that don't are the login pages themselves, which is correct). |
| 8 | Existing UI components | `src/components/layout/*` (header, footer, nav, language switch, announcement bar, skip link), `src/components/ui/form.tsx`. Feature UI lives next to its route (`(dashboard)/fees/[studentId]/forms.tsx` etc.) rather than a shared component library — a deliberate, documented convention (`CLAUDE.md`), not an oversight. |
| 9 | Existing website pages | Public: Home, About, Academics, Admissions, Notices, Gallery (+per-photo), Contact — all real content, bilingual EN/HI, not placeholders (verified by reading `src/content/notices.ts`, `src/lib/school.ts`, and the rendered page components, not just the route list). |
| 10 | WhatsApp integration | Full pipeline for **two** queues now: absence alerts (`notification_jobs`) and fee reminders (`fee_reminder_jobs`), both behind `WHATSAPP_MODE=off` (default). HMAC-verified webhook, timing-safe cron auth, idempotent status updates. See [`SECURITY_AUDIT.md`](./SECURITY_AUDIT.md) §4. |
| 11 | Environment variables | `.env.example` lists 15 variables by name only (confirmed no values were read or displayed in this audit). `NEXT_PUBLIC_SUPABASE_URL`/`_ANON_KEY` are intentionally public (RLS-gated); `SUPABASE_SERVICE_ROLE_KEY`, `WHATSAPP_*`, `CRON_SECRET` are server-only and never referenced with `NEXT_PUBLIC_` prefix (grepped, confirmed). |
| 12 | Dependencies and versions | 7 runtime deps, 15 dev deps (full list in [`EXISTING_FEATURES.md`](./EXISTING_FEATURES.md) §0). `engines.node` pinned to `22.x` — deliberately, after an open range once broke a Vercel build on Node 26 (`CLAUDE.md` gotcha). No dependency is unused or abandoned on inspection; see [`TECHNICAL_DEBT.md`](./TECHNICAL_DEBT.md) for the one genuinely orphaned **environment variable** (not a package). |
| 13 | Git history / current branch | Single-branch-per-feature, PR-per-change workflow against `main`. 17 PRs merged to date (`gh pr list`, confirmed live against GitHub). At audit time, `main` was 2 commits behind `origin/main` locally (routine staleness, now fast-forwarded as part of this audit's own setup) and a `feature/fee-reminders` branch carries 2 further commits pushed but **not yet in any PR** — flagged to the owner separately from this audit. |
| 14 | Deployment configuration | Vercel project `uttam_niketan`, auto-deploy on push to `main`, production alias `https://uttamniketan.vercel.app`. `vercel.json` defines 2 cron schedules (notifications 04:30 UTC, fee-reminders 05:00 UTC daily). No `.github/workflows` — **no CI pipeline exists**; `npm run check` is a documented manual pre-merge step only. Flagged as High severity in [`SECURITY_AUDIT.md`](./SECURITY_AUDIT.md). |
| 15 | Existing tests and documentation | 3 Vitest projects (`unit`, `db`, `api`). This audit ran `npm run typecheck`, `npm run lint`, and `npm run test:unit` live: **all pass clean** (79/79 unit tests, zero lint/type errors). `test:db`/`test:api` need a local Postgres/Docker stack not available in this session — **unable to verify directly**, but their presence, line counts and the project's own documented history of running them (`PROJECT_ROADMAP.md` weekly logs) were checked and are consistent. 7 markdown docs under `docs/` plus `docs/handover/*` — thorough, but **the two "status" documents (`PROJECT_ROADMAP.md` §20, `handover/known-issues.md`) are both stale** (see §4 below). |

---

## 2. What "complete" means in this audit

Per this task's own instruction, a feature is only called **Completed** below if this audit found: the database schema/RLS/function enforcing it, the server-side page/action calling the right guard, and (where one exists) an automated test exercising it. A feature with only a UI, or only a migration, is marked **Partially implemented**. See the full module-by-module breakdown in [`EXISTING_FEATURES.md`](./EXISTING_FEATURES.md).

**One-paragraph summary:** Public website, student/staff/class management, the attendance engine, and homework are genuinely complete and tested. Parent login + read-only dashboard, the fee ledger (cash only), and fee reports are built and merged but each carry one specific, named verification gap (parent OTP has never been tested against a real SMS provider; two of the fee module's RLS branches have no automated test; a reversal of an *online* payment would currently fail a check constraint that has simply never been exercised). Online payment gateway integration does not exist at all — by design, pending a provider decision.

---

## 3. Phase 4 — Design and UX audit (summary)

Full detail lives in [`EXISTING_FEATURES.md`](./EXISTING_FEATURES.md) §UX, since UX quality is really a property of each module rather than a separate layer here. Headline points:

- **Visual design / brand identity:** consistent Tailwind-based design system (`--brand`/`--accent` CSS variables, 5 selectable website themes via `src/lib/themes.ts`), no competing component library — nothing here should be replaced to build the ERP further.
- **Navigation:** role-filtered (`dashboard-nav.tsx` only renders links a role can use), separate staff vs. parent login entry points, consistent with the separate-identity-space design.
- **Mobile responsiveness:** verified by this project's own prior axe/Playwright passes (documented in `PROJECT_ROADMAP.md`'s weekly logs: "23 pages × 4 widths, no horizontal overflow"); this audit did not re-run a browser check (no UI change to verify), so this is **carried forward from the project's own test evidence, not independently re-verified today**.
- **Parent usability:** mobile-first by explicit design intent (`ERP_ARCHITECTURE.md` §12); dashboard, attendance, fees, homework, notices all exist as read-mostly views with a child switcher.
- **Loading/empty/error states:** `error.tsx`/`loading.tsx`/`not-found.tsx` present per route group; forms preserve user input on validation failure (a fix captured as a `CLAUDE.md` gotcha after an earlier defect, BUG-005).
- **Accessibility:** zero axe WCAG2 A/AA violations as of the last documented audit pass (2026-10-26); skip-link, focus rings, and reduced-motion support are in place.
- **Needs improvement (not a defect, a gap):** the admin dashboard (`(dashboard)/dashboard/page.tsx`) still shows only students/sections/teachers/today's-attendance — the architecture doc's own suggestion to add fee-collection and homework summary cards (§4.B) was never implemented when those modules shipped. Staff app remains English-only by design (known-issues #6, pending school decision). No dedicated "Admissions" screen exists in the dashboard (public `/admissions` page only) — an explicitly unresolved question from the architecture doc (§17 Q6), not a defect.

---

## 4. Documentation drift — a recurring, self-inflicted risk

This is worth calling out at the top level because it has already happened **three times** on this exact project:

1. 2026-11-18: Phases 1-2 (`office` role, `guardians` schema) were built and merged in an earlier session but never recorded in `PROJECT_ROADMAP.md` — caught by a routine `git branch --no-merged main` check, not by the roadmap itself.
2. 2026-11-24 → 2026-11-26: Phase 7 (fee reports, PR #14) was merged but `PROJECT_ROADMAP.md`'s own status tracker still showed it unchecked two days later (fixed in PR #16).
3. Today (2026-11-27): `docs/handover/known-issues.md` is still dated 2026-10-26 and lists CSV import, Hindi staff UI, etc. as open — all still accurate, but it has **no entry at all** for anything from Phases 1-7 or fee reminders (parent OTP untested in production, the two fee-module RLS test gaps, the reversal check-constraint issue found in this audit). It is not wrong, just silently incomplete.

**Recommendation:** treat `docs/PROJECT_ROADMAP.md` §20/§21/§23 and `docs/handover/known-issues.md` as requiring an update in the *same PR* as any merged feature from now on, not as a follow-up task — this project's own `CLAUDE.md` already says this, and it keeps not happening.

---

## 5. What to read next

- Building or extending a specific module → [`EXISTING_FEATURES.md`](./EXISTING_FEATURES.md) for exactly what exists and what's missing.
- Evaluating data integrity / schema design → [`DATABASE_AUDIT.md`](./DATABASE_AUDIT.md).
- Evaluating what could go wrong in production → [`SECURITY_AUDIT.md`](./SECURITY_AUDIT.md).
- Deciding what to fix before adding more scope → [`TECHNICAL_DEBT.md`](./TECHNICAL_DEBT.md).
- Planning the next phase of work → [`DEVELOPMENT_ROADMAP.md`](./DEVELOPMENT_ROADMAP.md).

This audit made no changes to application code, database schema, Vercel configuration, or any secret value. It read the local repository clone, ran `npm run typecheck`/`lint`/`test:unit` (no DB/network side effects), queried `git log`/`gh pr list` against GitHub, and read file contents only — no Supabase CLI query, migration, or write of any kind was executed against the live database.
