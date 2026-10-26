---
name: local-stack
description: Start and use the local Uttam Niketan dev stack (Supabase in Docker, dev users, Next.js dev server), run the database/API/unit tests, and drive the app in a headless browser for end-to-end checks. Use before testing auth, RLS, students, staff or attendance changes, or when asked to run, demo or screenshot the app.
---

# Local stack for Uttam Niketan

## 1. Supabase (Postgres + Auth + Data API)

```bash
npx supabase status || npx supabase start -x realtime,storage-api,imgproxy,studio,edge-runtime,logflare,vector,supavisor,postgres-meta,mailpit
```

- Migrations in `supabase/migrations/` and `supabase/seed.sql` apply automatically on start.
  `npx supabase db reset` reapplies them from scratch (wipes local data).
- **Cloud containers:** the Docker daemon may not be running. Start it with
  `(nohup dockerd > /var/tmp/dockerd.log 2>&1 &)`, then wait about 8s. The default image registry
  (public.ecr.aws) can be blocked by the proxy, so prefix the start command with
  `SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io`. Docker Hub sometimes returns 429; retry
  `docker pull <image>` with a growing wait rather than looping fast.
- `.env.local` (git-ignored) holds the local URL and keys; get them from `npx supabase status`.
  The local keys are Supabase's public demo keys and are not secrets.
- After a schema change: `npm run gen:types`.

## 2. Dev users

```bash
node --env-file=.env.local scripts/seed-dev-users.mjs
```

Password for all of them: `dev-password-123`. The script refuses to run against a non-local URL.

| Email                 | Role               | Sections                 |
| --------------------- | ------------------ | ------------------------ |
| admin@example.test    | admin              | all                      |
| teacher1@example.test | teacher            | Class 1 – A              |
| teacher2@example.test | teacher            | Class 2 – A, Class 3 – A |
| disabled@example.test | teacher (disabled) | Class 1 – A              |

## 3. Tests

```bash
npm run check                    # lint + typecheck + unit + db tests
K=$(grep ANON_KEY .env.local | cut -d= -f2)
SUPABASE_API_TEST_URL=http://127.0.0.1:54321 SUPABASE_API_TEST_ANON_KEY=$K npm run test:api
```

- `test:db` builds a throwaway database `uttam_niketan_test` from the migrations, using
  `TEST_DATABASE_ADMIN_URL` (defaults to the local Supabase Postgres on 54322).
- `test:api` attacks the real Data API as anon/teacher/disabled/admin users. Run it whenever auth,
  RLS or grants change. Do not hard-code row counts there; browser QA adds data.

## 4. Browser checks (Playwright is preinstalled in cloud containers)

```bash
(nohup npx next dev -p 3200 > /var/tmp/next-dev.log 2>&1 &) ; sleep 8
```

Write throwaway Playwright scripts in the scratchpad, not the repo. Pitfalls:

- Scope submit clicks to the page form (`main button[type=submit]`): the header **Sign out** button
  is also a submit button and comes first.
- `[role=alert]` also matches Next's route announcer; use `form [role=alert]` / `main [role=status]`.
- After a successful action React resets the form; reselect values before submitting again.
- Use unique names (e.g. `Date.now()`) for records you create; local data persists between runs.
- Check phone width (390px) and that `document.documentElement.scrollWidth` equals the viewport width.

To stop the dev server, never use `pkill -f <pattern>`: the pattern also matches your own shell and
kills it. Use
`ps -eo pid,args | awk '$2 ~ /^next-server/ {print $1}' | xargs -r kill`, which matches only the server
process's own name. Run it as its own command, not in the same line that started the server.
