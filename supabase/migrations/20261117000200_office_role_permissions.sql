-- Uttam Niketan: let office staff take attendance and view school-wide
-- students/attendance, without admin's financial/settings/staff access.
-- See docs/ERP_ARCHITECTURE.md §5 (role-permission matrix) and §8.2.
--
-- Deliberately unchanged, still admin-only: correcting submitted attendance
-- (correct_attendance_record), locking sessions (lock_attendance_session),
-- audit log visibility, and every write to students/academic_years/classes/
-- sections/profiles/teacher_assignments/settings.

create function private.is_office_or_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.is_active and p.role in ('admin', 'office')
  );
$$;

grant execute on function private.is_office_or_admin() to authenticated;

-- Admin or office staff of the section's school, or a teacher assigned to it.
create or replace function private.can_take_attendance(p_section_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1 from public.sections s
      where s.id = p_section_id
        and s.school_id = private.current_school_id()
        and private.is_office_or_admin()
    )
    or private.is_assigned_to_section(p_section_id);
$$;

-- students: school-wide read now includes office, not just admin.
drop policy students_select_admin on public.students;
create policy students_select_office_or_admin on public.students
  for select to authenticated
  using (school_id = (select private.current_school_id()) and (select private.is_office_or_admin()));

-- attendance_sessions / attendance_records: same broadening for the
-- school-wide read branch; the assigned-teacher branch is unchanged.
drop policy attendance_sessions_select on public.attendance_sessions;
create policy attendance_sessions_select on public.attendance_sessions
  for select to authenticated
  using (
    (school_id = (select private.current_school_id()) and (select private.is_office_or_admin()))
    or private.is_assigned_to_section(section_id)
  );

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
  );
