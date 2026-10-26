# Production setup: step by step

Takes about 20 minutes. You need: the Vercel account, and the Supabase project that Vercel's
Supabase integration created. No terminal is required.

## Step 1 — Open the Supabase project

1. Go to https://vercel.com → project **uttam_niketan** → **Storage** tab.
2. Click the Supabase database → **Open in Supabase**. The Supabase dashboard opens on the right project.

## Step 2 — Create the database tables (3 files, in order)

In Supabase: left menu **SQL Editor** → **New query**. For each file below, in this order:
open the link, click **Raw**, select all and copy, paste into the SQL Editor, click **Run**, and wait
for "Success. No rows returned".

1. `supabase/migrations/20261026000100_core_schema.sql`
2. `supabase/migrations/20261026000200_auth_rls_attendance.sql`
3. `supabase/migrations/20261026000300_absence_notifications.sql`

(Files are in the GitHub repo `bugs101196/uttam_niketan`. Use a new query tab for each file.)

If a file shows an error, stop and send the error text to the developer. Do not run the next file.

## Step 3 — Create the school, year and classes

Same way, run `supabase/setup/01-school.sql`. The result lists 11 classes (Nursery to Class 8, section A).
Class names and sections can be changed later in the app (**Settings → Classes & academic year**), so the default list is fine to start with.

## Step 4 — Turn off public sign-up

Supabase: **Authentication** → **Sign In / Providers**:

- Turn **off** "Allow new users to sign up". Click **Save**.
- Leave the **Email** provider enabled; staff sign in with it.

Then **Authentication** → **URL Configuration** → **Site URL**: `https://uttamniketan.vercel.app` → **Save**.

## Step 5 — Create the principal's login

1. Supabase: **Authentication** → **Users** → **Add user** → **Create new user**.
2. Enter the principal's email and a strong password, tick **Auto Confirm User**, and click
   **Create user**.
3. **SQL Editor** → new query → paste `supabase/setup/02-principal-profile.sql`.
   - Replace `PRINCIPAL FULL NAME` with the principal's name.
   - Replace `principal@example.com` with the email from step 2.
4. Click **Run**. The result shows one row with role **admin**.

## Step 6 — Add the cron secret in Vercel

1. Make a long random value. Any password generator works; on a Mac, Terminal: `openssl rand -hex 32`.
2. Vercel → **uttam_niketan** → **Settings** → **Environment Variables** → **Add**:
   Key `CRON_SECRET`, Value = that random text, Environment **Production**, mark it **Sensitive**, and
   **Save**.
3. **Deployments** → latest production deployment → **⋯** → **Redeploy**.

## Step 7 — Check that it works

1. Open https://uttamniketan.vercel.app/login and sign in as the principal.
2. The **Dashboard** shows 0 students, 11 sections and 0 teachers.
3. **Staff** → add one teacher → assign them to a section. Note the temporary password shown.
4. **Students** → add one test student in that section.
5. Sign out and sign in as the teacher, then take attendance for that section.
6. Sign back in as the principal. **Reports** shows the day.

If any step fails, note the step number and the message on screen.

## Afterwards

- Delete the test student (set **Enrolment status** to _Inactive_), or keep them if useful for training.
- Add real teachers and students. WhatsApp alerts stay off until `docs/whatsapp-templates.md` is complete.
