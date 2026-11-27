# Uttam Niketan — Technical Debt Audit

**Date:** 2026-11-27 · Read-only. Severity scale: Critical / High / Medium / Low (same scale as `SECURITY_AUDIT.md`, applied here to non-security code-quality/maintainability/scalability findings).

---

## 1. Headline: this codebase has very little debt for its size

20 tables, 37 functions, ~30 routes, 3 Vitest projects, zero lint errors, zero type errors, 79/79 unit tests passing (all verified live in this session). The debt that exists is almost entirely **documentation drift** (covered in `PROJECT_AUDIT.md` §4) and a handful of **specific, named gaps** rather than systemic quality problems. There is no dead code, no duplicated business logic, and no obviously-wrong abstraction found in this audit.

## 2. Findings by severity

### High

1. **No CI pipeline (`.github/workflows` absent).** Already covered as a security finding in `SECURITY_AUDIT.md` §6; it's equally a technical-debt finding — `npm run check` not being enforced on PRs means every future contributor (including a future Claude session) is trusting that the previous one ran it, which the weekly logs show has held so far but is not structurally guaranteed.
2. **The `reverse_payment()` constraint bug** (`DATABASE_AUDIT.md` §3) — latent, not yet triggered, but will cause a hard failure (not a silent wrong answer) the first time an online payment is reversed. Cheap to fix now, before Phase 6, while nobody depends on the current behavior.

### Medium

3. **Documentation genuinely lags the code, repeatedly, on this project.** Covered in depth in `PROJECT_AUDIT.md` §4 — three separate incidents of merged work not reflected in `PROJECT_ROADMAP.md`. This is debt in the project's *process*, not its code, but it has real cost: anyone (human or agent) planning the next phase from the roadmap alone would currently miss that Phases 4-7 and fee reminders exist at all.
4. **Admin dashboard summary cards stale relative to shipped modules.** `(dashboard)/dashboard/page.tsx` shows students/sections/teachers/today's-attendance only — no fee-collection or homework count, even though the architecture doc that proposed those modules also explicitly suggested extending this dashboard when they shipped (`ERP_ARCHITECTURE.md` §4.B). Small, low-risk, easy follow-up.
5. **Phases 1-3 have no permanent automated test coverage**, only a one-off manual pass — already covered as a security finding (`SECURITY_AUDIT.md` §5) but it's equally a maintainability issue: every future change to `office`/`guardians`/parent-login RLS has no regression safety net the way homework/fees now do.
6. **Notices are code-defined, not database-backed**, so publishing a new one requires a code change and a deploy rather than an admin screen. Explicitly flagged as optional scope in the architecture doc (§17 Q7) — listed here as debt only in the sense that it's the one "admin content management" feature pattern in the app that doesn't yet follow the same CRUD-via-RLS pattern everything else does, which could matter if the school asks for self-service notices later.
7. **Guardian self-update grant with no matching policy** (`SECURITY_AUDIT.md` §3 P3) — a small inconsistency between a table grant and its RLS policy set that would surface as a confusing silent failure if a "parent edits their own profile" feature is ever built against the current grant alone without checking for a matching policy first.

### Low

8. **`SUPABASE_JWT_SECRET` possibly unused** (carried forward from the prior audit, not re-verified character-for-character in this session) — a default Vercel-integration artifact, not application-introduced debt. Prune once confirmed genuinely unreferenced.
9. **No dedicated "Admissions" admin screen** — the public `/admissions` page exists, but the dashboard has no distinct admissions-intake concept beyond the ordinary student-creation flow. This is an open product question (`ERP_ARCHITECTURE.md` §17 Q6), not a code smell — listed here only so it doesn't get silently treated as "already decided" by a future session.
10. **Year-end promotion has functions but no screen** — `set_active_academic_year`/`copy_class_structure` exist and are wired into Settings, but moving individual *students* into the next year's sections is still one-at-a-time via the student edit form. Tracked as the project's own stated "next change request."
11. **Staff app is English-only** while the public site is bilingual — a known, accepted scope boundary (`known-issues.md` #6), not an oversight, listed here for completeness since it does constrain who on staff can self-serve the app.
12. **CSV import/export absent** — tracked since Week 2, never confirmed in scope. No code debt (nothing half-built to maintain), purely a scope decision still pending.

## 3. What this audit explicitly did *not* find

To be precise about what "very little debt" means here — this audit specifically checked for and did **not** find:
- Duplicate business logic across modules (fee/attendance/homework each implement their own validation and write path deliberately, per `CLAUDE.md`'s own stated convention of "each settings sub-section keeps its own local copy" rather than a shared abstraction — a documented choice, not an accident).
- Unnecessary or unused npm dependencies (`package.json`'s 7 runtime + 15 dev dependencies were all traced to real usage).
- Client-side-only authorization anywhere (every check that matters is server-side, confirmed in `SECURITY_AUDIT.md`).
- Any `TODO`/`FIXME` comment left unresolved for longer than the migration that introduced it (grepped `src/` and `supabase/migrations/` for `TODO|FIXME|HACK`; zero matches outside explanatory migration-header prose that already describes itself as intentional, not a shortcut).

## 4. Prioritized cleanup list (before adding more scope)

1. Fix the `reverse_payment()` constraint gap (cheap, prevents a guaranteed future incident).
2. Add a CI workflow running `npm run check` on pull requests.
3. Add permanent automated RLS tests for Phases 1-3, mirroring the shape already proven for homework/fees.
4. Update `docs/PROJECT_ROADMAP.md` §20/§23 and `docs/handover/known-issues.md` to reflect Phases 1-7 and fee reminders (this audit's findings can seed that update directly).
5. Everything else in this document is either an explicit, already-logged open product decision (notices, admissions, CSV, English-only staff UI, year-end promotion) or a small polish item (dashboard summary cards) — appropriate to schedule alongside the next phase of work, not urgent on its own.
