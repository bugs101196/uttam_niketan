-- Uttam Niketan: WhatsApp absence notification queue
-- See docs/PROJECT_ROADMAP.md §4.3 and §15.
--
-- Design:
--   * Messaging is off unless the school turns it on (schools.whatsapp_enabled)
--     AND the server is configured (WHATSAPP_MODE, checked by the worker).
--   * Jobs are created in the same transaction that submits or corrects
--     attendance, only for absent students whose guardian has consented and has
--     a phone number. One job per session + student (dedupe_key), so retries and
--     re-submits never queue twice.
--   * A correction to a non-absent status cancels a job that has not been sent.
--   * Only the server worker (service role) claims and completes jobs, and only
--     the verified webhook (service role) applies provider status updates.
--     Admins can read the log; nobody else can see it.

create type public.notification_status as enum (
  'queued', 'processing', 'sent', 'delivered', 'read', 'failed', 'cancelled', 'skipped'
);

alter table public.schools add column whatsapp_enabled boolean not null default false;

create table public.notification_jobs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  attendance_record_id uuid not null references public.attendance_records (id),
  student_id uuid not null references public.students (id),
  attendance_date date not null,
  recipient_phone text not null check (recipient_phone ~ '^\+[1-9][0-9]{7,14}$'),
  template_language public.app_language not null,
  status public.notification_status not null default 'queued',
  dedupe_key text not null unique,
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 5 check (max_attempts between 1 and 10),
  next_attempt_at timestamptz not null default now(),
  provider_message_id text unique,
  last_error text check (char_length(last_error) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  failed_at timestamptz
);

create index notification_jobs_due_idx on public.notification_jobs (status, next_attempt_at);
create index notification_jobs_school_created_idx on public.notification_jobs (school_id, created_at desc);

create trigger notification_jobs_set_updated_at
  before update on public.notification_jobs
  for each row execute function private.set_updated_at();

alter table public.notification_jobs enable row level security;

revoke all on public.notification_jobs from anon, authenticated;
grant select on public.notification_jobs to authenticated;

create policy notification_jobs_select_admin on public.notification_jobs
  for select to authenticated
  using (school_id = (select private.current_school_id()) and (select private.is_admin()));

-- ---------------------------------------------------------------------------
-- Queue helpers (internal)
-- ---------------------------------------------------------------------------

create function private.notification_dedupe_key(p_session_id uuid, p_student_id uuid)
returns text
language sql
immutable
set search_path = ''
as $$
  select 'absence:' || p_session_id::text || ':' || p_student_id::text;
$$;

-- Queue an absence alert for one attendance record if the school and guardian
-- allow it. Re-queues a previously cancelled job (e.g. absent -> present ->
-- absent before sending); never duplicates an active or finished job.
create function private.enqueue_absence_notification(p_record_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  insert into public.notification_jobs (
    school_id, attendance_record_id, student_id, attendance_date,
    recipient_phone, template_language, dedupe_key
  )
  select
    se.school_id, ar.id, st.id, se.attendance_date,
    st.guardian_phone, st.preferred_language,
    private.notification_dedupe_key(se.id, st.id)
  from public.attendance_records ar
  join public.attendance_sessions se on se.id = ar.session_id
  join public.students st on st.id = ar.student_id
  join public.schools sc on sc.id = se.school_id
  where ar.id = p_record_id
    and ar.status = 'absent'
    and sc.whatsapp_enabled
    and st.guardian_notifications_consent
    and st.guardian_phone is not null
  on conflict (dedupe_key) do update
    set status = 'queued',
        attempts = 0,
        next_attempt_at = now(),
        last_error = null,
        recipient_phone = excluded.recipient_phone,
        template_language = excluded.template_language
    where public.notification_jobs.status = 'cancelled';
end;
$$;

create function private.cancel_absence_notification(p_session_id uuid, p_student_id uuid)
returns void
language sql
set search_path = ''
as $$
  update public.notification_jobs
  set status = 'cancelled', last_error = 'Attendance corrected before sending'
  where dedupe_key = private.notification_dedupe_key(p_session_id, p_student_id)
    and status = 'queued';
$$;

revoke all on function
  private.notification_dedupe_key(uuid, uuid),
  private.enqueue_absence_notification(uuid),
  private.cancel_absence_notification(uuid, uuid)
from public, authenticated;

-- ---------------------------------------------------------------------------
-- Attendance functions, now also queueing notifications.
-- Same behaviour as in 20261026000200 plus the queue calls.
-- ---------------------------------------------------------------------------

create or replace function public.submit_attendance_session(p_session_id uuid, p_records jsonb)
returns public.attendance_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.attendance_sessions;
  v_missing integer;
  v_stale integer;
  v_record record;
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

  for v_record in
    select id from public.attendance_records where session_id = v_session.id and status = 'absent'
  loop
    perform private.enqueue_absence_notification(v_record.id);
  end loop;

  return v_session;
end;
$$;

create or replace function public.correct_attendance_record(
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

  if p_status = 'absent' then
    perform private.enqueue_absence_notification(v_record.id);
  else
    perform private.cancel_absence_notification(p_session_id, p_student_id);
  end if;

  return v_record;
end;
$$;

-- ---------------------------------------------------------------------------
-- Worker functions (service role only)
-- ---------------------------------------------------------------------------

-- Claims up to p_limit due jobs and returns what the sender needs. Also:
--   * expires queued jobs for absences more than 2 days old, so a backlog is
--     never sent late (e.g. after messaging was off for a while);
--   * recovers jobs stuck in 'processing' for 10+ minutes (a crashed worker);
--   * fails jobs that have used all their attempts.
-- FOR UPDATE SKIP LOCKED lets two workers run without claiming the same job.
create function public.claim_notification_jobs(p_limit integer default 20)
returns table (
  id uuid,
  recipient_phone text,
  template_language public.app_language,
  student_name text,
  class_label text,
  attendance_date date,
  attempts integer
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  update public.notification_jobs j
  set status = 'skipped', last_error = 'Expired: absence is more than 2 days old'
  where j.status = 'queued'
    and j.attendance_date < (now() at time zone 'Asia/Kolkata')::date - 2;

  update public.notification_jobs j
  set status = 'failed', failed_at = now(), last_error = coalesce(j.last_error, 'No attempts left')
  where j.status in ('queued', 'processing')
    and j.attempts >= j.max_attempts
    and (j.status = 'queued' or j.updated_at < now() - interval '10 minutes');

  return query
  with due as (
    select j.id
    from public.notification_jobs j
    where (j.status = 'queued' and j.next_attempt_at <= now())
       or (j.status = 'processing' and j.updated_at < now() - interval '10 minutes')
    order by j.next_attempt_at
    limit greatest(1, least(coalesce(p_limit, 20), 100))
    for update skip locked
  ),
  claimed as (
    update public.notification_jobs j
    set status = 'processing', attempts = j.attempts + 1
    from due
    where j.id = due.id
    returning j.*
  )
  select c.id, c.recipient_phone, c.template_language, st.full_name,
         cl.name || ' – ' || se.name, c.attendance_date, c.attempts
  from claimed c
  join public.students st on st.id = c.student_id
  join public.attendance_records ar on ar.id = c.attendance_record_id
  join public.sections se on se.id = ar.section_id
  join public.classes cl on cl.id = se.class_id;
end;
$$;

-- Records the outcome of one send attempt.
--   p_outcome: 'sent' | 'retry' | 'failed' | 'skipped'
-- Retries back off exponentially (1, 2, 4, 8 ... minutes, capped at 60).
create function public.complete_notification_job(
  p_job_id uuid,
  p_outcome text,
  p_provider_message_id text default null,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.notification_jobs;
  v_error text := left(p_error, 500);
begin
  select * into v_job from public.notification_jobs where id = p_job_id for update;
  if not found or v_job.status <> 'processing' then
    return; -- already completed or cancelled; nothing to do
  end if;

  if p_outcome = 'sent' then
    update public.notification_jobs
    set status = 'sent', provider_message_id = p_provider_message_id, sent_at = now(), last_error = null
    where id = p_job_id;
  elsif p_outcome = 'skipped' then
    update public.notification_jobs set status = 'skipped', last_error = v_error where id = p_job_id;
  elsif p_outcome = 'retry' and v_job.attempts < v_job.max_attempts then
    update public.notification_jobs
    set status = 'queued',
        last_error = v_error,
        next_attempt_at = now() + least(power(2, v_job.attempts - 1), 60) * interval '1 minute'
    where id = p_job_id;
  elsif p_outcome in ('retry', 'failed') then
    update public.notification_jobs
    set status = 'failed', failed_at = now(), last_error = v_error
    where id = p_job_id;
  else
    raise exception 'Unknown outcome %', p_outcome using errcode = '22023';
  end if;
end;
$$;

-- Applies a provider status callback. Statuses only move forward
-- (sent -> delivered -> read), so repeated or out-of-order callbacks are
-- harmless. A failure is accepted only before delivery. Returns true when
-- something changed.
create function public.apply_whatsapp_status(
  p_provider_message_id text,
  p_status text,
  p_at timestamptz default now(),
  p_error text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.notification_jobs;
  v_rank_current integer;
  v_rank_new integer;
begin
  select * into v_job from public.notification_jobs
  where provider_message_id = p_provider_message_id
  for update;
  if not found then
    return false;
  end if;

  v_rank_current := case v_job.status
    when 'sent' then 1 when 'delivered' then 2 when 'read' then 3 else 0 end;

  if p_status = 'failed' then
    if v_job.status not in ('sent', 'processing') then
      return false;
    end if;
    update public.notification_jobs
    set status = 'failed', failed_at = coalesce(p_at, now()), last_error = left(coalesce(p_error, 'Delivery failed'), 500)
    where id = v_job.id;
    return true;
  end if;

  v_rank_new := case p_status when 'sent' then 1 when 'delivered' then 2 when 'read' then 3 else null end;
  if v_rank_new is null or v_job.status not in ('sent', 'delivered', 'read') or v_rank_new <= v_rank_current then
    return false;
  end if;

  update public.notification_jobs
  set status = p_status::public.notification_status,
      delivered_at = case when v_rank_new >= 2 then coalesce(delivered_at, p_at) else delivered_at end,
      read_at = case when v_rank_new = 3 then p_at else read_at end
  where id = v_job.id;
  return true;
end;
$$;

revoke all on function
  public.claim_notification_jobs(integer),
  public.complete_notification_job(uuid, text, text, text),
  public.apply_whatsapp_status(text, text, timestamptz, text)
from public, anon, authenticated;

grant execute on function
  public.claim_notification_jobs(integer),
  public.complete_notification_job(uuid, text, text, text),
  public.apply_whatsapp_status(text, text, timestamptz, text)
to service_role;
