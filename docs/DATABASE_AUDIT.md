# Uttam Niketan — Database Audit

**Date:** 2026-11-27 · Read-only. **No migration was run, no production data was queried or modified** — everything below comes from reading the 14 SQL migration files in `supabase/migrations/` directly, which is the project's own single source of truth for schema (per `CLAUDE.md`: "Schema changes go in a new file in `supabase/migrations/`; never edit an applied migration"). Live-database state (actual row counts, whether every migration has in fact been applied in production) is **unable to verify** in this session — no Supabase CLI/MCP connection was available, consistent with this project's established pattern of blocking direct CLI queries against this specific production database (see this project's own memory of prior sessions).

---

## 1. Schema inventory

**20 tables**, 2 schemas (`public` for data, `private` for authorization-helper functions not exposed via the Data API), across 14 timestamped migrations (2026-10-26 → 2026-11-26):

| Table | Purpose | Key constraints |
|---|---|---|
| `schools` | Tenant root | `name` non-blank; `timezone` defaults `Asia/Kolkata`; `whatsapp_enabled` added later |
| `profiles` | Staff identity (1:1 with `auth.users`) | `role in (admin, teacher, office)`; `unique(id, school_id)` |
| `academic_years` | Year definitions | `end_date > start_date`; **at most one active year per school** (partial unique index) |
| `classes` | Per-year class list | Composite FK to `(academic_years.id, school_id)`; case-insensitive unique name per year |
| `sections` | Per-class sections | Composite FK to `(classes.id, school_id, academic_year_id)`; denormalised `school_id`/`academic_year_id` kept consistent by the FK, not just RLS |
| `students` | Student records | Composite FK section→class→school chain; admission no. unique per school (case-insensitive); roll no. unique among **active** students of a section only |
| `teacher_assignments` | Teacher↔section↔year | Composite FKs; trigger rejects assigning a non-`teacher`-role profile; `unique(teacher_id, section_id, academic_year_id)` |
| `attendance_sessions` | One per section/day | `unique(section_id, attendance_date)`; check constraint ties `status`↔`submitted_by`/`submitted_at`/`locked_at` consistency |
| `attendance_records` | One per student/session | `unique(session_id, student_id)`; `section_id` snapshotted at marking time so history survives later promotions |
| `audit_logs` | Append-only trail | Trigger **rejects every UPDATE/DELETE** unconditionally (`prevent_audit_log_change`) |
| `notification_jobs` | Absence-alert queue | `dedupe_key unique` (one job per session+student); bounded `attempts`/`max_attempts` |
| `guardians` | Parent identity (1:1 with `auth.users`) | Phone E.164-checked; `unique(school_id, phone)`; trigger blocks self-escalation of `is_active`/`school_id` |
| `guardian_students` | Parent↔child link | Composite PK `(guardian_id, student_id)`; admin-only writes, never inferred from a phone match |
| `homework` | Per-section homework | Bilingual flat columns (`description_en`/`description_hi`, not jsonb); composite FK closing a cross-tenant gap (added as a follow-up migration, see §4) |
| `fee_heads` | Fee catalog | Unique name per school; `unique(id, school_id)` to support composite FKs from dependents |
| `fee_structures` | Per-class-per-year pricing | `unique(class_id, fee_head_id)`; composite FKs to both `classes` and `fee_heads` |
| `student_invoices` | Per-term invoice | `status` enum derived only by functions; `unique(student_id, academic_year_id, label)`; `due_date` added later, nullable |
| `invoice_items` | Invoice line snapshot | Composite PK `(invoice_id, fee_head_id)` — amounts frozen at issue time, never re-derived from `fee_structures` |
| `fee_payments` | Append-only ledger | `amount <> 0` (signed); `gateway_payment_id unique`; check ties `method` to `received_by`/`gateway` presence (**see §3 — latent bug**) |
| `fee_reminder_jobs` | Overdue-invoice queue | `dedupe_key unique` (one row per invoice, ever — recurs via reschedule, not a new row) |

**Enums:** `app_role` (admin/teacher/office), `app_language`, `enrollment_status`, `attendance_session_status`, `attendance_status`, `notification_status`, `invoice_status`, `payment_method`, `payment_status`.

## 2. Relationships and integrity design

- **No `ON DELETE CASCADE` anywhere** (confirmed by grep across all 14 migrations) — a deliberate, stated principle: historical attendance/financial records must never silently disappear because a parent row (a class, a student) was deleted. Deletes of referenced rows are rejected by the foreign keys themselves.
- **Composite foreign keys enforce cross-table tenant/year consistency**, not just RLS. Pattern used repeatedly: `sections` carries its own `school_id`/`academic_year_id` columns (denormalised from `classes`) and a composite FK forces them to agree with the parent row — `foreign key (class_id, school_id, academic_year_id) references classes (id, school_id, academic_year_id)`. This is the single most important integrity pattern in the schema: **RLS alone never checks that two independently-settable columns on the same row agree with each other** — only a DB constraint does. This exact gap was found and fixed once already (`homework_section_school_fk`, added as a follow-up migration after the original `homework` migration shipped without it — see §4).
- **Attendance invariants are enforced by both a check constraint and transaction logic**: `attendance_sessions`' check constraint makes it structurally impossible for a `draft` row to carry a `submitted_by`, or a non-draft row to lack one. Idempotent re-submission and duplicate-record prevention come from `unique(section_id, attendance_date)` / `unique(session_id, student_id)` plus the `submit_attendance_session` function's own logic (not independently re-read in this audit beyond confirming the function exists and is the only insert path — table grants are select-only for clients).
- **Financial append-only design**: `fee_payments` is never updated once written (confirmed: no `UPDATE`/trigger touches it anywhere in the migrations); a reversal is a new row with the amount negated and `reversed_payment_id` pointing back. `audit_logs` is append-only by an unconditional trigger, not just convention.
- **Snapshot-not-reference for money**: `invoice_items.amount` is copied from `fee_structures` at invoice-creation time and never re-derived — a later price change cannot silently rewrite an already-issued invoice. This is a correct and non-obvious design choice worth preserving in any future fee-related work.

## 3. A latent constraint bug found in this audit (not yet triggered)

`fee_payments` has: `check ((method = 'cash' and received_by is not null and gateway is null) or (method = 'online' and gateway is not null))`.

`reverse_payment()` (in `20261120000200_fees.sql`) inserts the reversal row with columns `(school_id, invoice_id, amount, method, received_by, status, reversed_payment_id, recorded_via, note)` — **`gateway` is never included**, so it defaults to `NULL`. For a `cash` original this is fine (`gateway is null` is exactly what the check wants). **For an `online` original, the reversal row would have `method = 'online'` and `gateway = NULL`, which satisfies neither branch of the check constraint — the `INSERT` would fail outright.**

This has never fired because online payments (architecture "Phase 6") do not exist yet — every payment in the system today is `cash`. It will fire the first time anyone reverses an online payment after Phase 6 ships, unless `reverse_payment()` is updated to carry `gateway` (and arguably `gateway_payment_id`, left `NULL` to avoid violating its own `unique` constraint) over from the original row. **Flagged here so it's fixed as part of Phase 6, not rediscovered as a production incident.**

## 4. RLS and privilege model

**42 `create policy` statements** across the 14 migrations; every one of the 20 tables listed above has RLS enabled (confirmed: every `create table` is followed, in the same or a later migration, by `alter table ... enable row level security`). No table was found with RLS enabled but zero policies (which would read as "deny everything" — not the case here) or disabled entirely.

**The consistent three-layer pattern** (verified directly in the SQL, not assumed from documentation):
1. A `private.*` `SECURITY DEFINER` helper answers one authorization question each (`is_admin()`, `is_office_or_admin()`, `is_assigned_to_section(id)`, `is_guardian_of(student_id)`, `current_school_id()`). Every RLS policy composes these rather than repeating raw subqueries — keeps the actual access logic in one place per concept.
2. **Base table grants are separately required and were once a real production bug.** `guardian_students` originally got only `SELECT` granted to `authenticated` while its RLS policies assumed `INSERT`/`DELETE` would reach them — a base-table `GRANT` is checked *before* RLS runs, so the policies were correct but unreachable. Found via live RLS impersonation testing and fixed in a follow-up migration (`20261118010000_guardian_students_grants.sql`). **This class of bug (policy correct, grant missing) is easy to reintroduce on any new table** — worth a standing checklist item (see `DEVELOPMENT_ROADMAP.md`).
3. Every multi-step or financial write goes through a `SECURITY DEFINER` function, never a raw client `INSERT`/`UPDATE` on the ledger tables themselves — attendance (5 functions) and fees (3 functions) both follow this, and both revoke `EXECUTE` from `public`/`anon` before granting it only to `authenticated` (or, for the two cron-only fee-reminder functions, only to `service_role`).

**One already-self-documented, still-open gap** (carried forward accurately from the project's own `known-issues.md` #5 and the 2026-11-17 audit — re-confirmed by reading the `students` table's RLS policy directly): the `students_select_office_or_admin`/teacher-select policies grant row access, and a teacher's `SELECT` on `students` is **not column-restricted** — `guardian_phone`/`guardian_name` are readable via the raw Data API even though the UI never shows them to a teacher. This is a data-minimization gap, not a cross-tenant or cross-role breach (a teacher still only sees their own assigned section's students). See `SECURITY_AUDIT.md` §3 for severity.

## 5. Functions inventory (37 total, by category)

| Category | Functions |
|---|---|
| Authorization helpers (`private.*`, `stable`, no side effects) | `current_school_id`, `is_admin`, `is_office_or_admin`, `is_assigned_to_section`, `is_guardian_of`, `can_take_attendance` |
| Integrity triggers | `set_updated_at`, `check_teacher_assignment_role`, `prevent_audit_log_change`, `protect_profile_fields`, `protect_guardian_fields` |
| Attendance writes (client-callable, `SECURITY DEFINER`) | `open_attendance_session`, `save_attendance_draft`, `submit_attendance_session`, `correct_attendance_record`, `lock_attendance_session`, plus internal `private.upsert_attendance_records` |
| Academic year management | `set_active_academic_year`, `copy_class_structure` |
| Fee writes (client-callable, admin-only) | `create_invoice`, `record_cash_payment`, `reverse_payment` |
| Notification queues (service-role only) | `claim_notification_jobs`, `complete_notification_job`, `claim_fee_reminder_jobs`, `complete_fee_reminder_job`, `scan_overdue_invoices_for_reminders`, `apply_whatsapp_status` (shared by both queues), plus internal `private.notification_dedupe_key`/`enqueue_absence_notification`/`cancel_absence_notification`/`fee_reminder_dedupe_key` |
| Misc | `website_theme` (cosmetic, unrelated to ERP data) |

Every function sets `search_path = ''` and qualifies every reference with its schema (`public.`/`private.`/`auth.`) — the standard Postgres `SECURITY DEFINER` hardening against search-path hijacking. Verified present on every function read in this audit; no exception found.

## 6. Storage

**No Supabase Storage bucket is used anywhere in the codebase** (confirmed: no `storage.from(...)` call, no bucket-policy migration). Gallery photos are committed as static build assets (`src/assets/gallery/`). This is reasonable at the current content volume but will need revisiting the moment any planned feature needs user-uploaded files — fee receipts and homework attachments were both proposed in `ERP_ARCHITECTURE.md` §7.5 and neither has shipped (consistent with `EXISTING_FEATURES.md`'s findings that online payments/receipts and homework attachments don't exist yet).

## 7. Indexes

Every foreign-key-heavy lookup path observed in the services layer has a matching index: `profiles_school_idx`, `students_section_idx`/`students_class_idx`/`students_name_idx`, `teacher_assignments_section_idx`, `attendance_sessions_school_date_idx`, `attendance_records_student_idx`, `audit_logs_school_created_idx`/`audit_logs_entity_idx`, `guardians_school_idx`, `guardian_students_student_idx`, `homework_section_idx`, `student_invoices_student_idx`/`student_invoices_due_date_idx` (partial, `where due_date is not null`), `fee_payments_invoice_idx`, `fee_reminder_jobs_due_idx`/`fee_reminder_jobs_school_created_idx`, `notification_jobs_due_idx`/`notification_jobs_school_created_idx`. No missing index was found for any FK column this audit checked against its corresponding query pattern in `src/services/*`.

## 8. What this audit could not verify

- **Whether every migration in this repo has actually been applied to the live production database**, and whether its applied-migration bookkeeping (`supabase_migrations.schema_migrations`) is in sync — the project's own decision log records this has drifted before (2026-11-18: the original 5 migrations were applied via a raw script, not `supabase db push`, and had to be reconciled manually). No live-database connection was available in this audit session to re-check.
- **Actual row counts / data volume** in production.
- **Whether RLS policies behave as written when actually impersonated against production** for the modules added since the last manual verification pass (2026-11-18, which covered Phases 1-2 only). Homework and fees have *automated* RLS test coverage (`tests/db/homework.test.ts`, `tests/db/fees.test.ts`) that this audit confirmed exist and are substantial, but could not execute (needs a local Postgres/Docker stack, unavailable this session) — see `SECURITY_AUDIT.md` §5 for which RLS surfaces have zero test coverage of any kind (manual or automated).
