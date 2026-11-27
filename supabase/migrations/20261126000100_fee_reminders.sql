-- Uttam Niketan: fee reminder queue (overdue invoices)
-- See docs/PROJECT_ROADMAP.md Decision Log (2026-11-26) for the policy this
-- implements, confirmed by the owner:
--   * Trigger: overdue only -- a reminder never fires before the due date.
--   * Cadence: repeats monthly for as long as the invoice stays unpaid;
--     stops automatically once the invoice reaches 'paid' or 'waived'.
--   * Channel: WhatsApp, same consent/opt-out and school on/off switch as
--     the existing absence-alert queue (20261026000300_absence_notifications.sql).
--     This migration ships the plumbing; nothing sends until a
--     Meta-approved "fee_reminder" template exists and WHATSAPP_MODE is
--     test/live, exactly like absence alerts shipped before WhatsApp was
--     configured.
--
-- student_invoices never had a due date -- added here as nullable so
-- existing invoices are simply never overdue until an admin sets one.
--
-- This is a brand-new table, not a reuse of notification_jobs: that table's
-- attendance_record_id/attendance_date columns are NOT NULL and specific to
-- attendance, so a fee reminder (which recurs monthly and has no attendance
-- record at all) needs its own queue. It reuses the existing
-- notification_status and app_language enum types -- same lifecycle shape,
-- different table.

alter table public.student_invoices add column due_date date;

create index student_invoices_due_date_idx on public.student_invoices (due_date) where due_date is not null;

-- create_invoice gains an optional due date (defaulted, so the old 2-arg
-- call from before this migration keeps working unchanged).
create or replace function public.create_invoice(p_student_id uuid, p_label text, p_due_date date default null)
returns public.student_invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student public.students;
  v_year_id uuid;
  v_invoice public.student_invoices;
  v_total numeric(10, 2);
begin
  if not private.is_admin() then
    raise exception 'Only an administrator can create an invoice' using errcode = '42501';
  end if;
  if p_label is null or btrim(p_label) = '' then
    raise exception 'A label is required' using errcode = '22023';
  end if;

  select * into v_student from public.students where id = p_student_id;
  if not found or v_student.school_id is distinct from private.current_school_id() then
    raise exception 'Student not found' using errcode = 'P0002';
  end if;

  select id into v_year_id from public.academic_years
  where school_id = v_student.school_id and is_active;
  if v_year_id is null then
    raise exception 'No active academic year for this school' using errcode = '55000';
  end if;

  insert into public.student_invoices (school_id, student_id, academic_year_id, label, total_amount, due_date)
  values (v_student.school_id, v_student.id, v_year_id, btrim(p_label), 0, p_due_date)
  returning * into v_invoice;

  insert into public.invoice_items (invoice_id, fee_head_id, amount)
  select v_invoice.id, fs.fee_head_id, fs.amount
  from public.fee_structures fs
  where fs.class_id = v_student.class_id and fs.academic_year_id = v_year_id;

  select coalesce(sum(amount), 0) into v_total from public.invoice_items where invoice_id = v_invoice.id;
  if v_total = 0 then
    raise exception 'No fee structure is set for this student''s class; set fees before creating an invoice'
      using errcode = '55000';
  end if;

  update public.student_invoices set total_amount = v_total where id = v_invoice.id
  returning * into v_invoice;

  insert into public.audit_logs (school_id, actor_id, action, entity_type, entity_id, details)
  values (
    v_invoice.school_id, (select auth.uid()), 'fee.invoice.created', 'student_invoice', v_invoice.id,
    jsonb_build_object('student_id', v_student.id, 'label', v_invoice.label, 'total_amount', v_total, 'due_date', p_due_date)
  );

  return v_invoice;
end;
$$;

-- ---------------------------------------------------------------------------
-- fee_reminder_jobs: one row per invoice, ever (dedupe_key is unique). A
-- "sent" or "skipped" outcome reschedules the SAME row a month out rather
-- than finishing it, for as long as the invoice stays unpaid -- see
-- complete_fee_reminder_job below. Only 'paid'/'waived' or exhausted
-- attempts end a row for good.
-- ---------------------------------------------------------------------------

create table public.fee_reminder_jobs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  invoice_id uuid not null,
  student_id uuid not null,
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
  failed_at timestamptz,
  foreign key (invoice_id, school_id) references public.student_invoices (id, school_id),
  foreign key (student_id, school_id) references public.students (id, school_id)
);

create index fee_reminder_jobs_due_idx on public.fee_reminder_jobs (status, next_attempt_at);
create index fee_reminder_jobs_school_created_idx on public.fee_reminder_jobs (school_id, created_at desc);

create trigger fee_reminder_jobs_set_updated_at
  before update on public.fee_reminder_jobs
  for each row execute function private.set_updated_at();

alter table public.fee_reminder_jobs enable row level security;

revoke all on public.fee_reminder_jobs from anon, authenticated;
grant select on public.fee_reminder_jobs to authenticated;

create policy fee_reminder_jobs_select_admin on public.fee_reminder_jobs
  for select to authenticated
  using (school_id = (select private.current_school_id()) and (select private.is_admin()));

-- ---------------------------------------------------------------------------
-- Queue helpers (internal)
-- ---------------------------------------------------------------------------

create function private.fee_reminder_dedupe_key(p_invoice_id uuid)
returns text
language sql
immutable
set search_path = ''
as $$
  select 'fee:' || p_invoice_id::text;
$$;

revoke all on function private.fee_reminder_dedupe_key(uuid) from public, authenticated;

-- ---------------------------------------------------------------------------
-- scan_overdue_invoices_for_reminders: service-role only, called by the
-- daily cron (see src/app/api/cron/fee-reminders/route.ts). Finds every
-- invoice that is now overdue and unpaid/partial, with a consenting
-- guardian, and makes sure a queued job exists for it -- reactivating a
-- previously cancelled row (e.g. a reversed payment made it unpaid again)
-- the same way enqueue_absence_notification does.
-- ---------------------------------------------------------------------------

create function public.scan_overdue_invoices_for_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  with overdue as (
    select si.id as invoice_id, si.school_id, si.student_id, st.guardian_phone, st.preferred_language
    from public.student_invoices si
    join public.students st on st.id = si.student_id
    join public.schools sc on sc.id = si.school_id
    where si.due_date is not null
      and si.due_date < (now() at time zone 'Asia/Kolkata')::date
      and si.status in ('unpaid', 'partial')
      and sc.whatsapp_enabled
      and st.guardian_notifications_consent
      and st.guardian_phone is not null
  ),
  upserted as (
    insert into public.fee_reminder_jobs (
      school_id, invoice_id, student_id, recipient_phone, template_language, dedupe_key
    )
    select school_id, invoice_id, student_id, guardian_phone, preferred_language,
           private.fee_reminder_dedupe_key(invoice_id)
    from overdue
    on conflict (dedupe_key) do update
      set status = 'queued',
          attempts = 0,
          next_attempt_at = now(),
          last_error = null,
          recipient_phone = excluded.recipient_phone,
          template_language = excluded.template_language
      where public.fee_reminder_jobs.status = 'cancelled'
    returning 1
  )
  select count(*) into v_count from upserted;
  return v_count;
end;
$$;

revoke all on function public.scan_overdue_invoices_for_reminders() from public, anon, authenticated;
grant execute on function public.scan_overdue_invoices_for_reminders() to service_role;

-- ---------------------------------------------------------------------------
-- Worker functions (service role only) -- same shape as
-- claim_notification_jobs / complete_notification_job.
-- ---------------------------------------------------------------------------

-- Claims up to p_limit due jobs. Unlike the absence queue, a job here is
-- never "expired" by age (an overdue fee stays relevant indefinitely); it is
-- cancelled instead once its invoice is settled, and recovered the same way
-- a crashed worker's stuck 'processing' row would be.
--
-- A reminder recurs monthly, unlike the one-shot absence alert, so guardian
-- consent, the guardian's phone, and the school's on/off switch must be
-- re-checked on every claim (this runs at least daily, via cron) rather than
-- only once at the original enqueue -- otherwise a guardian who withdraws
-- consent, or a school that turns reminders off, would keep being messaged
-- for months. The claimed row's recipient_phone/template_language are read
-- live from students here too, not from the job's own (potentially stale)
-- stored copy.
create function public.claim_fee_reminder_jobs(p_limit integer default 20)
returns table (
  id uuid,
  recipient_phone text,
  template_language public.app_language,
  student_name text,
  class_label text,
  invoice_label text,
  balance numeric,
  due_date date,
  attempts integer
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  update public.fee_reminder_jobs j
  set status = 'cancelled', last_error = 'Invoice is settled'
  where j.status = 'queued'
    and exists (
      select 1 from public.student_invoices si
      where si.id = j.invoice_id and si.status in ('paid', 'waived')
    );

  update public.fee_reminder_jobs j
  set status = 'cancelled', last_error = 'Guardian consent, phone, or the school''s messaging switch changed'
  where j.status in ('queued', 'processing')
    and (j.status = 'queued' or j.updated_at < now() - interval '10 minutes')
    and not exists (
      select 1 from public.students st
      join public.schools sc on sc.id = st.school_id
      where st.id = j.student_id
        and sc.whatsapp_enabled
        and st.guardian_notifications_consent
        and st.guardian_phone is not null
    );

  update public.fee_reminder_jobs j
  set status = 'failed', failed_at = now(), last_error = coalesce(j.last_error, 'No attempts left')
  where j.status in ('queued', 'processing')
    and j.attempts >= j.max_attempts
    and (j.status = 'queued' or j.updated_at < now() - interval '10 minutes');

  -- The two cancellation passes above should already remove every
  -- ineligible row, but the eligibility join here too means no row can
  -- ever be claimed without currently passing the live check, regardless
  -- of status or any gap between the passes and this query.
  return query
  with due as (
    select j.id
    from public.fee_reminder_jobs j
    join public.students st on st.id = j.student_id
    join public.schools sc on sc.id = st.school_id
    where (
      (j.status = 'queued' and j.next_attempt_at <= now())
      or (j.status = 'processing' and j.updated_at < now() - interval '10 minutes')
    )
      and sc.whatsapp_enabled
      and st.guardian_notifications_consent
      and st.guardian_phone is not null
    order by j.next_attempt_at
    limit greatest(1, least(coalesce(p_limit, 20), 100))
    for update skip locked
  ),
  claimed as (
    update public.fee_reminder_jobs j
    set status = 'processing', attempts = j.attempts + 1
    from due
    where j.id = due.id
    returning j.*
  )
  select c.id, st.guardian_phone, st.preferred_language, st.full_name,
         cl.name || ' – ' || se.name, si.label,
         si.total_amount - coalesce((select sum(fp.amount) from public.fee_payments fp where fp.invoice_id = si.id), 0),
         si.due_date, c.attempts
  from claimed c
  join public.students st on st.id = c.student_id
  join public.sections se on se.id = st.section_id
  join public.classes cl on cl.id = se.class_id
  join public.student_invoices si on si.id = c.invoice_id;
end;
$$;

-- Records the outcome of one send attempt. A 'sent' or 'skipped' outcome
-- reschedules the job a month out if the invoice is still unpaid, rather
-- than finishing it -- see the file header. 'retry' keeps the same
-- exponential backoff as the absence queue; 'failed' (or attempts
-- exhausted) is terminal and needs an admin to look at it.
create function public.complete_fee_reminder_job(
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
  v_job public.fee_reminder_jobs;
  v_invoice public.student_invoices;
  v_error text := left(p_error, 500);
  v_still_due boolean;
begin
  select * into v_job from public.fee_reminder_jobs where id = p_job_id for update;
  if not found or v_job.status <> 'processing' then
    return; -- already completed or cancelled; nothing to do
  end if;

  select * into v_invoice from public.student_invoices where id = v_job.invoice_id;
  v_still_due := found and v_invoice.status in ('unpaid', 'partial');

  if p_outcome in ('sent', 'skipped') then
    if v_still_due then
      update public.fee_reminder_jobs
      set status = 'queued',
          attempts = 0,
          next_attempt_at = now() + interval '1 month',
          last_error = v_error,
          sent_at = case when p_outcome = 'sent' then now() else sent_at end,
          provider_message_id = case when p_outcome = 'sent' then p_provider_message_id else provider_message_id end
      where id = p_job_id;
    else
      update public.fee_reminder_jobs
      set status = 'cancelled', last_error = 'Invoice is settled'
      where id = p_job_id;
    end if;
  elsif p_outcome = 'retry' and v_job.attempts < v_job.max_attempts then
    update public.fee_reminder_jobs
    set status = 'queued',
        last_error = v_error,
        next_attempt_at = now() + least(power(2, v_job.attempts - 1), 60) * interval '1 minute'
    where id = p_job_id;
  elsif p_outcome in ('retry', 'failed') then
    update public.fee_reminder_jobs
    set status = 'failed', failed_at = now(), last_error = v_error
    where id = p_job_id;
  else
    raise exception 'Unknown outcome %', p_outcome using errcode = '22023';
  end if;
end;
$$;

revoke all on function
  public.claim_fee_reminder_jobs(integer),
  public.complete_fee_reminder_job(uuid, text, text, text)
from public, anon, authenticated;

grant execute on function
  public.claim_fee_reminder_jobs(integer),
  public.complete_fee_reminder_job(uuid, text, text, text)
to service_role;

-- ---------------------------------------------------------------------------
-- apply_whatsapp_status: same signature, now also checks fee_reminder_jobs
-- when a provider_message_id isn't a notification_jobs row -- the WhatsApp
-- webhook calls this one function for every status callback regardless of
-- which queue sent the message.
-- ---------------------------------------------------------------------------

create or replace function public.apply_whatsapp_status(
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
  v_fee_job public.fee_reminder_jobs;
  v_rank_current integer;
  v_rank_new integer;
begin
  select * into v_job from public.notification_jobs
  where provider_message_id = p_provider_message_id
  for update;

  if found then
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
  end if;

  -- Not an absence alert; try the fee-reminder queue. A fee-reminder job is
  -- recurring, so delivered/read here only update its latest cycle's
  -- timestamps -- they never change `status`, which complete_fee_reminder_job
  -- already moved on from 'sent' to 'queued' (or 'cancelled') by the time a
  -- delivery callback typically arrives.
  select * into v_fee_job from public.fee_reminder_jobs
  where provider_message_id = p_provider_message_id
  for update;
  if not found then
    return false;
  end if;

  if p_status = 'failed' then
    update public.fee_reminder_jobs
    set last_error = left(coalesce(p_error, 'Delivery failed'), 500)
    where id = v_fee_job.id;
    return true;
  end if;

  update public.fee_reminder_jobs
  set delivered_at = case when p_status in ('delivered', 'read') then coalesce(delivered_at, p_at) else delivered_at end,
      read_at = case when p_status = 'read' then p_at else read_at end
  where id = v_fee_job.id;
  return true;
end;
$$;
