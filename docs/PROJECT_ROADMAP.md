# Uttam Niketan — Website & School Management App
## Project Roadmap and Persistent Project Context

> **Purpose of this file:** Use this document as the durable project roadmap and shared context for Claude while planning, implementing, testing, and maintaining the Uttam Niketan School Website and School Management App.
>
> **Project type:** Paid client project  
> **Delivery target:** 4 weeks / approximately 20 working days  
> **Primary approach:** Weekly phases, testable releases, explicit acceptance gates, and bug-fix cycles  
> **Status:** Planning baseline — update status and actual dates as work progresses.

---

## 1. Instructions for Claude: How to Use This File

Treat this file as the main project reference and source of truth for the Uttam Niketan project.

1. Read this file before proposing architecture changes, writing implementation code, or recommending a scope change.
2. Preserve the agreed priorities: **database → authentication and authorization → student management → attendance → testing → WhatsApp integration**. Build the public website in parallel where practical.
3. Work in small, reviewable increments. For each feature, define the expected behavior, implementation tasks, tests, and acceptance criteria.
4. Do not treat a feature as complete merely because code has been written. It is complete only after the relevant tests pass and its acceptance criteria are met.
5. Keep the public website and private school-management app separated by route structure, authorization, and data access. Public pages must never expose confidential student or guardian records.
6. Do not silently expand the MVP. Identify scope changes and explain their impact on the 4-week target before implementing them.
7. When a milestone is completed, update the **Project Status**, **Weekly Progress Log**, **Defect Register**, and **Decision Log** sections below. Keep completed decisions and their rationale.
8. When working from an uploaded repository or starter ZIP, inspect the actual files before assuming that a feature exists or works. Do not claim deployment, testing, or production-readiness unless it has been verified.
9. Use fictional or anonymized student data in development and screenshots. Do not put real student records, passwords, access tokens, or secrets in this Markdown file, source control, issue logs, or prompts.
10. If a conflict exists between the code and this plan, identify it explicitly. Recommend whether to update the plan or bring the implementation back into alignment; do not silently overwrite important architectural decisions.

### Working method for Claude

For each requested task, respond or work in this order:

- **Goal:** What outcome is being delivered.
- **Scope:** Which files, database tables, routes, and user roles are affected.
- **Implementation:** Concrete coding steps.
- **Security and data integrity:** Access controls, validation, constraints, transaction behavior, and sensitive data handling.
- **Tests:** Unit, integration, permission, regression, and manual tests as applicable.
- **Acceptance criteria:** What proves the task is complete.
- **Follow-up:** Remaining defects, dependencies, and the next logical task.

---

## 2. Project Overview

Uttam Niketan is a school in Bihar, India, serving Nursery through Class 8. The planned system includes two connected but separately secured products:

1. **Public school website:** Bilingual English/Hindi school information, admissions information, notices, gallery, and contact details.
2. **Private School Management App:** Authenticated principal/admin and teacher workflows for student records, classes and sections, attendance, and reports.
3. **WhatsApp absence notifications:** A later integration, introduced after the attendance workflow has been tested and approved.

The school currently relies on paper records. The app should be practical on low-cost Android phones and work reliably on ordinary school internet connections.

### Main objectives

- Establish a professional, responsive, bilingual public web presence.
- Digitize student records and class/section organization.
- Let teachers mark and submit attendance from a phone or computer.
- Let the principal/admin manage records, users, assignments, and reports.
- Preserve student-data privacy using authentication, server-side authorization, database constraints, and Row Level Security (RLS).
- Add WhatsApp messaging only after the core workflow is stable.
- Deliver in weekly releases so issues are found and fixed throughout the month, rather than at the very end.

---

## 3. Project Status and Key Decisions

### Current planning baseline

- [ ] Week 1 — Requirements, design, foundation, initial database, website shell
- [ ] Week 2 — Public website, authentication, permissions, student management
- [ ] Week 3 — Attendance workflow, reports, security and regression testing
- [ ] Week 4 — WhatsApp integration if approved/setup is ready, full QA, deployment and handover

**Current phase:** Week 2 — auth, permissions, student and staff management built (Days 7–10) on branch `week-2-auth-students`; public page content (Day 6) and Week 1 Days 1–2 awaiting the school  
**Target duration:** 4 weeks, approximately 20 working days  
**Actual start date:** TBD after project scope approval  
**Target launch date:** TBD based on actual start date and dependencies  
**Last updated:** 2026-10-26

### Decisions already agreed

| Decision | Agreed direction |
|---|---|
| Project purpose | Paid client project for Uttam Niketan |
| Platform | Responsive web app / installable PWA; do not build native Android first |
| Framework | Next.js App Router + TypeScript |
| Styling | Tailwind CSS and reusable accessible UI components |
| Database | Supabase PostgreSQL |
| Authentication | Supabase Auth |
| Deployment | Vercel, source controlled in GitHub |
| Initial app users | Principal/admin and teachers |
| MVP app features | Student records, class/section setup, teacher assignments, attendance and basic reports |
| Notification strategy | Build WhatsApp after the attendance workflow is reliable |
| Language | Public website should support English and Hindi |
| Security baseline | Server-side authorization plus RLS; do not rely on hidden buttons or frontend-only checks |
| Release method | Weekly preview/demo, QA, defect fixing, and acceptance gates |
| MVP exclusions | Fees, exams/report cards, homework, payroll, transport, full parent portal and native Android app unless separately approved |

### Items requiring confirmation from the school

- Confirm the official school name, address, phone numbers, logo and approved brand materials.
- Confirm classes and sections, including naming conventions for Nursery and other early years.
- Confirm the academic calendar/year, start/end dates, holidays, and when attendance can be marked.
- Confirm who is allowed to edit attendance after submission and how corrections should be approved.
- Confirm which student and guardian fields are genuinely required.
- Confirm whether CSV import/export is included in the accepted MVP.
- Confirm the public website's final copy, admissions details, notices and gallery images.
- Confirm who is responsible for WhatsApp business assets, guardian permissions/consent, template approval and messaging fees.
- Confirm recurring hosting, database, domain and messaging costs and who pays them.

Record any answers in the **Decision Log** section.

---

## 4. Scope Definition

### 4.1 Public website — included

- Home
- About the school
- Academics
- Admissions
- Notices and announcements
- Gallery
- Contact information and contact links
- English/Hindi language switch
- Responsive desktop, tablet and mobile layouts
- Basic SEO metadata, page titles, sitemap/robots setup where suitable
- Admin controls for publishing/unpublishing notices and gallery items, if time permits within the agreed MVP
- School-provided logos, text, photographs and contact details

### 4.2 Private School Management App — included

- Admin and teacher authentication
- Protected dashboard
- Role-based authorization
- School profile and academic year setup
- Classes and sections
- Student create, view, update and search
- Admission number uniqueness
- Guardian contact fields and preferred message language
- Teacher accounts and teacher-to-section assignments
- Daily attendance session by section and date
- Draft attendance, submit workflow and correction/override policy
- Attendance history and basic daily/monthly summaries
- Audit trail for attendance submission and admin corrections
- CSV student import and/or export only to the extent confirmed in the final scope
- Basic notification queue/status infrastructure if it can be delivered without compromising the core attendance work

### 4.3 WhatsApp integration — later, gated scope

- Official WhatsApp Business Platform / Cloud API
- Approved Hindi and English templates
- Eligible-recipient / guardian-consent checks
- Notification queue and deduplication
- Bounded retries and error handling
- Verified webhook for provider status callbacks
- Notification status logs for administrators
- Test recipients first; no real parent messaging without school authorization and completed setup

If Meta account readiness, business verification or template approval is delayed, launch the stable website and attendance core separately. Do not make the whole release dependent on live messaging approval.

### 4.4 Explicitly outside the MVP unless approved as a change request

- Fee collection or accounting
- Exams, grades and report cards
- Homework or learning management
- Payroll, transport or inventory
- Parent login/portal
- Native Android/iOS apps
- Offline attendance synchronization
- Advanced analytics
- Integrations not explicitly listed above

---

## 5. Technology Architecture

### Proposed stack

| Layer | Technology | Responsibility |
|---|---|---|
| Frontend | Next.js App Router, TypeScript | Public pages and authenticated application |
| UI | Tailwind CSS, reusable component library | Responsive consistent design |
| Backend | Next.js Route Handlers and server-side services | Business logic, validation, authorization |
| Database | Supabase PostgreSQL | Durable structured data and constraints |
| Identity | Supabase Auth | User identity and sessions |
| Data access protection | PostgreSQL RLS and server authorization | Data access boundaries |
| File storage | Supabase Storage if needed | Approved school assets; avoid unnecessary student files |
| Deployment | Vercel | Preview and production deployments |
| Version control | GitHub | Branches, pull requests and history |
| Validation | Zod plus database constraints | Request and form validation |
| Messaging | Official WhatsApp Business Platform | Later parent notifications |
| PWA | Web manifest and app icons | Installable browser app |

### Architecture principles

- Build the public website and private app in one repository only if that keeps delivery simple; separate their layouts, route groups, and permissions.
- Use server components/server-side data access by default for private pages where suitable.
- Every privileged operation must validate authentication, active account status, role, school membership and section assignment on the server.
- Frontend checks improve UX but are not security controls.
- Use version-controlled SQL migrations, not undocumented manual database edits.
- Use transactions or database functions for workflows that must update multiple related records atomically.
- Use idempotency keys/unique constraints where operations could be retried.
- Use separate development, preview/staging and production environment variables.
- Never commit credentials to GitHub or Markdown. Never expose a Supabase service-role key or WhatsApp token through a `NEXT_PUBLIC_` variable.
- Do not claim reliable offline attendance unless an offline queue and conflict-resolution behavior are implemented and tested.

### Suggested project structure

```text
uttam-niketan/
├── public/
│   └── icons/
├── src/
│   ├── app/
│   │   ├── (public)/
│   │   │   ├── page.tsx
│   │   │   ├── about/
│   │   │   ├── academics/
│   │   │   ├── admissions/
│   │   │   ├── notices/
│   │   │   ├── gallery/
│   │   │   └── contact/
│   │   ├── (auth)/
│   │   │   └── login/
│   │   ├── (dashboard)/
│   │   │   ├── dashboard/
│   │   │   ├── students/
│   │   │   ├── attendance/
│   │   │   ├── reports/
│   │   │   ├── staff/
│   │   │   └── settings/
│   │   └── api/
│   ├── components/
│   │   ├── ui/
│   │   ├── layout/
│   │   ├── students/
│   │   ├── attendance/
│   │   └── reports/
│   ├── lib/
│   │   ├── supabase/
│   │   ├── auth/
│   │   ├── validation/
│   │   └── whatsapp/
│   ├── services/
│   └── types/
├── supabase/
│   ├── migrations/
│   └── seed.sql
├── tests/
├── .env.example
├── README.md
└── package.json
```

Adjust this structure to the actual repository if it already exists. Do not create duplicate codebases without a reason.

---

## 6. Database Blueprint

Use UUID primary keys, foreign keys, timestamps with time zones where appropriate, explicit status values, indexes on common filters, and database-enforced uniqueness.

### Core tables

| Table | Purpose / key fields |
|---|---|
| `schools` | `id`, `name`, `timezone` default `Asia/Kolkata`, `default_language`, timestamps |
| `profiles` | Auth user ID, `school_id`, `full_name`, `role` (`admin` or `teacher`), `is_active` |
| `academic_years` | `id`, `school_id`, name, start/end dates, active flag |
| `classes` | `id`, `school_id`, `academic_year_id`, name, sort order |
| `sections` | `id`, `class_id`, section name |
| `students` | `id`, `school_id`, `admission_no`, full name, class/section, roll number, guardian name/phone, preferred language, enrollment status |
| `teacher_assignments` | `teacher_id`, `section_id`, `academic_year_id` |
| `attendance_sessions` | `id`, `section_id`, `attendance_date`, status, submitted by/time |
| `attendance_records` | `session_id`, `student_id`, attendance status, marked by/time, updated time |
| `audit_logs` | actor, school, action, entity type/ID, timestamp; avoid secrets and excessive personal data |
| `notification_jobs` | attendance record reference, recipient, template language, status, retry count, provider message ID, error and delivery timestamps |

### Important constraints and integrity rules

- Unique `(school_id, admission_no)` for student admission numbers.
- Unique `(academic_year_id, class name)` or equivalent normalized class key.
- Unique `(class_id, section name)`.
- Unique `(teacher_id, section_id, academic_year_id)` for teacher assignments.
- Unique `(section_id, attendance_date)` for a section's daily attendance session.
- Unique `(session_id, student_id)` for attendance records.
- A student’s selected section must belong to the selected class and correct school/academic year.
- Teacher assignments must refer to valid teachers, sections and academic years.
- Enrollment status should be explicit, e.g. `active`, `inactive`, `transferred`.
- Session status should be explicit, e.g. `draft`, `submitted`, `locked`.
- Attendance status should be explicit, e.g. `present`, `absent`, optionally `late` and `excused`.
- Add indexes for student class/section lookups, admission number search, attendance date, session ID and student history.
- Use composite foreign keys or database functions where necessary to enforce related-class/school/year integrity.
- Do not use destructive cascades that could erase historical attendance accidentally.
- Promotion between years must preserve historical attendance records.

### Attendance invariants

1. No session is treated as a list of absences simply because attendance has not been submitted.
2. A submitted session contains a well-defined roster and saved statuses.
3. The session submission, record updates and creation of eligible notification jobs should be performed atomically or through a reliable transactional database function.
4. Retried submissions must not create duplicate attendance records or notification jobs.
5. Submitted attendance can only be changed through an explicit authorized correction/override flow.
6. Admin corrections should be recorded in audit history.
7. Reports must calculate from persisted records, not stale client-side state.

---

## 7. Roles and Permissions

### Principal/admin

- Manage students, classes, sections and academic years.
- Create/disable staff accounts and manage teacher assignments.
- View school-wide attendance summaries and authorized reports.
- Submit attendance and make approved corrections.
- View notification status/error logs.
- Manage public notices/gallery content and school settings.
- Never expose the service-role key, API secrets or WhatsApp tokens in the client.

### Teacher

- Sign in and view assigned classes/sections only.
- View roster data necessary for teaching and attendance.
- Save drafts and submit attendance for assigned sections.
- View relevant attendance history for assigned sections according to school policy.
- Cannot create admin users, change roles, access WhatsApp credentials or perform bulk guardian exports.
- Cannot bypass section assignments by changing route parameters or making direct API calls.

### Authorization rules

- RLS enabled on every exposed table.
- Explicit SELECT/INSERT/UPDATE/DELETE policies for each role and operation.
- Teacher access derives from an authorized assignment, not from an arbitrary section ID supplied by a client.
- Prevent users from changing their own role, school ID or active status.
- Use privileged/service-role access only on the server and only after explicit authorization.
- Test direct API/SQL access as well as UI behavior.

---

## 8. Screen and Route Plan

### Public website routes

- `/` — Home
- `/about` — About the school
- `/academics` — Academic offering and classes
- `/admissions` — Admission information and enquiry instructions
- `/notices` — Announcements
- `/gallery` — Approved school images
- `/contact` — Address, contact information and contact links

### Private app routes

- `/login` — Staff login, no public registration
- `/dashboard` — Overview, attendance completion and recent activity
- `/students` — Search/filter student list
- `/students/new` — Add student
- `/students/[id]` — Student detail/edit
- `/attendance` — Choose section/date and mark roster
- `/attendance/[sessionId]` — Session review and submit/correction workflow as appropriate
- `/reports/attendance` — Daily/monthly summaries and history
- `/staff` — Staff accounts and teacher assignments (admin only)
- `/settings` — School profile, academic year and later messaging configuration

### Essential UX requirements

- Mobile-first and usable on budget Android phones.
- Large tap targets and readable typography.
- Clear English/Hindi language switching where included.
- Visible loading, saving, success, empty and error states.
- Confirm before irreversible or finalizing actions.
- Show whether attendance is a draft, submitted or locked.
- Prevent accidental navigation away from unsaved attendance.
- Do not claim that a save succeeded until the server confirms it.
- Make errors understandable to school staff; log technical details server-side without leaking sensitive data.

---

## 9. API / Server Operation Plan

Use Next.js Route Handlers, server actions or server-side service functions as appropriate. Do not expose unnecessary endpoints if a server action or server-rendered data access is simpler and secure.

Suggested operations:

| Method | Route / operation | Purpose |
|---|---|---|
| `GET` | `/api/students` | Search/filter students |
| `POST` | `/api/students` | Create a student |
| `GET` | `/api/students/:id` | Read student details |
| `PATCH` | `/api/students/:id` | Update a student |
| `POST` | `/api/students/import` | Validate/import CSV if in scope |
| `GET` | `/api/classes` | List allowed classes and sections |
| `GET` | `/api/attendance?sectionId=...&date=...` | Load attendance roster |
| `POST` | `/api/attendance/sessions` | Create or retrieve a session idempotently |
| `PUT` | `/api/attendance/sessions/:id/records` | Save a draft safely |
| `POST` | `/api/attendance/sessions/:id/submit` | Validate and submit transactionally |
| `GET` | `/api/reports/attendance` | Authorized reports |
| `GET` | `/api/notifications` | Admin notification logs when messaging is enabled |
| `POST` | `/api/webhooks/whatsapp` | Verified provider callback when messaging is enabled |

### API standards

- Validate request bodies and query parameters with Zod.
- Return appropriate HTTP status codes and safe, consistent error messages.
- Enforce authentication and role/assignment checks per operation.
- Do not trust submitted `school_id`, `role`, `marked_by`, or `submitted_by` values from the client; derive trusted identity from the session on the server.
- Validate date strings and the relevant school's timezone policy.
- Reject duplicate student IDs in a batch and students outside the selected section.
- Use transactions/RPC functions for submit operations that affect multiple tables.
- Make retryable operations idempotent.
- Avoid leaking stack traces, tokens, guardian contact data or private student fields.

---

## 10. Four-Week Delivery Roadmap

Assume approximately 20 working days. The actual calendar dates should be set after the client confirms the start date and the required school materials are available.

# Week 1 — Requirements, Design, Project Foundation and Database

**Goal:** Approve the scope and establish the base repository, website design system and database foundation.

### Day 1 — Discovery and requirements
- Confirm features, users, school roles, languages, class/section structure, attendance rules and MVP exclusions.
- Confirm required student fields and guardian contact handling.
- Create acceptance criteria and identify school-provided dependencies.
- Create an initial risk/dependency register.

**Output:** Approved scope and requirements baseline.

### Day 2 — Sitemap and UX design
- Define public page structure and navigation.
- Wireframe the public website, login, dashboard, student list and attendance flow.
- Define colors, typography, spacing, reusable components and English/Hindi behavior.
- Review with the school contact.

**Output:** Approved wireframes and UI foundations.

### Day 3 — Repository and environment
- Set up Next.js + TypeScript + Tailwind.
- Configure linting and type checking.
- Create GitHub repository and branch conventions.
- Configure Supabase development project and Vercel preview deployment.
- Add `.env.example`; keep real secrets outside source control.

**Output:** App runs locally and has a working preview deployment.

### Day 4 — Database schema and migration
- Create migrations for schools, academic years, profiles, classes, sections, students, assignments and attendance.
- Add foreign keys, uniqueness constraints, indexes and status checks.
- Start RLS design and seed fictional test data.
- Verify migration works on a clean development database.

**Output:** Repeatable database migration and schema baseline.

### Day 5 — Public shell and Week 1 review
- Build shared public header/footer, navigation, language switch and homepage shell.
- Confirm mobile/tablet/desktop behavior.
- Demo the current website shell and schema.
- Record issues and fix blockers before Week 2.

**Week 1 test gate**
- [ ] Approved requirements and wireframes
- [ ] Local and preview environments run
- [ ] Initial database migration applies cleanly
- [ ] Constraints reject duplicate/invalid data
- [ ] Public navigation and language switch work
- [ ] No secrets committed to the repository

**Release 1 acceptance:** project foundation and initial website shell approved.

---

# Week 2 — Public Website, Authentication, Permissions and Student Management

**Goal:** Complete the main public pages and implement secure access plus student management.

### Day 6 — Website content pages
- Build About, Academics, Admissions, Notices, Gallery and Contact pages.
- Add page titles, descriptions, image alt text and basic SEO metadata.
- Clearly label any temporary placeholder content.
- Ensure the English/Hindi content model remains consistent.

### Day 7 — Authentication foundation
- Configure Supabase SSR/browser clients appropriately.
- Implement login/logout and safe session handling.
- Protect dashboard routes and redirect unauthenticated users.
- Create an admin-provisioning process; do not allow public self-registration.
- Handle disabled/inactive profiles.

### Day 8 — Permissions and RLS
- Enable RLS on the relevant tables.
- Implement policies for admins and teachers.
- Build server-side authorization helpers for role, active profile, school and teacher assignment.
- Test direct API requests and route manipulation, not just UI visibility.

### Day 9 — Student management
- Build list/search/filter/add/edit/detail pages.
- Validate admission number uniqueness and required fields.
- Validate class/section consistency and guardian contact formatting.
- Provide clear form error and success states.

### Day 10 — Assignments, import and Week 2 review
- Implement teacher-to-section assignment management.
- Implement CSV import validation if in the accepted scope.
- Add a helpful import error report without exposing unnecessary personal data.
- Complete regression tests and demo the release.

**Week 2 test gate**
- [ ] Public pages and language switch work
- [ ] Login/logout and protected routes work
- [ ] Admin can create, search and update test students
- [ ] Duplicate admission numbers are rejected
- [ ] Invalid CSV rows are reported safely, if CSV import is included
- [ ] Teachers cannot access admin-only operations
- [ ] Disabled accounts lose access
- [ ] Cross-school/cross-section access attempts are denied

**Release 2 acceptance:** website reviewed and core authenticated student management accepted.

---

# Week 3 — Attendance Workflow, Reporting and Security Regression

**Goal:** Deliver a reliable class-wise attendance flow and verify data integrity.

### Day 11 — Attendance roster UI
- Add class, section and date selectors.
- Load the active roster for the chosen section.
- Build Present/Absent controls, mark-all-present, and absent highlighting.
- Add loading, error, empty and unsaved-change handling.

### Day 12 — Draft and submit backend
- Implement session create/retrieve behavior.
- Implement draft saving and roster validation.
- Build transactional submission logic using a database transaction or PostgreSQL function.
- Derive submitting user from the authenticated server session.
- Enforce unique session/date and student/session records.
- Prevent duplicate submissions and accidental duplicate jobs.

### Day 13 — History and reports
- Build daily and monthly summaries.
- Add student-wise history and class/section/date filters.
- Add CSV export if confirmed in scope.
- Ensure summary counts are computed from persisted database records.

### Day 14 — Correction workflow and security tests
- Implement submitted-session edit restrictions.
- Add admin correction/override logic and audit logging.
- Test unauthorized section IDs, invalid dates, roster changes and race/retry behavior.
- Validate timezone handling for attendance dates.

### Day 15 — Week 3 review and regression
- Fix P0/P1 defects.
- Run the complete attendance and permissions regression suite.
- Demo to the school and gather teacher feedback.
- Obtain attendance workflow acceptance or document blocking defects.

**Week 3 test gate**
- [ ] Correct roster loads for selected section and date
- [ ] Draft save works
- [ ] Submitted records are complete and consistent
- [ ] Duplicate submit/retry does not create duplicate records
- [ ] Teachers cannot access unassigned sections
- [ ] Admin corrections are permission-checked and auditable
- [ ] Report totals reconcile with saved records
- [ ] Incomplete sessions are not treated as absences
- [ ] Critical/high data-integrity bugs are closed

**Release 3 acceptance:** attendance is validated using fictional data and signed off before live parent messaging.

---

# Week 4 — WhatsApp Integration, End-to-End QA, Deployment and Handover

**Goal:** Add notification infrastructure if external dependencies allow, then complete regression, production setup and staff handover.

### Day 16 — WhatsApp readiness and configuration
- Confirm the school's WhatsApp Business Platform ownership and access.
- Review consent/eligibility and privacy requirements.
- Prepare English and Hindi template content and provider configuration.
- Confirm billing, approved template identifiers and messaging rules.
- Use test recipients while validating the integration.

### Day 17 — Notification queue and worker
- Create notification job schema and deduplication key.
- Queue one job for each eligible absence after a successfully submitted session.
- Implement bounded worker processing and retry/backoff rules.
- Handle permanent failures without endless retries.
- Keep tokens and phone-number IDs server-side.

### Day 18 — Webhook and notification logs
- Verify webhook requests according to provider requirements.
- Update notification status from provider events.
- Handle repeated and out-of-order events safely.
- Build an admin view for queued/sent/delivered/failed statuses where available.
- Test Hindi/English template parameter ordering and invalid phone handling.

### Day 19 — End-to-end QA and production readiness
- Run complete website, student, login, permissions, attendance and messaging test suites.
- Test common mobile viewport sizes and devices available to the school.
- Check accessibility basics and broken links.
- Verify environment-variable configuration.
- Perform a test backup restoration and review the recovery procedure.
- Resolve critical/high defects; document any accepted known issues.

### Day 20 — Production release and handover
- Deploy the approved production version.
- Verify domain, HTTPS, environment variables and logs.
- Train principal/admin and selected teachers.
- Provide quick-start and troubleshooting documentation.
- Transfer repository/account access according to the client agreement.
- Obtain final acceptance and document any remaining dependencies.

**Week 4 test gate**
- [ ] Core end-to-end regression passes
- [ ] P0/P1 defects are closed
- [ ] Production environment and secrets are reviewed
- [ ] Backup/recovery procedure is documented and tested
- [ ] School has approved the release
- [ ] User training and handover documents are delivered
- [ ] WhatsApp test send/status flow works if external setup is complete
- [ ] If WhatsApp approval is delayed, core app can launch without live notifications

**Release 4 acceptance:** approved deployment, handover and known-issues register.

---

## 11. Weekly Release Process

Every week follows this cycle:

1. **Plan:** confirm tasks and acceptance criteria.
2. **Build:** implement a small set of features on a branch.
3. **Review:** inspect code, migrations, permissions and error handling.
4. **Test:** run automated and manual tests.
5. **Fix:** resolve blockers and regressions.
6. **Preview:** deploy a review version for the client.
7. **Demo:** show completed work and open defects.
8. **Approve:** record written sign-off or action items.
9. **Update roadmap:** record actual status, decisions, dependencies and next week's tasks.

### Git / deployment expectations

- Use small feature branches and pull requests.
- Keep commits focused and descriptive.
- Run lint, TypeScript checks and tests before merging.
- Keep preview and production environment variables separate.
- Do not run unreviewed migrations against production.
- Prefer backward-compatible migrations where practical.
- Tag or otherwise identify each accepted weekly release.
- Maintain a rollback plan for production releases.

---

## 12. Defect Management

Keep a defect register with these fields:

| Field | Description |
|---|---|
| Defect ID | Unique ID, e.g. `BUG-001` |
| Title | Short description |
| Environment | Local, preview/staging, production |
| Steps to reproduce | Exact steps |
| Expected result | Correct behavior |
| Actual result | Observed behavior |
| Severity | P0, P1, P2 or P3 |
| Owner | Person responsible |
| Status | Open, In Progress, Fixed, Retest, Closed, Deferred |
| Fix version | Release where the fix is included |
| Retest evidence | Test result and date |

### Severity definitions

- **P0 — Critical:** data exposure, privilege escalation, major data corruption, or system unusable. Stop the release.
- **P1 — High:** core login, student saving or attendance submission is broken, or attendance is incorrect. Fix before release.
- **P2 — Medium:** important issue with a safe workaround or a report mismatch. Fix before final acceptance where possible.
- **P3 — Low:** minor visual/copy/usability issue. May be scheduled for a later patch with approval.

After any fix:
1. Reproduce the original issue.
2. Apply the fix.
3. Run the targeted test.
4. Run related regression tests.
5. Record evidence and close the defect only after retest.

---

## 13. Testing Strategy

### Website tests
- All navigation and footer links.
- English/Hindi language selection and fallback.
- Mobile navigation, forms and responsive layouts.
- Page titles, metadata, image alt text and basic SEO setup.
- Approved content and images only.
- No private student or guardian data appears in public routes or page metadata.

### Authentication / permission tests
- Valid and invalid login.
- Logout and expired session.
- Password reset as configured.
- Disabled user loses access.
- Teacher changes IDs or URL paths to access an unassigned class.
- Teacher attempts student administration or school settings.
- User attempts to update their own role or school ID.
- Direct data API access is denied if policies do not permit it.

### Student-data tests
- Create/edit/detail/search works.
- Duplicate admission number is rejected.
- Required fields are validated on server and database.
- Class/section mismatch is rejected.
- CSV import detects invalid rows and duplicates.
- Inactive/transferred students are handled correctly.

### Attendance tests
- Correct active roster loads.
- Draft can be saved and reopened.
- Every active student in the session has a valid status before submission, according to school policy.
- Incomplete or unsubmitted sessions are clearly distinguished.
- Duplicate submit and network retry are safe.
- Only authorized teachers/admins can submit/correct.
- Historical records are retained.
- Report totals match persisted records.
- Timezone/date boundaries behave correctly.

### WhatsApp tests
- Only eligible absent records create jobs.
- One job per deduplication key.
- Invalid phone number is rejected or marked failed.
- Retry/backoff is bounded.
- Permanent error does not retry indefinitely.
- Webhook verification works.
- Duplicate/out-of-order callbacks do not corrupt status.
- Hindi and English template parameters are correct.
- No real parent message is sent without school approval.

### Production/recovery tests
- Production environment variables are present and private.
- HTTPS and domain configuration work.
- Logs do not contain tokens or unnecessary student details.
- Backup/restore procedure is tested in a non-production environment.
- School knows how to report defects and urgent incidents.

---

## 14. Security and Privacy Baseline

- Enable RLS for all relevant exposed tables.
- Use explicit policies for each role and operation.
- Verify authorization server-side for every privileged action.
- Treat service-role keys as privileged secrets and never expose them to the client.
- Keep WhatsApp credentials server-only.
- Validate input with Zod and enforce core invariants in PostgreSQL.
- Use transactions for multi-table attendance submission.
- Keep audit history for attendance submission and authorized corrections.
- Minimize data collected about children and guardians.
- Avoid storing unnecessary photos, identity documents or health details.
- Use only approved images and obtain appropriate guardian permission for identifiable student photographs published publicly.
- Confirm school-approved privacy notices, lawful basis/consent, retention and deletion requirements before production launch.
- Limit data exports to authorized roles and the minimum data needed.
- Keep secrets and real personal data out of source control, issue trackers, test fixtures and documentation.
- Define account deactivation, incident reporting, backup retention and service handover procedures.

---

## 15. WhatsApp Notification Rules

Use only the official WhatsApp Business Platform / Cloud API or an authorized provider. Do not automate consumer WhatsApp Web.

### Trigger
- Notification is eligible only after the attendance session is successfully submitted.
- Generate jobs only for students marked absent, and only if recipient eligibility and guardian notification rules are satisfied.

### Example English template draft
> Dear Parent/Guardian, your child {{1}} of Class {{2}} was marked absent at Uttam Niketan School on {{3}}. If you believe this is incorrect, please contact the school office.

### Example Hindi template draft
> प्रिय अभिभावक, आपके बच्चे {{1}} (कक्षा {{2}}) को दिनांक {{3}} को उत्तम निकेतन विद्यालय में अनुपस्थित दर्ज किया गया है। यदि यह जानकारी गलत है, तो कृपया विद्यालय कार्यालय से संपर्क करें।

These are draft messages only. They must be reviewed by the school and submitted through the provider's template approval process before use as approved templates.

### Notification states
Use a controlled state model such as:
`queued → processing → sent → delivered → read`
with failure paths recorded as `failed`. Not every message/provider will report every state.

### Required safeguards
- Store and validate guardian phone numbers with the correct country code.
- Record guardian notification eligibility/consent according to the school's approved process.
- Use an idempotency/deduplication key.
- Retry transient failures with backoff.
- Do not endlessly retry permanent failures.
- Verify webhook signatures/tokens according to provider guidance.
- Record provider message IDs and safe error details.
- Do not include more personal detail than necessary.
- Provide a school-approved process for handling incorrect attendance before messages are sent, where feasible.

---

## 16. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| School content or photos delayed | Website content approval delayed | Assign one school content approver; use clearly labelled placeholders during development |
| Inconsistent paper student records | Import errors and incorrect records | Clean/sample/validate the CSV; school verifies data accuracy |
| Scope increases during development | Four-week timeline becomes unrealistic | Use a change request and prioritize MVP |
| Meta account/template approval delayed | Live messaging unavailable at launch | Start setup early; test using allowed test assets; launch core attendance independently |
| Weak internet or low-end phones | Attendance entry disrupted | Optimize UI, show save state, retry safely; do not promise offline sync unless built/tested |
| Authorization/RLS flaw | Exposure of student or guardian data | Test RLS and server checks before launch; block production on critical defects |
| Inaccurate attendance | Incorrect operations and parent alerts | Require explicit submission, transactions, idempotency, correction audit and roster reconciliation |
| Developer-managed hosting unclear | Unplanned costs or access disputes | Document account ownership, recurring fees, support and handover terms |
| Client feedback is late | Weekly approvals slip | Set a named approver and clear response windows at kick-off |

---

## 17. Roles and Governance

| Role | Responsibilities |
|---|---|
| Developer / project owner | Build, test, deploy, maintain repository, document decisions, track defects and perform handover |
| Principal / client approver | Approve scope, public content, rules, weekly releases and go-live |
| School data coordinator | Prepare and verify student/guardian data before import |
| Pilot teachers | Test roster and attendance workflows and report usability issues |
| Authorized WhatsApp business owner | Own business assets, authorize messaging, handle templates and billing decisions |

### Communication cadence
- Short daily developer task review.
- Weekly client demo and written sign-off.
- Defect review at least twice weekly during Weeks 2–4.
- Written approval for changes that affect budget, deliverables or timeline.
- Record risks and dependencies as soon as they appear.

---

## 18. Handover Deliverables

At the end of the project, prepare:

- Source repository and deployment instructions.
- Database schema overview and migration history.
- Safe process for provisioning the first admin and other accounts.
- Environment-variable inventory (variable names and purposes only; never put secret values in this file).
- Admin and teacher quick-start guides.
- Test results and release notes.
- Known defects and deferred improvements.
- Backup and restoration instructions.
- Ownership and renewal details for the domain, hosting, Supabase and WhatsApp business assets.
- Maintenance/support terms and escalation contact.
- School approval/acceptance record.

---

## 19. Definition of Done

A feature can be marked **Done** only when all applicable conditions are satisfied:

- It meets the written acceptance criteria.
- It works at the intended screen sizes.
- Server-side input validation and authorization are implemented.
- Database constraints/RLS are correct where relevant.
- Loading, empty and error states are handled.
- Targeted tests pass.
- Related regression tests pass.
- Known defects are recorded and prioritized.
- The feature is reviewed in a preview environment.
- Documentation and roadmap status are updated.

A coded but untested feature is **not Done**.

---

## 20. Project Status Tracker

Update these checkboxes as work progresses.

### Week 1 — Foundation
- [ ] Scope confirmed
- [ ] School content and class structure collected
- [ ] Design/wireframes approved
- [x] Next.js repository set up
- [x] Supabase development project created (by project owner, 2026-10-26; migrations not yet applied to it)
- [ ] Vercel preview configured
- [x] Initial database migration tested (40 automated DB tests on a clean PostgreSQL 16 database)
- [x] Public website shell navigable (EN/HI switch, mobile menu; placeholder content clearly labelled)
- [ ] Week 1 release approved

### Week 2 — Website, auth and students
- [ ] All public pages implemented
- [ ] English/Hindi support verified
- [x] Auth and protected routes implemented
- [x] Admin and teacher permission policies tested (DB-level + direct Data API attack tests + browser)
- [x] Student CRUD/search implemented
- [x] Teacher assignments implemented
- [ ] CSV import validated if in scope
- [ ] Week 2 release approved

### Week 3 — Attendance
- [ ] Attendance roster implemented
- [ ] Draft save implemented
- [ ] Transactional submission implemented
- [ ] Duplicate-submit protection verified
- [ ] Correction workflow/audit log implemented
- [ ] Reports reconcile with persisted data
- [ ] Security/permission regression passed
- [ ] Week 3 release approved

### Week 4 — Integration and launch
- [ ] WhatsApp readiness confirmed
- [ ] Template approval/test setup complete if available
- [ ] Notification queue and retries tested
- [ ] Webhook verification/status handling tested
- [ ] Full regression completed
- [ ] P0/P1 defects closed
- [ ] Backup/restore rehearsal completed
- [ ] Production deployment approved
- [ ] School staff trained
- [ ] Handover delivered
- [ ] Final acceptance recorded

---

## 21. Weekly Progress Log

Append one entry at the end of each week. Do not delete earlier entries.

### Week 1
- **Dates:** started 2026-10-26
- **Completed:**
  - Next.js 15 + TypeScript (strict) + Tailwind 4 scaffold, ESLint, Prettier, Vitest; `.env.example`; `npm run check`.
  - Migrations: core schema (schools, profiles, academic years, classes, sections, students, teacher assignments, attendance sessions/records, append-only audit log) with composite foreign keys for school/year consistency, case-insensitive uniqueness, status checks, indexes and no cascading deletes.
  - Migration: RLS on every table, narrowed table grants, private authorization helpers, profile self-escalation protection, and transactional attendance functions (open, save draft, submit, admin correction with audit, lock).
  - Fictional seed data (11 classes, 55 students).
  - Public website shell: header/footer, no-JS mobile menu, English/Hindi switch, homepage and placeholder pages for all public routes, robots.txt and sitemap.
- **Demo / release version:** not yet deployed (Vercel/Supabase projects not created)
- **Tests passed:** lint, typecheck, production build; 43 automated tests (12 schema, 13 RLS, 15 attendance, 3 unit). Mutation check: disabling the active-teacher/active-year checks made 3 tests fail as expected. Browser check of all public routes at 360px and 1280px, no horizontal scroll, language switch persists across pages.
- **Open defects:** none
- **Decisions made:** see Decision Log (2026-10-26 entries)
- **Dependencies / blockers:** GitHub push access for Claude (GitHub App installation); Supabase dev project; Vercel project; school content and confirmations in §3.
- **Approval status:** pending school review of requirements and wireframes

### Week 2
- **Dates:** 2026-10-26 (started early, alongside Week 1 sign-off)
- **Completed:**
  - Day 7 — Supabase SSR auth: email/password login, logout, middleware session refresh and redirect, protected staff routes, safe `?next=` handling, disabled-account sign-out, no public sign-up, `scripts/create-admin.mjs` for the first admin.
  - Day 8 — `requireStaff` / `requireAdmin` on every protected page and action (teachers get 404 on admin pages), role-filtered navigation, safe database-error messages, direct Data API attack tests.
  - Day 9 — Students: search (name/admission no.), class-section and status filters, pagination, add/edit with Zod validation, server-derived class/school, Indian mobile normalisation to E.164, duplicate admission/roll number messages on the field, guardian consent checkbox. Teachers get a read-only view of their own sections without guardian contact details.
  - Day 10 — Staff page (admin): create teacher/admin accounts with a one-time temporary password, disable/re-enable (also blocks Auth sign-in), reset password, assign/unassign sections for the active year.
  - Local Supabase stack (Docker) used for real end-to-end testing; generated database types; dev-only user seeding script that refuses non-local targets.
- **Demo / release version:** not yet deployed (Vercel project and hosted migrations pending)
- **Tests passed:** lint, typecheck, production build; 79 automated tests (40 DB, 11 direct Data API, 28 unit). Browser end-to-end checks on a 390px viewport: login errors, open-redirect attempt, admin vs teacher dashboards, student create/validation/duplicate/edit, teacher 404 on admin pages, staff create/duplicate email/assign/duplicate assignment, disabled teacher kicked out on next request, password reset invalidates the old password.
- **Open defects:** none open. Fixed during the week: active-year filter used a non-existent sections→academic_years relationship (500 on /students); local config disabled email login entirely.
- **Decisions made:** see Decision Log (Week 2 entries)
- **Dependencies / blockers:** apply migrations to the hosted Supabase project; Vercel project + environment variables; disable sign-ups in hosted Auth settings; CSV import scope; school confirmation of required student fields.
- **Approval status:** pending school demo

### Week 3
- **Dates:**
- **Completed:**
- **Demo / release version:**
- **Tests passed:**
- **Open defects:**
- **Decisions made:**
- **Dependencies / blockers:**
- **Approval status:**

### Week 4
- **Dates:**
- **Completed:**
- **Production release/version:**
- **Tests passed:**
- **Known remaining defects:**
- **Handover items completed:**
- **Client acceptance status:**

---

## 22. Defect Register

Add one row per issue. Do not include real student details or secrets.

| ID | Title | Priority | Environment | Status | Owner | Fix version / retest |
|---|---|---|---|---|---|---|
| BUG-001 | /students returned 500: active-year filter joined sections→academic_years directly (no such relationship) | P1 | Local | Closed | Developer | Fixed on week-2 branch; browser retest passed 2026-10-26 |
| BUG-002 | Local Supabase config disabled email login entirely when turning off sign-ups | P1 | Local | Closed | Developer | Fixed in supabase/config.toml; login + blocked sign-up verified 2026-10-26 |

---

## 23. Decision Log

Record significant decisions and why they were made.

| Date | Decision | Reason / impact | Approved by |
|---|---|---|---|
| YYYY-MM-DD | Use responsive web app/PWA rather than native Android for MVP | Faster delivery and one codebase for desktop/mobile | Project baseline |
| YYYY-MM-DD | Deliver attendance before live WhatsApp messaging | Core school workflow remains useful if external messaging approval is delayed | Project baseline |
| 2026-10-26 | Attendance is written only through security-definer database functions; clients have read-only access to attendance tables | Keeps roster validation, idempotent submit and auditing in one transactional place that cannot be bypassed through the API | Developer (technical) |
| 2026-10-26 | Provisional correction policy: teachers edit drafts only; after submission only an admin can correct, with a mandatory reason, until the session is locked | Safe default until the school confirms its correction rules (§3) | Pending school confirmation |
| 2026-10-26 | Teachers' access is limited to sections assigned in the active academic year; deactivated profiles lose all access immediately | Matches §7; prevents stale access after year change or staff departure | Developer (technical) |
| 2026-10-26 | Public site language is chosen with a cookie-based switch on the same URLs (default English) | Simple, works without JavaScript and keeps the agreed routes. Trade-off: Hindi pages are not separately indexed by search engines; can move to /hi/ URLs later if SEO for Hindi matters | Pending school confirmation of default language |
| 2026-10-26 | Notification queue table deferred to the Week 4 migration | Keeps Week 1–3 focused on the core; submit function already records absent counts for the audit trail | Developer (technical) |
| 2026-10-26 | Guardian phone stored in E.164 format; guardian notification consent stored per student (default false) | Required for WhatsApp later; consent defaults to no messaging | Developer (technical) |
| 2026-10-26 | Provisional class list: Nursery, LKG, UKG, Class 1–8, one section "A" each (seed only) | Placeholder until the school confirms class/section naming | Pending school confirmation |
| 2026-10-26 | Staff sign in with email + password; accounts created only by an admin (temporary password shown once); no public sign-up | Matches "no public self-registration"; works without an email service. Phone/OTP login can be added later if teachers lack email | Pending school confirmation |
| 2026-10-26 | Disabling a staff account sets `is_active = false` and bans the Auth user | App and RLS deny disabled profiles on every request; the ban also stops sign-in and token refresh | Developer (technical) |
| 2026-10-26 | Login shows one error for unknown email, wrong password and disabled account | Supabase reveals bans even with a wrong password, so a specific message would expose which emails are disabled accounts | Developer (security) |
| 2026-10-26 | Teachers see students in their sections but the teacher UI hides guardian contact details | Data minimisation. RLS still allows teachers to read those columns via the API; a column-level restriction (view or column grants) is a candidate hardening task | Pending school confirmation of what teachers need |
| 2026-10-26 | Staff app is English-only for the MVP; the public website stays bilingual | Keeps Week 2–3 focused on the core workflow; Hindi staff UI would be a change request if teachers need it | Pending school confirmation |
| 2026-10-26 | CSV student import not built yet | Roadmap marks it "if in accepted scope"; not yet confirmed | Pending school confirmation |

---

## 24. Change Request Template

Use this before agreeing to work beyond the MVP.

- **Request ID:**
- **Requested by:**
- **Date:**
- **Description:**
- **Why needed:**
- **Affected screens/tables/APIs:**
- **Security/privacy impact:**
- **Estimated effort:**
- **Timeline impact:**
- **Cost impact:**
- **Decision:** Approved / Deferred / Rejected
- **Approver:**

Do not silently add new requirements to the current four-week delivery.

---

## 25. Immediate Next Actions

1. Confirm the actual start date and appoint the school's single point of contact/approver.
2. Obtain approved public website content, contact information and logo.
3. Obtain a sanitized sample of the paper student register (no unnecessary real personal data) and confirm the class/section structure.
4. Agree attendance submission and correction rules.
5. Create the GitHub repository and Supabase development project.
6. Inspect the current starter files and make the database migration reproducible.
7. Implement authentication/RLS and verify permissions before importing real student data.
8. Finish and test student management.
9. Implement and verify transactional attendance.
10. Start or continue WhatsApp setup independently, but enable live messaging only after attendance testing, provider setup, template approval and school authorization.

---

## Final Project Principle

**Deliver a small, reliable, secure release each week. Test it, fix defects, get approval, and then proceed.** The priority order is database integrity, authentication/permissions, student records, attendance, regression testing, and then live WhatsApp messaging. The public website progresses alongside these core app milestones. The four-week roadmap is a target, and any external approval or scope change must be documented instead of hidden.
