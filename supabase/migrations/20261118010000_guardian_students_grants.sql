-- Uttam Niketan: fix missing INSERT/DELETE grants on guardian_students
--
-- 20261117000300_guardians.sql granted only SELECT on public.guardian_students
-- to authenticated, but also defined guardian_students_insert_admin and
-- guardian_students_delete_admin RLS policies expecting an admin to insert/
-- delete via their own session. A base table GRANT is checked before RLS, so
-- without this, the real /parents screen's "link a child" and "unlink"
-- actions (src/app/(dashboard)/parents/actions.ts, linkStudent/unlinkStudent)
-- fail with "permission denied for table guardian_students" for every admin,
-- even though the RLS policies themselves are correct. Found via direct RLS
-- impersonation testing against the live database, 2026-11-18 — the feature
-- had never been exercised end-to-end before this (built without a local
-- Supabase stack in the prior session).
--
-- The RLS policies already correctly scope this to admins of the student's
-- own school; this grant only removes the privilege-layer block in front of
-- them, it does not widen who can actually perform the insert/delete.

grant insert, delete on public.guardian_students to authenticated;
