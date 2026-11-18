-- Uttam Niketan: guardian read-only access to their own child's attendance
-- Phase 3 of docs/ERP_ARCHITECTURE.md §18. Guardians never get a broad grant
-- here -- scoped exactly to their own linked children via
-- private.is_guardian_of(), the helper built for this in
-- 20261117000300_guardians.sql. Base SELECT grants already exist on both
-- tables for `authenticated` (verified live before writing this, same check
-- that caught the missing guardian_students grant earlier) -- only the RLS
-- policies need extending.
--
-- src/services/attendance.ts's existing getStudentHistory(studentId, from)
-- already filters to submitted/locked sessions only (the same invariant
-- staff reports already enforce) and needs no changes -- it works unmodified
-- for a guardian caller once RLS allows the read.

drop policy attendance_records_select on public.attendance_records;
create policy attendance_records_select on public.attendance_records
  for select to authenticated
  using (
    exists (
      select 1 from public.attendance_sessions s
      where s.id = attendance_records.session_id
        and (
          (s.school_id = (select private.current_school_id()) and (select private.is_office_or_admin()))
          or private.is_assigned_to_section(s.section_id)
        )
    )
    or private.is_guardian_of(attendance_records.student_id)
  );

drop policy attendance_sessions_select on public.attendance_sessions;
create policy attendance_sessions_select on public.attendance_sessions
  for select to authenticated
  using (
    (school_id = (select private.current_school_id()) and (select private.is_office_or_admin()))
    or private.is_assigned_to_section(section_id)
    or exists (
      select 1 from public.attendance_records ar
      where ar.session_id = attendance_sessions.id
        and private.is_guardian_of(ar.student_id)
    )
  );
