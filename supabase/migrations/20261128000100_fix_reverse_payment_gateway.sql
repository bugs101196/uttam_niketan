-- Uttam Niketan: fix reverse_payment() for an online-method original payment.
-- Found during the 2026-11-27 project audit (docs/PROJECT_AUDIT.md), before
-- Phase 6 (online payments) writes any real online payment rows.
--
-- fee_payments' own check constraint requires (method = 'online' and gateway
-- is not null). reverse_payment()'s insert carries method from the original
-- row but never carried `gateway` itself, so the reversal row always had
-- gateway = null -- any reversal of an online payment would have failed this
-- constraint. gateway_order_id/gateway_payment_id/gateway_payload stay null
-- on the reversal row on purpose: the reversal is a ledger adjustment, not a
-- second gateway transaction, and gateway_payment_id is unique so it could
-- never be copied anyway.

create or replace function public.reverse_payment(p_payment_id uuid, p_reason text)
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
    school_id, invoice_id, amount, method, received_by, gateway, status, reversed_payment_id, recorded_via, note
  )
  values (
    v_original.school_id, v_original.invoice_id, -v_original.amount, v_original.method,
    case when v_original.method = 'cash' then (select auth.uid()) else null end,
    v_original.gateway,
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
