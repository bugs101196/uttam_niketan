# Uttam Niketan — Existing Features Audit

**Date:** 2026-11-27 · See [`PROJECT_AUDIT.md`](./PROJECT_AUDIT.md) for methodology and headline findings.

Classification used throughout: **Completed** (schema/RLS + server-side guard + reachable UI, verified by reading the actual code, not assumed) · **Partially implemented** · **Not implemented** · **Needs improvement** · **Unable to verify** (would require live DB/production access not available in this session).

---

## 0. Repository shape (for reference)

```
src/app/(public)/      Home, About, Academics, Admissions, Notices(+photo), Gallery(+photo), Contact
src/app/(auth)/login/  Staff login
src/app/(dashboard)/   dashboard, attendance(+[sessionId]), students(+new,[id]), staff, parents,
                       homework(+[id]/edit), fees(+[studentId]), reports/{attendance,fees},
                       settings(+classes,fees)
src/app/(parent)/parent/login/, parent/(protected)/{dashboard,attendance,fees(+receipt),homework,notices}
src/app/api/           cron/notifications, cron/fee-reminders, webhooks/whatsapp
src/app/actions/       locale.ts (language switch)
src/components/        layout/* (header,footer,nav,language switch,announcement bar,skip link,logo), ui/form.tsx
src/content/           notices.ts, gallery.ts (typed bilingual content, not DB-backed)
src/i18n/               config.ts, dictionaries.ts (en/hi), server.ts
src/lib/auth/           staff.ts, guardian.ts, paths.ts
src/lib/supabase/       server.ts (RLS client), admin.ts (service-role, requireAdmin()-gated)
src/lib/whatsapp/       client.ts, config.ts, webhook.ts, worker.ts
src/lib/validation/     classes, fees, guardian, homework, parent-auth, staff, student
src/services/           attendance, classes, fees, guardians, homework, staff, students
supabase/migrations/    14 files, 2026-10-26 → 2026-11-26 (see DATABASE_AUDIT.md)
tests/{unit,db,api}/     56 unit test files' worth of cases / DB RLS+schema+workflow / direct Data-API attacks
```

Dependencies (`package.json`, read directly — not assumed): runtime — `@supabase/ssr`, `@supabase/supabase-js`, `next` 15.5.28, `react`/`react-dom` 19.1.0, `server-only`, `zod` 4. Dev — `@axe-core/playwright`, ESLint 9, Tailwind 4, `pg`, Prettier 3, TypeScript 5, Vitest 5. No unused or duplicated dependency found.

---

## 1. Module-by-module functional audit

### Public school website — **Completed**
Home, About, Academics, Admissions, Notices, Gallery, Contact. Bilingual EN/HI via cookie-based switch (`src/app/actions/locale.ts`), real content (`src/content/notices.ts`, `src/lib/school.ts` — school name, Mahnar/Vaishali address, phones, email, logo), sitemap.ts/robots.ts, OG image, 404/error/loading states, skip-link + focus-ring accessibility pass, reduced-motion support, 5 selectable website color themes. Verified by reading the actual content files, not inferring from route names.

### Student management — **Completed**
`(dashboard)/students`: list/search (name, admission no.), class/section/status filters, pagination, create/edit with Zod validation (`lib/validation/student.ts`), server-derived class/school (never trusts client-supplied IDs), duplicate admission-/roll-number rejection on the field, Indian mobile normalization to E.164 (`normalizePhone()`), guardian consent checkbox, per-student attendance history (last 60 days, submitted/locked only). Teachers get read access scoped to their assigned sections with guardian contact fields hidden in the UI (though not at the RLS/column level — see `SECURITY_AUDIT.md` §3).

### Parent management (admin side) — **Completed**
`(dashboard)/parents`: create a guardian account (service-role `auth.admin.createUser`, no self-registration), link/unlink to specific students via `guardian_students`, disable/enable. `requireAdmin()`-gated. A real production defect (missing `guardian_students` INSERT/DELETE grant) was found via RLS impersonation testing and fixed (PR #6) — the feature is now verified working, not just present.

### Teacher management — **Completed**
`(dashboard)/staff` (admin-only): create teacher/admin/**office** accounts with a one-time temporary password, disable/re-enable (also bans the Auth user), reset password, assign/unassign sections for the active academic year. Role selector includes all three `app_role` values.

### Class and section management — **Completed**
`(dashboard)/settings/classes`: CRUD for classes/sections/academic years, "set active year" and "copy class structure" as atomic audited database functions, deletes refused while attendance/invoice history exists against them.

### Attendance — **Completed**
The most mature module. `(dashboard)/attendance` + `[sessionId]`: date/section picker (school timezone, no future dates), per-section draft/submitted/locked status, roster entry with Present/Absent/Late/Excused, "mark all present", unsaved-change warning. Every write goes through 5 transactional `SECURITY DEFINER` functions (`open_attendance_session` → `save_attendance_draft` → `submit_attendance_session` → `correct_attendance_record` → `lock_attendance_session`) — clients have **read-only** table grants. `office` role now has the same marking rights as admin (Phase 1); correction/lock remain admin-only. Covered by dedicated `tests/db/attendance.test.ts` and `tests/api/direct-api.test.ts` cases.

### Fee management — **Completed, cash-only; online payments Not implemented**
`(dashboard)/fees` + `[studentId]`, `(dashboard)/settings/fees`: fee-head/fee-structure catalog (admin-managed, direct RLS writes), `create_invoice()` snapshotting amounts from the active fee structure, `record_cash_payment()`, `reverse_payment()` (both `SECURITY DEFINER`, admin-only — **office staff get zero fee visibility, not even their own receipts**, a confirmed decision stricter than the architecture doc's own draft). Parent read-only balance view at `/parent/fees`. Online payment gateway (architecture's "Phase 6") does **not exist** — no gateway client, no `verify_and_record_online_payment()` function, no webhook route — confirmed by grepping for "razorpay"/"cashfree"/"gateway" across `src/`, zero application-code hits outside the schema's own gateway-agnostic columns.

### Payment tracking — **Completed** (cash) / **Not implemented** (online)
`fee_payments` is an append-only ledger; a reversal is a new negated-amount row, the original is never touched. Running balance is computed, never stored as a writable field. `(dashboard)/reports/fees` shows month-by-month collections and outstanding dues. See `DATABASE_AUDIT.md` §3 for one latent constraint bug this audit found that only affects a future online-payment reversal.

### Homework — **Completed**
`(dashboard)/homework` (+`[id]/edit`): admin (any section) or the assigned teacher (own sections only) creates/edits; office and admin get school-wide read, teachers their sections, guardians their linked children's sections (`/parent/homework`). Bilingual description columns (`description_en`/`description_hi`), no attachments (deliberately deferred, not forgotten — the migration's own comment says so).

### Notices — **Partially implemented**
Public-facing notices (`src/content/notices.ts` + `notice-card.tsx` + `AnnouncementBar`) are real and live, but **code-defined, not database-backed** — there is no admin screen to publish/unpublish a notice without a code change/deploy. The architecture doc explicitly flagged converting this to DB-backed as optional, not committed scope (`ERP_ARCHITECTURE.md` §4.B, §17 Q7) — still unresolved. Parent portal's "Notices" page (`/parent/notices`) reads the same static content, so it inherits this limitation.

### WhatsApp notifications — **Completed (plumbing), Not live (by design)**
Two independent queues (absence alerts, fee reminders) share one Cloud API client, one HMAC-verified webhook, one timing-safe cron-secret pattern. `WHATSAPP_MODE=off` by default; nothing sends until the school's Meta Business setup and template approval are done. This is a confirmed, deliberate gate, not a defect — see `docs/whatsapp-templates.md`'s go-live checklist.

### Parent dashboard — **Completed, but with one real verification gap**
`/parent/login` → OTP → `/parent/dashboard` (+`attendance`, `fees`, `homework`, `notices`), child switcher, mobile-first. Built against Supabase's native phone-auth (`supabase.auth.signInWithOtp`/`verifyOtp`), not a custom OTP implementation. **The project's own decision log is explicit that this has never been end-to-end verified with a real OTP** — blocked on an SMS provider not yet being configured in the Supabase dashboard (§17 open question, still open as of this audit). Treat the parent login flow as **functionally built but operationally unverified** until that's done.

### Teacher dashboard — **Completed**
Shared with admin/office at `(dashboard)/dashboard`, scoped by role (`schoolWide = staff.role !== "teacher"`): a teacher sees their own section/today's-attendance-status, no school-wide counts.

### Admin dashboard — **Needs improvement**
Same component as above; for admin/office it shows active-student count, section count, active-teacher count, and today's attendance completion — all live-queried, RLS-scoped, no stale caching. **Gap:** no fee-collection or homework summary card, even though both modules now exist — the architecture doc itself suggested this (§4.B) when fees/homework shipped, and it was never followed up.

### Reports — **Completed** (attendance, fee collection) / **Not implemented** (homework completion)
`/reports/attendance`: daily per-section and monthly per-student summaries, 75%-threshold highlighting, reconciled against persisted records (not client state). `/reports/fees` (admin-only, Phase 7): month-by-month collections by cash/online/net and outstanding dues per academic year. Homework-completion reporting was explicitly scoped out of the Phase 7 PR and is still outstanding (`PROJECT_ROADMAP.md`'s own Phase 7 status line says so).

### CSV import/export — **Not implemented**
Confirmed absent from the codebase (no import route, no CSV parsing library in `package.json`). Tracked since Week 2 as "if in accepted scope" and never confirmed by the school (`known-issues.md` #8) — not a regression, a long-standing open scope question.

### Year-end student promotion — **Partially implemented**
The database functions exist (`set_active_academic_year`, `copy_class_structure`, migration `20261027000100`) and are reachable via `(dashboard)/settings/classes`, but there is **no dedicated "promote all students to next year" screen** — moving individual students between sections happens one at a time via the student edit form today. Tracked as the project's own "next change request" in `CLAUDE.md` and `known-issues.md` #12.

---

## 2. Summary table

| Module | Status |
|---|---|
| Public website | Completed |
| Student management | Completed |
| Parent management (admin) | Completed |
| Teacher management | Completed |
| Class/section management | Completed |
| Attendance | Completed |
| Fee management — cash | Completed |
| Fee management — online | Not implemented |
| Payment tracking | Completed (cash) |
| Homework | Completed |
| Notices | Partially implemented (static content, no admin publishing) |
| WhatsApp notifications | Completed, intentionally off |
| Parent dashboard | Completed, OTP flow operationally unverified |
| Teacher dashboard | Completed |
| Admin dashboard | Needs improvement (no fee/homework summary) |
| Attendance/fee reports | Completed |
| Homework reports | Not implemented |
| CSV import/export | Not implemented |
| Year-end promotion UI | Partially implemented (functions exist, no screen) |
