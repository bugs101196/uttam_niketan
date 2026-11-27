# Uttam Niketan — Development Roadmap (post-audit)

**Date:** 2026-11-27 · Builds directly on the findings in `PROJECT_AUDIT.md`, `EXISTING_FEATURES.md`, `DATABASE_AUDIT.md`, `SECURITY_AUDIT.md`, `TECHNICAL_DEBT.md`. **This is a proposed plan, not an authorization to build** — per this task's own instruction, implementation waits for explicit approval, and per this project's own `docs/PROJECT_ROADMAP.md` §24, any of this that expands committed scope needs a change request, not a silent start.

Each task lists **Description / Priority / Dependencies / Complexity / Acceptance criteria**, grouped into the 13 categories requested. Priority follows this project's own P0-P3 scale.

---

## 1. Existing issues and fixes

| Task | Priority | Dependencies | Complexity | Acceptance criteria |
|---|---|---|---|---|
| Fix `reverse_payment()` to carry `gateway`/leave `gateway_payment_id` null on a reversal row, so it satisfies the `fee_payments` check constraint for an `online` original | P1 | None | Low (one function, additive migration) | A test (new, in `tests/db/fees.test.ts`) creates an online-style payment row directly and reverses it without a constraint violation |
| Add an admin-only `UPDATE`/self-view audit pass on `guardians` — either add a self-service RLS policy or explicitly document that guardians cannot edit their own profile yet | P3 | None | Low | Either a guardian can update their own `full_name`/`preferred_language` via RLS, or `CLAUDE.md`/architecture doc states plainly that this is deferred |
| Reconcile `CLAUDE.md` vs. `ERP_ARCHITECTURE.md` on whether hosted-project public sign-up is disabled | P2 | Owner confirms in the Supabase dashboard | Trivial | One of the two docs is corrected; if sign-up is still open, it gets disabled |
| Update `docs/PROJECT_ROADMAP.md` §20/§21/§23 to record Phases 4-7 and fee reminders (currently missing entirely) | P2 | None | Low | Roadmap status tracker matches `gh pr list` / `git log` |
| Update `docs/handover/known-issues.md` (still dated 2026-10-26) with current open items from this audit | P2 | None | Low | known-issues.md reflects Phases 1-7 state, not just the original MVP |
| Merge the 2 pending commits on `feature/fee-reminders` (consent/eligibility re-check hardening) | P1 | Owner opens the PR (gh pr create is token-blocked on this repo) | Trivial | PR merged, `git merge-base --is-ancestor` verified against `main` per this project's own PR-merge-race lesson |

## 2. Architecture improvements

| Task | Priority | Dependencies | Complexity | Acceptance criteria |
|---|---|---|---|---|
| Add a GitHub Actions CI workflow running `npm run check` on every PR | P1 | None | Medium (needs an ephemeral Postgres service for `test:db`/`test:api`, following the existing `local-stack` pattern) | A PR with a deliberately broken test fails CI; a clean PR passes |
| Add a standing "new table checklist" (RLS enabled + policy + base grant, composite FK for any denormalised school/year column, `search_path=''` on every function) to `CLAUDE.md` | P2 | None | Low | Checklist exists and is referenced from the roadmap's Definition of Done |
| Extend the admin dashboard summary cards with fee-collection and homework counts | P3 | None | Low | `(dashboard)/dashboard` shows 2 more stat tiles, RLS-scoped same as existing ones |

## 3. Database preparation

| Task | Priority | Dependencies | Complexity | Acceptance criteria |
|---|---|---|---|---|
| Verify the hosted database's applied-migration bookkeeping is in sync with the 14 files in `supabase/migrations/` | P1 | Owner access to Supabase dashboard/CLI (direct CLI queries against this project are classifier-blocked per established project history — route through the owner) | Low | Owner confirms via SQL Editor; discrepancies (if any) reconciled with `supabase migration repair` |
| Decide the online-payment schema additions needed for Phase 6 before writing them (gateway webhook event table? reuse `fee_payments.gateway_payload`?) | P1 | Gateway selection (§6 below) | Medium | A short design note added to `ERP_ARCHITECTURE.md` §9.3 before any migration is written |

## 4. Authentication and role management

| Task | Priority | Dependencies | Complexity | Acceptance criteria |
|---|---|---|---|---|
| Configure and test an SMS/OTP provider for Supabase phone-auth against a real phone number | P1 | Owner picks a provider (Twilio, MSG91 — already used on another of this user's projects) | Medium (dashboard config + one real end-to-end test) | A real OTP is sent and verified; `/parent/login` works against production, not just local emulation |
| Close the teacher-readable guardian-phone/name column gap (column-level policy or view) | P2 | None | Medium | `tests/api/direct-api.test.ts` gets a new case: a teacher's direct `select guardian_phone from students` returns null/no rows |

## 5. Student management

No new work identified — module is complete per `EXISTING_FEATURES.md`. CSV import remains a standing open scope question, not a defect; revisit only if the school confirms it's needed (§9 below).

## 6. Fee management (online payments — Phase 6)

| Task | Priority | Dependencies | Complexity | Acceptance criteria |
|---|---|---|---|---|
| Select a payment gateway (Razorpay/Cashfree-class, UPI-capable) | P0 (blocks everything else in this section) | Owner decision | — | Decision recorded in the Decision Log |
| Fix the `reverse_payment()` constraint gap (§1) before this ships | P1 | None | Low | Already listed above; repeated here as a hard prerequisite |
| Implement `verify_and_record_online_payment()` (server-to-server gateway verification, never trusting a client callback alone) | P0 | Gateway selected | High | A simulated "client says success but server-side verification fails" case is rejected; a verified payment is recorded exactly once |
| Implement the gateway webhook route (`/api/webhooks/payments`), signature-verified, modeled on the existing WhatsApp webhook pattern | P0 | Gateway selected | Medium | Unsigned/badly-signed requests return 401; a valid webhook is idempotent on retry (`gateway_payment_id unique` already provides this at the DB layer) |
| Receipt generation + Storage bucket (private, signed URL, `is_guardian_of`-gated) | P2 | Online payments landed | Medium | A parent can view/download their own receipt; a different guardian's signed-URL guess fails |

## 7. Parent dashboard

| Task | Priority | Dependencies | Complexity | Acceptance criteria |
|---|---|---|---|---|
| End-to-end verify the OTP login flow against a real SMS provider (listed under §4 too — the single highest-priority item for this module) | P1 | SMS provider configured | Medium | Covered above |
| Add permanent automated RLS tests for `guardian_students`/parent-login RLS, mirroring `tests/db/homework.test.ts`'s shape | P2 | None | Medium | New test file; a parent querying another family's `guardian_students` row returns nothing, re-checked automatically on every future change |

## 8. Teacher dashboard

No new work identified — module is complete per `EXISTING_FEATURES.md`.

## 9. Admin dashboard

| Task | Priority | Dependencies | Complexity | Acceptance criteria |
|---|---|---|---|---|
| Add fee-collection and homework summary cards (duplicate of §2's item, listed here for the dashboard-specific view) | P3 | None | Low | See §2 |
| Resolve the open "Admissions" screen question with the school (dedicated enquiry table vs. reuse student-creation flow) | P3 | School input | Low (decision) / Medium (if a new table is chosen) | Decision recorded; if a new table, it follows the same RLS pattern as every other admin-managed table |
| Resolve CSV import/export scope with the school | P3 | School input | Decision only until scoped | Recorded in the Decision Log either way |

## 10. WhatsApp integration

| Task | Priority | Dependencies | Complexity | Acceptance criteria |
|---|---|---|---|---|
| Complete Meta Business setup and template approval for both templates (`absence_alert`, `fee_reminder`) | P1 | School's Meta Business account, per `docs/whatsapp-templates.md`'s checklist | — (external process) | Both templates approved; `WHATSAPP_MODE` moved to `test`, verified against allow-listed numbers, then `live` |
| Merge the 2 pending fee-reminder consent-hardening commits before going live (duplicate of §1) | P1 | None | Trivial | See §1 |

## 11. Reports and analytics

| Task | Priority | Dependencies | Complexity | Acceptance criteria |
|---|---|---|---|---|
| Add homework-completion reporting (explicitly deferred from the Phase 7 PR) | P3 | None | Medium | A new report screen or section shows homework-posted vs. not-yet-posted counts per section, admin/office-only, RLS-consistent with existing `/reports/*` |

## 12. Testing and deployment

| Task | Priority | Dependencies | Complexity | Acceptance criteria |
|---|---|---|---|---|
| CI pipeline (duplicate of §2's top item — the single most impactful item in this entire roadmap, given 20 tables and 37 functions now depend on manual discipline alone) | P1 | None | Medium | See §2 |
| Automated RLS coverage for Phases 1-3 (duplicate of §7's item) | P2 | None | Medium | See §7 |
| Branch-protection / review gate on `main`, once a second contributor or higher financial stakes (Phase 6) land | P3 | None | Low | At least one required check (CI) before merge to `main` |

## 13. Notices (admin-editable, if the school wants it)

| Task | Priority | Dependencies | Complexity | Acceptance criteria |
|---|---|---|---|---|
| Decide whether to convert `src/content/notices.ts` to a database-backed, admin-editable table | P3 | School input | Medium (one new table + admin CRUD screen, same pattern as `fee_heads`) | Decision recorded; if approved, follows the existing admin-managed-config RLS pattern (direct admin writes, public read, same shape as `classes`/`fee_heads`) |

---

## Suggested sequencing

Given everything above, in the order this audit would recommend tackling it:

1. **Housekeeping (§1):** fix the constraint bug, update the two stale docs, merge the pending fee-reminder commits. All cheap, all reduce risk before anything else lands.
2. **CI pipeline (§2/§12):** the highest-leverage single change available — put it in place before the next phase of work, not after.
3. **Close the two outstanding verification gaps (§4/§7):** real-OTP test, automated Phases 1-3 RLS tests. Both are about *proving* what's already built actually works, not building anything new — cheapest way to retire real risk.
4. **Phase 6 (online payments, §6):** the largest remaining piece of net-new work, correctly gated on a gateway decision. Everything else in this roadmap (admissions, CSV, notices, homework reports) is optional polish the school can prioritize freely once the above is settled.
