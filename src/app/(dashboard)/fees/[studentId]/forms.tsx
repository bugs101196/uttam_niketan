"use client";

import { useActionState } from "react";
import { Alert, Button, Field, Input, Textarea } from "@/components/ui/form";
import type { FeesActionState } from "./actions";

type BoundAction = (prev: FeesActionState, formData: FormData) => Promise<FeesActionState>;

export function CreateInvoiceForm({ action }: { action: BoundAction }) {
  const [state, formAction, pending] = useActionState<FeesActionState, FormData>(action, {});
  const errors = state.fieldErrors ?? {};

  return (
    <div className="space-y-4">
      {state.message ? <Alert tone="error">{state.message}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      <form key={state.attempt ?? 0} action={formAction} className="flex flex-wrap items-end gap-3" noValidate>
        <div className="min-w-48 flex-1">
          <Field label="Label" htmlFor="invoice_label" error={errors.label} hint='e.g. "Term 1, 2026-27"'>
            <Input id="invoice_label" name="label" required invalid={!!errors.label} autoComplete="off" />
          </Field>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create invoice"}
        </Button>
      </form>
    </div>
  );
}

export function RecordPaymentForm({ action }: { action: BoundAction }) {
  const [state, formAction, pending] = useActionState<FeesActionState, FormData>(action, {});
  const errors = state.fieldErrors ?? {};

  return (
    <div className="space-y-3">
      {state.message ? <Alert tone="error">{state.message}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      <form key={state.attempt ?? 0} action={formAction} className="flex flex-wrap items-end gap-3" noValidate>
        <div className="w-32">
          <Field label="Amount (₹)" htmlFor="payment_amount" error={errors.amount}>
            <Input
              id="payment_amount"
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              required
              invalid={!!errors.amount}
            />
          </Field>
        </div>
        <div className="min-w-48 flex-1">
          <Field label="Note (optional)" htmlFor="payment_note" error={errors.note}>
            <Input id="payment_note" name="note" autoComplete="off" />
          </Field>
        </div>
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Recording…" : "Record cash payment"}
        </Button>
      </form>
    </div>
  );
}

export function ReversePaymentForm({ action }: { action: BoundAction }) {
  const [state, formAction, pending] = useActionState<FeesActionState, FormData>(action, {});
  const errors = state.fieldErrors ?? {};

  if (state.success) return <Alert tone="success">{state.success}</Alert>;

  return (
    <div className="space-y-2">
      {state.message ? <Alert tone="error">{state.message}</Alert> : null}
      <form key={state.attempt ?? 0} action={formAction} className="flex flex-wrap items-end gap-2" noValidate>
        <div className="min-w-40 flex-1">
          <Field label="Reason for reversal" htmlFor="reverse_reason" error={errors.reason}>
            <Textarea id="reverse_reason" name="reason" required invalid={!!errors.reason} />
          </Field>
        </div>
        <Button type="submit" variant="danger" disabled={pending}>
          {pending ? "Reversing…" : "Reverse"}
        </Button>
      </form>
    </div>
  );
}
