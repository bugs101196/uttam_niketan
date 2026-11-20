"use client";

import { useActionState } from "react";
import { Alert, Button, Field, Input, Select } from "@/components/ui/form";
import type { FormState } from "./actions";

export function FeeAmountForm({
  action,
  feeHeads,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  feeHeads: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const errors = state.fieldErrors ?? {};

  return (
    <div className="space-y-2">
      <form key={state.success ? "reset" : "keep"} action={formAction} className="flex flex-wrap items-end gap-2" noValidate>
        <div className="min-w-40">
          <Field label="Fee head" htmlFor="fee_head_id" error={errors.fee_head_id}>
            <Select id="fee_head_id" name="fee_head_id" required invalid={!!errors.fee_head_id}>
              <option value="">Choose…</option>
              {feeHeads.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="w-28">
          <Field label="Amount (₹)" htmlFor="amount" error={errors.amount}>
            <Input id="amount" name="amount" type="number" min="0" step="0.01" required invalid={!!errors.amount} />
          </Field>
        </div>
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Saving…" : "Set amount"}
        </Button>
      </form>
      {state.message ? <Alert tone="error">{state.message}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
    </div>
  );
}
