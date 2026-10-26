# Uttam Niketan — Operations runbook

For the developer or whoever maintains the system. No secret values belong in this file.

## Systems and ownership

| Component                | Where                                                         | Notes                                                           |
| ------------------------ | ------------------------------------------------------------- | --------------------------------------------------------------- |
| Source code              | GitHub `bugs101196/uttam_niketan` (private)                   | `main` = production                                             |
| Hosting                  | Vercel project `uttam_niketan` (Hobby plan)                   | Every push to `main` deploys to https://uttamniketan.vercel.app |
| Database + staff login   | Supabase project linked through Vercel's Supabase integration | Postgres, Auth, Row Level Security                              |
| WhatsApp (when approved) | School's Meta Business account + WhatsApp Business number     | See `docs/whatsapp-templates.md`                                |
| Domain (optional)        | Not set up yet                                                | Add in Vercel → Domains, then update `NEXT_PUBLIC_SITE_URL`     |

Record in the client agreement who owns each account, who pays (Vercel, Supabase, domain, Meta
message fees) and when they renew. Transfer ownership to the school's accounts at handover if agreed.

## Environment variables (Vercel → Settings → Environment Variables, Production)

| Name                            | Required      | Purpose                                                     |
| ------------------------------- | ------------- | ----------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | yes           | Supabase API URL (public)                                   |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes           | Supabase anon key (public; access controlled by RLS)        |
| `SUPABASE_SERVICE_ROLE_KEY`     | yes           | **Secret.** Staff account management and the message worker |
| `NEXT_PUBLIC_SITE_URL`          | yes           | Public site URL for metadata and sitemap                    |
| `CRON_SECRET`                   | recommended   | **Secret.** Authenticates the daily notification run        |
| `WHATSAPP_*`                    | when approved | See `docs/whatsapp-templates.md`                            |

Never prefix a secret with `NEXT_PUBLIC_`. After changing variables, redeploy (Deployments → ⋯ →
Redeploy) for them to take effect.

## First production setup (one time)

1. Apply the database migrations to the hosted Supabase project (from a checkout of `main`):
   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase db push            # add --include-seed only for a demo/test project
   ```
2. Supabase dashboard → Authentication → Sign In / Providers → turn **off** "Allow new users to sign up".
3. Create the principal's account (needs `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in
   `.env.local`):
   ```bash
   node --env-file=.env.local scripts/create-admin.mjs --email principal@school.example --name "Principal Name"
   ```
4. In Vercel add `CRON_SECRET` (any long random value, e.g. `openssl rand -hex 32`) and redeploy.
5. Sign in as the principal, create classes and sections for the real academic year, then teacher
   accounts and assignments.

## Releasing a change

1. Work on a branch; run `npm run check`, plus `npm run test:api` against a local stack for auth/RLS
   changes (see `.claude/skills/local-stack/SKILL.md`).
2. Database changes: add a **new** file in `supabase/migrations/`, test locally, then
   `npx supabase db push` to production **before** merging code that needs it.
3. Merge to `main` → Vercel deploys automatically. Check the deployment and **Logs** in Vercel.
4. Rollback: Vercel → Deployments → previous deployment → **Promote to Production** (instant).
   Database migrations are not rolled back automatically; write a new migration to undo a change.

## Backups and restore

**Before go-live, decide the backup level with the school.** Supabase's free plan does not include
downloadable daily backups; the Pro plan does. Independently of the plan, take a manual backup at least
weekly and before every database migration:

```bash
# Uses the project linked with `supabase link`. Keep these files private: they contain student data.
npx supabase db dump -f backup/roles.sql --role-only
npx supabase db dump -f backup/schema.sql
npx supabase db dump -f backup/data.sql --use-copy --data-only
```

Store the files encrypted (e.g. in the school's Google Drive with restricted sharing), never in GitHub.

**Restore into a new Supabase project** (e.g. after data loss):

```bash
psql --single-transaction --variable ON_ERROR_STOP=1 \
  --file backup/roles.sql --file backup/schema.sql \
  --command 'SET session_replication_role = replica' \
  --file backup/data.sql \
  --dbname "<new project connection string>"
```

Then update the Supabase URL and keys in Vercel and redeploy.

**Rehearsal, 2026-10-26 (local Supabase, PostgreSQL 17):**

- Full logical dump (`pg_dump -Fc`, 0.5 MB) restored into a fresh database.
- Row counts identical for all 9 checked tables, including `auth.users`. Content checksums identical for
  `students` and `attendance_records`.
- RLS still on for every table. All 141 grants and policies identical.
- A teacher still saw only their own section, and the audit log was still append-only.
- `pg_restore` reported 42 errors, all on Supabase-managed objects (default privileges of Supabase admin
  roles, the realtime/vault schemas, server parameters). None touched the app's schemas. A restore into a
  Supabase project with the commands above handles those objects itself.

## Monitoring and incidents

- **Errors**: Vercel → Project → Logs (filter by error) and Observability.
- **Notification problems**: Settings → Message log in the app (failed rows show the reason).
- **Suspected data exposure or account compromise** (P0):
  1. Disable the affected staff accounts on the **Staff** page.
  2. Rotate `SUPABASE_SERVICE_ROLE_KEY` in Supabase (Settings → API) and update Vercel; rotate WhatsApp
     tokens if involved.
  3. Review `audit_logs` and Vercel logs, inform the principal, and record the incident.
- **Site down**: check Vercel status and the latest deployment; promote the previous deployment if a
  release caused it.

## Support

- Developer contact: Ashutosh (GitHub `bugs101196`). Fill in phone/email and support hours per the
  client agreement.
- School reports issues with: page, time, what was clicked, and a screenshot (no passwords).
