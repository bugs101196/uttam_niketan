-- Uttam Niketan: authorization helpers, Row Level Security and attendance workflow
-- See docs/PROJECT_ROADMAP.md §6 (attendance invariants) and §7 (roles and permissions).
--
-- Model:
--   * Every table has RLS enabled. Anonymous users can read nothing.
--   * Admins see and manage everything in their own school.
--   * Teachers see only their own profile, their assignments, and students /
--     attendance for sections they are assigned to in the active academic year.
--   * Attendance is never written directly. Clients call the security-definer
--     functions below, which derive the acting user from auth.uid(), check
--     permissions, validate the roster and write atomically.

-- ---------------------------------------------------------------------------
-- Authorization helpers (private schema: not exposed through the Data API)
-- Security definer so they can read profiles without recursing through RLS.
-- ---------------------------------------------------------------------------

create function private.current_school_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.school_id
  from public.profiles p
  where p.id = (select auth.uid()) and p.is_active;
$$;

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.is_active and p.role = 'admin'
  );
$$;

-- True when the current user is an active teacher assigned to the section
-- for the school's active academic year.
create function private.is_assigned_to_section(p_section_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.teacher_assignments ta
    join public.profiles p on p.id = ta.teacher_id
    join public.academic_years ay on ay.id = ta.academic_year_id
    where ta.section_id = p_section_id
      and ta.teacher_id = (select auth.uid())
      and p.is_active
      and p.role = 'teacher'
      and ay.is_active
  );
$$;

-- Admin of the section's school, or a teacher assigned to it.
create function private.can_take_attendance(p_section_id uuid)
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
        and private.is_admin()
    )
    or private.is_assigned_to_section(p_section_id);
$$;

grant usage on schema private to authenticated;
revoke all on all functions in schema private from public, anon;
grant execute on function
  private.current_school_id(),
  private.is_admin(),
  private.is_assigned_to_section(uuid),
  private.can_take_attendance(uuid)
to authenticated;

-- ---------------------------------------------------------------------------
-- Profile protection: nobody changes their own role, school or active status,
-- and a profile can never move between schools.
-- ---------------------------------------------------------------------------

create function private.protect_profile_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.school_id is distinct from old.school_id then
    raise exception 'A profile cannot change school' using errcode = '42501';
  end if;
  if new.id = (select auth.uid())
     and (new.role is distinct from old.role or new.is_active is distinct from old.is_active) then
    raise exception 'You cannot change your own role or active status' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_fields
  before update on public.profiles
  for each row execute function private.protect_profile_fields();

-- ---------------------------------------------------------------------------
-- Table privileges
-- Supabase grants broad privileges to anon/authenticated by default; narrow
-- them so that RLS is a second line of defence, not the only one.
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;

grant select, update on public.schools to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.academic_years to authenticated;
grant select, insert, update, delete on public.classes to authenticated;
grant select, insert, update, delete on public.sections to authenticated;
grant select, insert, update on public.students to authenticated;
grant select, insert, delete on public.teacher_assignments to authenticated;
-- Attendance and audit are read-only for clients; writes go through functions.
grant select on public.attendance_sessions to authenticated;
grant select on public.attendance_records to authenticated;
grant select on public.audit_logs to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.schools enable row level security;
alter table public.profiles enable row level security;
alter table public.academic_years enable row level security;
alter table public.classes enable row level security;
alter table public.sections enable row level security;
alter table public.students enable row level security;
alter table public.teacher_assignments enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.attendance_records enable row level security;
alter table public.audit_logs enable row level security;

-- schools
create policy schools_select_staff on public.schools
  for select to authenticated
  using (id = (select private.current_school_id()));

create policy schools_update_admin on public.schools
  for update to authenticated
  using (id = (select private.current_school_id()) and (select private.is_admin()))
  with check (id = (select private.current_school_id()));

-- profiles: own row, or every row in the school for admins.
-- New profiles are provisioned server-side with the service role.
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or (school_id = (select private.current_school_id()) and (select private.is_admin()))
  );

create policy profiles_update_admin on public.profiles
  for update to authenticated
  using (school_id = (select private.current_school_id()) and (select private.is_admin()))
  with check (school_id = (select private.current_school_id()));

-- academic_years / classes / sections: readable by staff, managed by admins.
create policy academic_years_select_staff on public.academic_years
  for select to authenticated
  using (school_id = (select private.current_school_id()));

create policy academic_years_write_admin on public.academic_years
  for all to authenticated
  using (school_id = (select private.current_school_id()) and (select private.is_admin()))
  with check (school_id = (select private.current_school_id()) and (select private.is_admin()));

create policy classes_select_staff on public.classes
  for select to authenticated
  using (school_id = (select private.current_school_id()));

create policy classes_write_admin on public.classes
  for all to authenticated
  using (school_id = (select private.current_school_id()) and (select private.is_admin()))
  with check (school_id = (select private.current_school_id()) and (select private.is_admin()));

create policy sections_select_staff on public.sections
  for select to authenticated
  using (school_id = (select private.current_school_id()));

create policy sections_write_admin on public.sections
  for all to authenticated
  using (school_id = (select private.current_school_id()) and (select private.is_admin()))
  with check (school_id = (select private.current_school_id()) and (select private.is_admin()));

-- students
create policy students_select_admin on public.students
  for select to authenticated
  using (school_id = (select private.current_school_id()) and (select private.is_admin()));

create policy students_select_assigned_teacher on public.students
  for select to authenticated
  using (private.is_assigned_to_section(section_id));

create policy students_insert_admin on public.students
  for insert to authenticated
  with check (school_id = (select private.current_school_id()) and (select private.is_admin()));

create policy students_update_admin on public.students
  for update to authenticated
  using (school_id = (select private.current_school_id()) and (select private.is_admin()))
  with check (school_id = (select private.current_school_id()) and (select private.is_admin()));

-- teacher_assignments
create policy teacher_assignments_select on public.teacher_assignments
  for select to authenticated
  using (
    teacher_id = (select auth.uid())
    or (school_id = (select private.current_school_id()) and (select private.is_admin()))
  );

create policy teacher_assignments_insert_admin on public.teacher_assignments
  for insert to authenticated
  with check (school_id = (select private.current_school_id()) and (select private.is_admin()));

create policy teacher_assignments_delete_admin on public.teacher_assignments
  for delete to authenticated
  using (school_id = (select private.current_school_id()) and (select private.is_admin()));

-- attendance (read-only for clients)
create policy attendance_sessions_select on public.attendance_sessions
  for select to authenticated
  using (
    (school_id = (select private.current_school_id()) and (select private.is_admin()))
    or private.is_assigned_to_section(section_id)
  );

create policy attendance_records_select on public.attendance_records
  for select to authenticated
  using (
    exists (
      select 1 from public.attendance_sessions s
      where s.id = attendance_records.session_id
        and (
          (s.school_id = (select private.current_school_id()) and (select private.is_admin()))
          or private.is_assigned_to_section(s.section_id)
        )
    )
  );

-- audit_logs: admins of the school only
create policy audit_logs_select_admin on public.audit_logs
  for select to authenticated
  using (school_id = (select private.current_school_id()) and (select private.is_admin()));

-- ---------------------------------------------------------------------------
-- Attendance workflow functions
-- Errors use SQLSTATE codes the API layer maps to HTTP responses:
--   42501 forbidden, P0002 not found, 22023 invalid input, 55000 wrong state.
-- ---------------------------------------------------------------------------

-- Open (or fetch) the session for a section and date. Idempotent: calling it
-- twice returns the same session.
create function public.open_attendance_session(p_section_id uuid, p_date date)
returns public.attendance_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_section public.sections;
  v_year public.academic_years;
  v_today date;
  v_session public.attendance_sessions;
begin
  if (select auth.uid()) is null or not private.can_take_attendance(p_section_id) then
    raise exception 'Not allowed to take attendance for this section' using errcode = '42501';
  end if;

  select * into v_section from public.sections where id = p_section_id;
  select * into v_year from public.academic_years where id = v_section.academic_year_id;
  select (now() at time zone sc.timezone)::date into v_today
  from public.schools sc where sc.id = v_section.school_id;

  if p_date is null or p_date > v_today then
    raise exception 'Attendance cannot be taken for a future date' using errcode = '22023';
  end if;
  if p_date < v_year.start_date or p_date > v_year.end_date then
    raise exception 'Date is outside the academic year' using errcode = '22023';
  end if;

  insert into public.attendance_sessions (school_id, section_id, attendance_date, created_by)
  values (v_section.school_id, p_section_id, p_date, (select auth.uid()))
  on conflict (section_id, attendance_date) do nothing;

  select * into v_session
  from public.attendance_sessions
  where section_id = p_section_id and attendance_date = p_date;

  return v_session;
end;
$$;

-- Validate a JSON array of {student_id, status} against the session's roster
-- and upsert the records. Internal helper; callers check permissions and state.
create function private.upsert_attendance_records(
  p_session public.attendance_sessions,
  p_records jsonb
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_records is null or jsonb_typeof(p_records) <> 'array' then
    raise exception 'records must be a JSON array' using errcode = '22023';
  end if;

  create temporary table if not exists pg_temp.incoming_attendance (
    student_id uuid,
    status public.attendance_status
  ) on commit drop;
  truncate pg_temp.incoming_attendance;

  begin
    insert into pg_temp.incoming_attendance (student_id, status)
    select (r ->> 'student_id')::uuid, (r ->> 'status')::public.attendance_status
    from jsonb_array_elements(p_records) r;
  exception when invalid_text_representation then
    raise exception 'Invalid student_id or status in records' using errcode = '22023';
  end;

  if exists (select 1 from pg_temp.incoming_attendance where student_id is null or status is null) then
    raise exception 'Each record needs a student_id and status' using errcode = '22023';
  end if;

  if exists (
    select 1 from pg_temp.incoming_attendance group by student_id having count(*) > 1
  ) then
    raise exception 'Duplicate student in records' using errcode = '22023';
  end if;

  if exists (
    select 1 from pg_temp.incoming_attendance i
    where not exists (
      select 1 from public.students st
      where st.id = i.student_id
        and st.section_id = p_session.section_id
        and st.enrollment_status = 'active'
    )
  ) then
    raise exception 'Records include a student who is not in this section''s active roster'
      using errcode = '22023';
  end if;

  insert into public.attendance_records (session_id, section_id, student_id, status, marked_by)
  select p_session.id, p_session.section_id, i.student_id, i.status, (select auth.uid())
  from pg_temp.incoming_attendance i
  on conflict (session_id, student_id) do update
    set status = excluded.status,
        marked_by = excluded.marked_by,
        marked_at = now()
    where public.attendance_records.status is distinct from excluded.status;

  select count(*) into v_count from pg_temp.incoming_attendance;
  return v_count;
end;
$$;

revoke all on function private.upsert_attendance_records(public.attendance_sessions, jsonb) from public, authenticated;

-- Save a draft. Only allowed while the session is a draft.
create function public.save_attendance_draft(p_session_id uuid, p_records jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.attendance_sessions;
begin
  select * into v_session from public.attendance_sessions where id = p_session_id for update;
  if not found or not private.can_take_attendance(v_session.section_id) then
    raise exception 'Attendance session not found' using errcode = 'P0002';
  end if;
  if v_session.status <> 'draft' then
    raise exception 'Attendance has already been submitted' using errcode = '55000';
  end if;

  return private.upsert_attendance_records(v_session, p_records);
end;
$$;

-- Submit a session: saves the final records, checks that every active student
-- in the section has exactly one record, and marks the session submitted, all
-- in one transaction. Re-submitting an already submitted session is a no-op
-- that returns the stored session, so network retries are safe.
create function public.submit_attendance_session(p_session_id uuid, p_records jsonb)
returns public.attendance_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.attendance_sessions;
  v_missing integer;
  v_stale integer;
begin
  select * into v_session from public.attendance_sessions where id = p_session_id for update;
  if not found or not private.can_take_attendance(v_session.section_id) then
    raise exception 'Attendance session not found' using errcode = 'P0002';
  end if;
  if v_session.status <> 'draft' then
    return v_session;
  end if;

  perform private.upsert_attendance_records(v_session, coalesce(p_records, '[]'::jsonb));

  select count(*) into v_missing
  from public.students st
  where st.section_id = v_session.section_id
    and st.enrollment_status = 'active'
    and not exists (
      select 1 from public.attendance_records ar
      where ar.session_id = v_session.id and ar.student_id = st.id
    );

  -- Draft records for students who have since left the active roster.
  select count(*) into v_stale
  from public.attendance_records ar
  join public.students st on st.id = ar.student_id
  where ar.session_id = v_session.id
    and (st.section_id <> v_session.section_id or st.enrollment_status <> 'active');

  if v_missing > 0 then
    raise exception 'Attendance is missing for % student(s)', v_missing using errcode = '22023';
  end if;
  if v_stale > 0 then
    raise exception 'The roster changed since this draft was saved; reload and try again'
      using errcode = '22023';
  end if;

  update public.attendance_sessions
  set status = 'submitted', submitted_by = (select auth.uid()), submitted_at = now()
  where id = v_session.id
  returning * into v_session;

  insert into public.audit_logs (school_id, actor_id, action, entity_type, entity_id, details)
  values (
    v_session.school_id, (select auth.uid()), 'attendance.submitted', 'attendance_session', v_session.id,
    jsonb_build_object(
      'section_id', v_session.section_id,
      'attendance_date', v_session.attendance_date,
      'absent_count', (
        select count(*) from public.attendance_records
        where session_id = v_session.id and status = 'absent'
      )
    )
  );

  return v_session;
end;
$$;

-- Admin correction of a single record on a submitted (not locked) session.
-- Provisional policy until the school confirms who may correct attendance.
create function public.correct_attendance_record(
  p_session_id uuid,
  p_student_id uuid,
  p_status public.attendance_status,
  p_reason text
)
returns public.attendance_records
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.attendance_sessions;
  v_record public.attendance_records;
  v_old_status public.attendance_status;
begin
  select * into v_session from public.attendance_sessions where id = p_session_id for update;
  if not found or v_session.school_id is distinct from private.current_school_id() or not private.is_admin() then
    raise exception 'Only an administrator can correct submitted attendance' using errcode = '42501';
  end if;
  if v_session.status <> 'submitted' then
    raise exception 'Only submitted, unlocked attendance can be corrected' using errcode = '55000';
  end if;
  if p_status is null or p_reason is null or btrim(p_reason) = '' then
    raise exception 'A status and a reason are required' using errcode = '22023';
  end if;

  select * into v_record from public.attendance_records
  where session_id = p_session_id and student_id = p_student_id
  for update;
  if not found then
    raise exception 'Attendance record not found' using errcode = 'P0002';
  end if;

  v_old_status := v_record.status;

  update public.attendance_records
  set status = p_status, marked_by = (select auth.uid()), marked_at = now()
  where id = v_record.id
  returning * into v_record;

  insert into public.audit_logs (school_id, actor_id, action, entity_type, entity_id, details)
  values (
    v_session.school_id, (select auth.uid()), 'attendance.corrected', 'attendance_record', v_record.id,
    jsonb_build_object(
      'session_id', p_session_id,
      'student_id', p_student_id,
      'from', v_old_status,
      'to', p_status,
      'reason', btrim(p_reason)
    )
  );

  return v_record;
end;
$$;

-- Lock a submitted session so it can no longer be corrected (admin only).
create function public.lock_attendance_session(p_session_id uuid)
returns public.attendance_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.attendance_sessions;
begin
  select * into v_session from public.attendance_sessions where id = p_session_id for update;
  if not found or v_session.school_id is distinct from private.current_school_id() or not private.is_admin() then
    raise exception 'Only an administrator can lock attendance' using errcode = '42501';
  end if;
  if v_session.status = 'locked' then
    return v_session;
  end if;
  if v_session.status <> 'submitted' then
    raise exception 'Only submitted attendance can be locked' using errcode = '55000';
  end if;

  update public.attendance_sessions
  set status = 'locked', locked_at = now()
  where id = v_session.id
  returning * into v_session;

  insert into public.audit_logs (school_id, actor_id, action, entity_type, entity_id)
  values (v_session.school_id, (select auth.uid()), 'attendance.locked', 'attendance_session', v_session.id);

  return v_session;
end;
$$;

revoke all on function
  public.open_attendance_session(uuid, date),
  public.save_attendance_draft(uuid, jsonb),
  public.submit_attendance_session(uuid, jsonb),
  public.correct_attendance_record(uuid, uuid, public.attendance_status, text),
  public.lock_attendance_session(uuid)
from public, anon;

grant execute on function
  public.open_attendance_session(uuid, date),
  public.save_attendance_draft(uuid, jsonb),
  public.submit_attendance_session(uuid, jsonb),
  public.correct_attendance_record(uuid, uuid, public.attendance_status, text),
  public.lock_attendance_session(uuid)
to authenticated;
