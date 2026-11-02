---
name: ship-feature
description: The Uttam Niketan workflow for building a roadmap item end to end — plan against docs/PROJECT_ROADMAP.md, implement with server-side authorization and RLS, test, browser-check, update the roadmap logs, and commit/push. Use when starting or finishing any roadmap day/week, feature, or bug fix in this repo.
---

# Shipping a feature on Uttam Niketan

## Before coding

1. Read the relevant week/day in `docs/PROJECT_ROADMAP.md` and the **Status** in `CLAUDE.md`.
2. State Goal, Scope (files, tables, routes, roles), Security, Tests and Acceptance criteria.
3. If the request goes beyond the MVP (§4.4) or changes an agreed decision, stop and raise a change
   request (§24) with the timeline impact. Do not build it silently.
4. Work on a branch such as `week-3-attendance`.

## While building

- **Database:** add a new migration file; never edit an applied one. Keep composite foreign keys for
  school/year consistency, avoid `on delete cascade`, and enable RLS with explicit per-operation
  policies. Put multi-table writes in `security definer` functions with `set search_path = ''`,
  which derive the user from `auth.uid()`. Then run `npm run gen:types`.
- **Server code:** call `requireStaff()` or `requireAdmin()` first in every page and server action.
  Validate with Zod (`src/lib/validation/`). Derive `school_id`, class and user ids on the server,
  never from the form. Map errors with `describeDbError` and never show raw database text.
- **UI:** mobile-first, tap targets at least 44px (`min-h-11`/`min-h-12`). Show loading, empty,
  error and success states. Confirm before destructive or finalizing actions.
- **Data:** fictional data only. No guardian contact details in teacher views unless the school
  approves it.

## Definition of Done (roadmap §19)

- [ ] Unit tests for validation/helpers; DB tests (`tests/db`) for constraints, RLS and functions.
- [ ] `test:api` updated if permissions changed; it must cover teacher-vs-admin and disabled users.
- [ ] Browser check of the happy path, validation errors, and a teacher trying admin-only URLs
      (see the `local-stack` skill).
- [ ] `npm run check` and `npm run build` pass.
- [ ] To prove a new test can fail, temporarily break the rule it covers, watch it fail, then revert.

## Wrap-up

1. Update `docs/PROJECT_ROADMAP.md`:
   - Status tracker checkboxes and **Current phase**.
   - Weekly Progress Log: what was completed, test counts, open defects, blockers.
   - Defect Register: every real bug found, including fixed ones, with retest evidence.
   - Decision Log: technical choices plus anything still pending school confirmation.
2. Update the **Status** section in `CLAUDE.md`.
3. Commit in logical pieces with the attribution trailer. Check that no `.env*` file except
   `.env.example` is tracked. Push the branch, and merge to `main` (fast-forward) only when the
   user asks.
4. Report to the user what was built, what was verified (with numbers), what was not, and what is
   waiting on them or the school.

## Deploying

Merging to `main` and pushing deploys production. Then poll Vercel (`list_deployments` for project
`uttam_niketan`, then `list_deployment_events`) until the deployment is READY and owns the
`uttamniketan.vercel.app` alias, and tell the user to hard-refresh. A new migration also has to be
added to `docs/handover/setup-guide.md` and run by the owner in the hosted Supabase SQL Editor.

Pushing any branch also builds a Vercel preview at
`https://uttamniketan-git-<branch>-aksundram44-9592s-projects.vercel.app` (needs a Vercel login);
use it when the owner asks to "deploy for review". Hobby builds run one at a time, so production can
sit QUEUED behind a preview. If a build fails in `next/font`, check the Node version in the build log
(`engines.node` must stay `22.x`).

Never force-push or rebase pushed branches (the auto-mode classifier blocks it); to bring `main`
into a feature branch, merge instead. Session notes go on the current feature branch unless the
owner has asked to merge.
