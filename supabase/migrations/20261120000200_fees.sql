-- Uttam Niketan: fee schema + cash-only payments (ERP Architecture §18 phase 5)
-- See docs/ERP_ARCHITECTURE.md §9 for the full design, §17 for the decisions
-- this needed. Confirmed by the owner (2026-11-20): billing is per-term;
-- office staff get NO fee/payment visibility at all, not even their own
-- cash receipts (admin-only, stricter than the doc's draft "admin or
-- office" for record_cash_payment -- deliberately narrowed here, since a
-- role that cannot see the ledger shouldn't be able to write to it either);
-- fee structures are per-class-per-year only, no per-student
-- discounts/scholarships yet.
--
-- Online payments (the gateway integration) are explicitly out of scope --
-- Phase 6. The schema is gateway-agnostic (§9.3) so Phase 6 should need no
-- new tables, only verify_and_record_online_payment() and the webhook route.
--
-- Every write (invoice creation, cash payment, reversal) goes through a
-- security-definer function; clients get select-only, same pattern as
-- attendance. Every denormalised school_id is tied to its real parent via a
-- composite FK (the same lesson as homework_section_school_fk from PR #10)
-- -- RLS alone never enforces that two ids agree with each other.
--
-- Reversal design note (resolving an ambiguity in §9.6's prose): a
-- reversal is a brand-new row with amount negated and status = 'reversed'
-- -- the ORIGINAL row is never touched (truly append-only, stronger than
-- "never UPDATE a *completed* row" -- it's never updated at all). `status`
-- is descriptive only ('completed' = a real payment, 'reversed' = a
-- reversal entry); it is never used to filter the balance sum, because
-- doing that *and* negating the amount would double-subtract. Every
-- invoice's running balance is simply total_amount minus the sum of every
-- fee_payments.amount for that invoice (the signed amount alone carries the
-- math; status is just a label for display/audit).

create type public.invoice_status as enum ('unpaid', 'partial', 'paid', 'waived');
create type public.payment_method as enum ('cash', 'online');
create type public.payment_status as enum ('completed', 'reversed');

-- ---------------------------------------------------------------------------
-- fee_heads: school-level catalog (Tuition, Admission, Exam Fee, ...).
-- ---------------------------------------------------------------------------

create table public.fee_heads (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  name text not null check (btrim(name) <> ''),
  name_hi text,
  created_at timestamptz not null default now(),
  unique (school_id, name),
  unique (id, school_id)
);

-- ---------------------------------------------------------------------------
-- fee_structures: amount due per class, per academic year, per fee head.
-- Per-class-per-year only (confirmed) -- no per-student overrides yet.
-- ---------------------------------------------------------------------------

create table public.fee_structures (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  academic_year_id uuid not null,
  class_id uuid not null,
  fee_head_id uuid not null,
  amount numeric(10, 2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (class_id, school_id, academic_year_id)
    references public.classes (id, school_id, academic_year_id),
  foreign key (fee_head_id, school_id) references public.fee_heads (id, school_id),
  unique (class_id, fee_head_id)
);

create trigger fee_structures_set_updated_at
  before update on public.fee_structures
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- student_invoices: one per student per billing period (per term, confirmed).
-- status is derived by create_invoice/record_cash_payment/reverse_payment --
-- never set directly by a client.
-- ---------------------------------------------------------------------------

create table public.student_invoices (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  student_id uuid not null,
  academic_year_id uuid not null,
  label text not null check (btrim(label) <> ''),
  total_amount numeric(10, 2) not null check (total_amount >= 0),
  status public.invoice_status not null default 'unpaid',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (student_id, school_id) references public.students (id, school_id),
  foreign key (academic_year_id, school_id) references public.academic_years (id, school_id),
  unique (id, school_id),
  unique (student_id, academic_year_id, label)
);

create index student_invoices_student_idx on public.student_invoices (student_id);

create trigger student_invoices_set_updated_at
  before update on public.student_invoices
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- invoice_items: which fee heads make up an invoice -- a snapshot taken at
-- creation time, never re-derived from fee_structures afterwards, so a
-- later price change never silently rewrites an already-issued invoice.
-- ---------------------------------------------------------------------------

create table public.invoice_items (
  invoice_id uuid not null references public.student_invoices (id),
  fee_head_id uuid not null references public.fee_heads (id),
  amount numeric(10, 2) not null check (amount >= 0),
  primary key (invoice_id, fee_head_id)
);

-- ---------------------------------------------------------------------------
-- fee_payments: append-only ledger. See the reversal design note above --
-- a row here is never updated once written, by anyone, including the
-- security-definer functions below.
-- ---------------------------------------------------------------------------

create table public.fee_payments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  invoice_id uuid not null,
  amount numeric(10, 2) not null check (amount <> 0), -- positive = payment, negative = reversal
  method public.payment_method not null,
  received_by uuid references public.profiles (id), -- required for cash
  gateway text,
  gateway_order_id text,
  gateway_payment_id text unique,
  gateway_payload jsonb,
  status public.payment_status not null default 'completed', -- descriptive only, see note above
  reversed_payment_id uuid references public.fee_payments (id), -- set on the reversal row, points at the original
  recorded_via uuid not null references auth.users (id), -- staff (cash) or parent (future online)
  note text,
  created_at timestamptz not null default now(),
  foreign key (invoice_id, school_id) references public.student_invoices (id, school_id),
  check (
    (method = 'cash' and received_by is not null and gateway is null)
    or (method = 'online' and gateway is not null)
  )
);

create index fee_payments_invoice_idx on public.fee_payments (invoice_id);

-- ---------------------------------------------------------------------------
-- Table privileges and RLS. Clients get select-only everywhere -- every
-- write goes through a security-definer function below, same pattern as
-- attendance_sessions/attendance_records.
-- ---------------------------------------------------------------------------

revoke all on public.fee_heads, public.fee_structures, public.student_invoices,
  public.invoice_items, public.fee_payments
  from anon, authenticated;
grant select on public.fee_heads, public.fee_structures, public.student_invoices,
  public.invoice_items, public.fee_payments
  to authenticated;

alter table public.fee_heads enable row level security;
alter table public.fee_structures enable row level security;
alter table public.student_invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.fee_payments enable row level security;

-- fee_heads: admin manages their own school's catalog. A guardian may read
-- only the specific heads that appear on one of their own children's
-- invoices -- not the whole catalog, matching the "narrowest reasonable
-- default" the office-visibility decision already set for this module.
create policy fee_heads_select on public.fee_heads
  for select to authenticated
  using (
    (school_id = (select private.current_school_id()) and (select private.is_admin()))
    or exists (
      select 1 from public.invoice_items ii
      join public.student_invoices si on si.id = ii.invoice_id
      where ii.fee_head_id = fee_heads.id
        and private.is_guardian_of(si.student_id)
    )
  );

-- fee_structures: admin-only, own school. Never exposed to guardians --
-- invoice_items already carries the amount a parent needs to see.
create policy fee_structures_select on public.fee_structures
  for select to authenticated
  using (school_id = (select private.current_school_id()) and (select private.is_admin()));

-- student_invoices: admin sees every invoice in their school; a guardian
-- sees only their own linked children's invoices. No teacher or office
-- access -- confirmed not part of this role's remit.
create policy student_invoices_select on public.student_invoices
  for select to authenticated
  using (
    (school_id = (select private.current_school_id()) and (select private.is_admin()))
    or private.is_guardian_of(student_id)
  );

create policy invoice_items_select on public.invoice_items
  for select to authenticated
  using (
    exists (
      select 1 from public.student_invoices si
      where si.id = invoice_items.invoice_id
        and (
          (si.school_id = (select private.current_school_id()) and (select private.is_admin()))
          or private.is_guardian_of(si.student_id)
        )
    )
  );

create policy fee_payments_select on public.fee_payments
  for select to authenticated
  using (
    (school_id = (select private.current_school_id()) and (select private.is_admin()))
    or exists (
      select 1 from public.student_invoices si
      where si.id = fee_payments.invoice_id and private.is_guardian_of(si.student_id)
    )
  );

-- ---------------------------------------------------------------------------
-- create_invoice: admin-only. Builds invoice_items from the student's class's
-- current fee_structures, snapshotting amounts so a later price change never
-- rewrites an already-issued invoice.
-- ---------------------------------------------------------------------------

create function public.create_invoice(p_student_id uuid, p_label text)
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

  insert into public.student_invoices (school_id, student_id, academic_year_id, label, total_amount)
  values (v_student.school_id, v_student.id, v_year_id, btrim(p_label), 0)
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
    jsonb_build_object('student_id', v_student.id, 'label', v_invoice.label, 'total_amount', v_total)
  );

  return v_invoice;
end;
$$;

-- ---------------------------------------------------------------------------
-- record_cash_payment: admin-only (confirmed -- office gets no fee access at
-- all, so cannot record payments either). Derives received_by from
-- auth.uid(), never trusts a client-supplied value -- same rule the audit
-- already applies to attendance's marked_by.
-- ---------------------------------------------------------------------------

create function public.record_cash_payment(p_invoice_id uuid, p_amount numeric, p_note text)
returns public.fee_payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.student_invoices;
  v_payment public.fee_payments;
  v_paid numeric(10, 2);
begin
  if not private.is_admin() then
    raise exception 'Only an administrator can record a cash payment' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be a positive number' using errcode = '22023';
  end if;

  select * into v_invoice from public.student_invoices where id = p_invoice_id for update;
  if not found or v_invoice.school_id is distinct from private.current_school_id() then
    raise exception 'Invoice not found' using errcode = 'P0002';
  end if;
  if v_invoice.status = 'waived' then
    raise exception 'This invoice has been waived; no further payment can be recorded' using errcode = '55000';
  end if;

  insert into public.fee_payments (school_id, invoice_id, amount, method, received_by, status, recorded_via, note)
  values (
    v_invoice.school_id, v_invoice.id, p_amount, 'cash', (select auth.uid()), 'completed', (select auth.uid()), p_note
  )
  returning * into v_payment;

  select coalesce(sum(amount), 0) into v_paid from public.fee_payments where invoice_id = v_invoice.id;

  update public.student_invoices
  set status = (case
    when v_paid >= v_invoice.total_amount then 'paid'
    when v_paid > 0 then 'partial'
    else 'unpaid'
  end)::public.invoice_status
  where id = v_invoice.id;

  insert into public.audit_logs (school_id, actor_id, action, entity_type, entity_id, details)
  values (
    v_invoice.school_id, (select auth.uid()), 'fee.payment.cash', 'fee_payment', v_payment.id,
    jsonb_build_object('invoice_id', v_invoice.id, 'amount', p_amount, 'note', p_note)
  );

  return v_payment;
end;
$$;

-- ---------------------------------------------------------------------------
-- reverse_payment: admin-only. See the reversal design note at the top of
-- this file -- inserts a new negative-amount row, never touches the
-- original.
-- ---------------------------------------------------------------------------

create function public.reverse_payment(p_payment_id uuid, p_reason text)
returns public.fee_payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_original public.fee_payments;
  v_invoice public.student_invoices;
  v_reversal public.fee_payments;
  v_paid numeric(10, 2);
begin
  if not private.is_admin() then
    raise exception 'Only an administrator can reverse a payment' using errcode = '42501';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'A reason is required' using errcode = '22023';
  end if;

  select * into v_original from public.fee_payments where id = p_payment_id for update;
  if not found or v_original.school_id is distinct from private.current_school_id() then
    raise exception 'Payment not found' using errcode = 'P0002';
  end if;
  if v_original.status <> 'completed' then
    raise exception 'Only a completed payment can be reversed' using errcode = '55000';
  end if;
  if v_original.amount < 0 then
    raise exception 'A reversal entry cannot itself be reversed' using errcode = '55000';
  end if;
  if exists (select 1 from public.fee_payments where reversed_payment_id = v_original.id) then
    raise exception 'This payment has already been reversed' using errcode = '55000';
  end if;

  select * into v_invoice from public.student_invoices where id = v_original.invoice_id for update;

  insert into public.fee_payments (
    school_id, invoice_id, amount, method, received_by, status, reversed_payment_id, recorded_via, note
  )
  values (
    v_original.school_id, v_original.invoice_id, -v_original.amount, v_original.method,
    case when v_original.method = 'cash' then (select auth.uid()) else null end,
    'reversed', v_original.id, (select auth.uid()), p_reason
  )
  returning * into v_reversal;

  select coalesce(sum(amount), 0) into v_paid from public.fee_payments where invoice_id = v_invoice.id;

  update public.student_invoices
  set status = (case
    when v_paid >= v_invoice.total_amount then 'paid'
    when v_paid > 0 then 'partial'
    else 'unpaid'
  end)::public.invoice_status
  where id = v_invoice.id;

  insert into public.audit_logs (school_id, actor_id, action, entity_type, entity_id, details)
  values (
    v_invoice.school_id, (select auth.uid()), 'fee.payment.reversed', 'fee_payment', v_reversal.id,
    jsonb_build_object('original_payment_id', v_original.id, 'amount', -v_original.amount, 'reason', btrim(p_reason))
  );

  return v_reversal;
end;
$$;

revoke all on function
  public.create_invoice(uuid, text),
  public.record_cash_payment(uuid, numeric, text),
  public.reverse_payment(uuid, text)
from public, anon;

grant execute on function
  public.create_invoice(uuid, text),
  public.record_cash_payment(uuid, numeric, text),
  public.reverse_payment(uuid, text)
to authenticated;
