# Uttam Niketan — Security Audit

**Date:** 2026-11-27 · Read-only. No production configuration, secret value, or database state was changed, queried, or displayed to produce this document. Severities use the project's own defect scale from `docs/PROJECT_ROADMAP.md` §12 (P0 Critical / P1 High / P2 Medium / P3 Low), applied here to security findings specifically.

---

## 1. Overall assessment

**Materially better than a typical project at this stage.** Every privileged page/action this audit checked calls a server-side guard before touching data (29/29 `(dashboard)`/`(parent)` `page.tsx`/`actions.ts` files checked — see `PROJECT_AUDIT.md` §1 row 7), RLS backs every one of those checks at the database layer, and every financial or multi-step write goes through an audited `SECURITY DEFINER` function rather than a raw client table write. The two genuinely dangerous code paths — the service-role client and webhook/cron endpoints — are isolated into single files with explicit comments, and this audit found both are used correctly everywhere they're called.

No instance was found of the client-trusted-pricing or unauthenticated-write classes of flaw this user's other projects (e.g. Crevita Foods) have previously shown. This codebase's authorization model is consistently more mature.

---

## 2. Authentication

- **Staff:** Supabase Auth email/password, no self-service sign-up. `middleware.ts` calls `supabase.auth.getUser()` (which revalidates against Supabase Auth), **not** `getSession()` (which only reads the local cookie's claims without revalidating) — the right, and commonly-missed, choice. Confirmed directly in the code, not assumed.
- **Parent:** Phone + OTP via Supabase's native phone-auth (`signInWithOtp`/`verifyOtp`), sharing the same `auth.users` pool as staff but a disjoint identity table (`guardians`, never `profiles`). A guardian account is never self-service-linked to a child — only an admin can create that link (`guardian_students`), closing the specific risk of a wrong/stale `guardian_phone` value silently granting portal access to the wrong person.
- **P2 — Parent OTP delivery has never been tested end-to-end with a real SMS provider.** The project's own decision log says so explicitly (§17 open question, still open). This is an operational-readiness gap, not a code defect — the Supabase-side integration is standard — but it means the entire parent-login code path is currently **unverified against a real OTP send**, only against Supabase's local/test bypass. Resolve before telling the school parents can log in.
- **P2 — Public sign-up status on the *hosted* Supabase project could not be confirmed in this session.** The local `supabase/config.toml`'s `[auth.email] enable_signup = true` only governs local emulation (per this project's own established finding that production auth settings live on the remote project, not in this file). Two different project documents disagree on whether this is resolved: `CLAUDE.md` (last touched 2026-11-01) says it's still "waiting on the owner"; `ERP_ARCHITECTURE.md` (2026-11-17) says it was done. **Verify directly in the Supabase dashboard before relying on either claim** — if sign-up is still open on the hosted project, anyone could create an `auth.users` row (though without a `profiles`/`guardians` row they'd get no access via `requireStaff`/`requireGuardian`, which both treat "no profile row" as signed-out/inactive — so the blast radius is limited, but it's still an unnecessary open door).

## 3. Authorization (RLS + server-side)

- **Server-side enforcement is universal and was verified by direct inspection**, not sampling: every `(dashboard)` and `(parent)` page/action calls `requireStaff()`, `requireAdmin()`, or `requireGuardian()` as its first real statement. Client-side UI hiding (role-filtered nav) is correctly treated as convenience only.
- **`safeNextPath()`/`safeParentNextPath()`** block open-redirect via a crafted `?next=` parameter (reject `//`, `\`, and anything outside the known protected-prefix list) — present and correctly used by both login flows.
- **P2 — Teacher-readable guardian-contact columns (self-reported in `known-issues.md` #5, re-confirmed by reading the RLS policy directly).** A teacher's `SELECT` grant on `students` is row-scoped (their assigned section only) but not column-scoped — `guardian_phone`/`guardian_name` are returned by a direct Data API query even though the UI never displays them. Low blast radius (same school, same section, no cross-tenant exposure), but worth closing with a column-level policy or view **before** the fee module's guardian contact fields get any broader, since the "narrowest reasonable default" principle this project already applies to office-staff fee visibility should apply here too.
- **P3 — `guardians` table grants `UPDATE` to `authenticated` with no matching RLS `UPDATE` policy for a guardian's own row** (only `guardians_update_admin` exists, scoped to admins). This means a guardian cannot currently update their own `full_name`/`preferred_language` even if a future UI tried to let them — RLS silently denies it. Not a vulnerability (the grant without a policy is strictly *more* restrictive, not less), but worth knowing before building a "parent profile settings" screen and being confused why the write fails.

## 4. Financial write-path security

- **Every fee-ledger write is admin-only, server-verified, and audited.** `create_invoice`, `record_cash_payment`, `reverse_payment` all: check `private.is_admin()` first, derive the acting user from `auth.uid()` (never a client-supplied value — the same discipline already applied to attendance's `marked_by`), and write an `audit_logs` row on every call.
- **Office staff get zero fee/payment visibility — a stricter-than-planned, explicitly confirmed decision.** Verified directly: no RLS policy on `fee_heads`/`fee_structures`/`student_invoices`/`invoice_items`/`fee_payments` references `is_office_or_admin()` — only `is_admin()`. Correctly matches the decision log.
- **P1 — Phase 6 (online payments) will need its own security review before launch**, specifically: mandatory **server-to-server** gateway verification (never trusting a client "payment succeeded" callback alone), webhook signature verification modeled on the existing WhatsApp pattern, and the `reverse_payment()` constraint bug in `DATABASE_AUDIT.md` §3 fixed *before* any real online payment can be reversed. None of this exists yet, so there is nothing to find today — flagged here as a hard gate on Phase 6, not a current defect.

## 5. Test coverage of the security model (what's proven vs. assumed)

| Module | Automated RLS/API test coverage | Manual verification |
|---|---|---|
| Attendance | `tests/db/attendance.test.ts`, `tests/db/rls.test.ts`, `tests/api/direct-api.test.ts` (attacks the Data API directly) | Extensive, documented across every weekly release |
| Office role (Phase 1) | None dedicated found | One-off SQL impersonation pass, 2026-11-18, not repeated since |
| Guardians/parent-child links (Phase 2) | None dedicated found | Same one-off pass, 2026-11-18 — **found and fixed a real bug** (missing grant), which is exactly the value a repeatable automated test would keep capturing on every future change |
| Parent OTP login (Phase 3) | None found | **None** — never tested against a real OTP provider (§2 above) |
| Homework (Phase 4) | `tests/db/homework.test.ts` — confirmed present, not executed this session (no local Postgres) | — |
| Fees — cash (Phase 5) | `tests/db/fees.test.ts` — confirmed present, not executed this session | — |
| Fee reports (Phase 7) | None dedicated found (reads existing tables, no new RLS surface) | — |
| Fee reminders | `tests/db/fee-reminders.test.ts` — confirmed present (added with the most recent merged PR), not executed this session | — |

**P2 — Phases 1-3 (office role, guardian-child links, parent login) have no permanent automated test, only a one-off manual pass from 2026-11-18.** The project's own `PROJECT_ROADMAP.md` already flags this as a known gap ("worth closing that gap at some point, same method as Phases 1-2") — this audit independently confirms it's still true and elevates it slightly: **the one RLS bug this project has actually shipped and had to fix in production (missing `guardian_students` grants) was in exactly this untested area**, which is the strongest argument for closing it before it happens again in a module with higher stakes (fees already learned this lesson the hard way too — its own `fee_heads`/`fee_structures` INSERT-grant bug was caught only via manual rolled-back validation, not an automated test, before merge).

## 6. Infrastructure / operational security

- **P1 — No CI pipeline exists** (`.github/workflows` absent, confirmed). `npm run check` (lint+typecheck+test) is a documented manual pre-merge step, not enforced. Nothing stops a future merge to `main` — which auto-deploys to production — from skipping it. This is the single highest-leverage fix available: it would have caught nothing retroactively (every merge so far has in fact run `npm run check` per the weekly logs), but it is the only thing standing between "disciplined solo developer" and "accidental regression goes live," and that gap widens as the surface area (now 20 tables, 37 functions) grows.
- **No branch protection observed** on `main` — consistent with a single-developer repo at this stage; worth revisiting once the fee/payment modules carry more real financial stakes, or if a second contributor joins.
- **Secrets hygiene is clean**: grepped for `NEXT_PUBLIC_` prefixes against every server-only secret name (`SUPABASE_SERVICE_ROLE_KEY`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, `CRON_SECRET`, etc.) — zero matches. `.env.local` is git-ignored (confirmed in `.gitignore`); no secret value was found committed anywhere in the files read for this audit.
- **Webhook/cron hardening confirmed by reading the code, not assumed:** WhatsApp webhook verifies `x-hub-signature-256` via HMAC-SHA256 before parsing any payload; both cron routes (`notifications`, `fee-reminders`) use a **timing-safe** `Buffer`-length-checked comparison and **fail closed** (reject) if `CRON_SECRET` is unset — the correct default, re-verified directly in `src/app/api/cron/fee-reminders/route.ts` for this audit.
- **P3 — `SUPABASE_JWT_SECRET` appears in `.env.example`'s originally-provisioned Vercel variable set but is not referenced anywhere in `src/`** (per the prior 2026-11-17 audit's own finding, not independently re-greped line-by-line in this session — flagged as carried forward, not re-verified). Low-risk unused artifact, worth pruning once confirmed.

## 7. Privacy / data minimization

- Guardian phone/consent fields exist specifically to scope WhatsApp messaging, with consent defaulting to `false` and a school-level `whatsapp_enabled` switch that must also be on — a real double opt-in, not just a per-student flag.
- **Fee reminders re-check consent, phone, and the school's switch on every claim**, not just at original enqueue (the two most recent, not-yet-merged commits on `feature/fee-reminders` specifically hardened this — see the branch audit below). This is a materially better privacy posture than a one-time check, since a guardian who withdraws consent or a school that disables messaging is respected on the very next cron run, not months later.
- **P3 — Public gallery photo consent is still an open question**, per the project's own resume notes (identifiable children's faces in public gallery photos, guardian permission not yet confirmed with the school) — a process/consent gap, not a code gap, but relevant given this audit's broader scope now touches more student data.

## 8. In-flight work not yet in `main` (flagged, not a defect)

At audit time, `feature/fee-reminders` carries 2 commits pushed to GitHub but not yet merged via any PR: hardening the fee-reminder claim query to re-validate consent/phone/the messaging switch on every claim (addressed in §7 above), closing a gap where a job recovered from a crashed worker's stuck `processing` state could bypass that same re-check. **These are good changes that should be merged before the fee-reminder cron goes live with a real template** — flagging here so this audit's security assessment isn't read as missing them.

## 9. Summary by severity

| Severity | Finding |
|---|---|
| P1 | No CI pipeline enforcing `npm run check` on `main` |
| P1 | Phase 6 (online payments) needs a dedicated security review before build, including fixing the `reverse_payment()` constraint bug first |
| P2 | Parent OTP flow never tested against a real SMS provider |
| P2 | Hosted-project public sign-up status unconfirmed/contradicted between two project docs |
| P2 | Teacher-readable guardian-phone/name columns via the raw Data API (self-reported, long-standing) |
| P2 | Phases 1-3 (office role, guardian links, parent login) have no permanent automated RLS/API test — the one real production RLS bug this project shipped was in exactly this gap |
| P3 | `guardians` table's `UPDATE` grant has no matching self-service RLS policy (over-restrictive, not a vulnerability, but a surprise waiting to happen) |
| P3 | `SUPABASE_JWT_SECRET` possibly unused (carried forward, not re-verified) |
| P3 | Public gallery child-photo consent still unconfirmed with the school |
