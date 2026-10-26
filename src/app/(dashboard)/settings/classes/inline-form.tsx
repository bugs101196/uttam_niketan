"use client";

import { useActionState, useId } from "react";
import { Alert, Button, Field, Input } from "@/components/ui/form";
import type { FormState } from "./actions";

type EchoState = FormState & { values?: Record<string, string>; attempt?: number };

export interface InlineField {
  name: string;
  label: string;
  defaultValue?: string | number;
  type?: "text" | "number" | "date";
  placeholder?: string;
  width?: string; // Tailwind width class, e.g. "w-24"
}

/**
 * A small form for one action (add, rename, delete…) that shows its own
 * result. Optional confirmation for destructive or finalising actions.
 */
export function InlineForm({
  action,
  fields = [],
  submitLabel,
  pendingLabel = "Saving…",
  variant = "secondary",
  confirmText,
  checkbox,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  fields?: InlineField[];
  submitLabel: string;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "danger";
  confirmText?: string;
  checkbox?: { name: string; label: string; defaultChecked?: boolean };
}) {
  // React clears a form after each submit. On an error, keep what was typed
  // (echoed back and remounted via `key`); on success, start fresh.
  const [state, formAction, pending] = useActionState(
    async (prev: EchoState, formData: FormData): Promise<EchoState> => {
      const result = await action(prev, formData);
      const values: Record<string, string> = {};
      for (const [k, v] of formData.entries()) if (typeof v === "string" && !k.startsWith("$")) values[k] = v;
      return { ...result, values: result.success ? undefined : values, attempt: (prev.attempt ?? 0) + 1 };
    },
    {},
  );
  const errors = state.fieldErrors ?? {};
  const idBase = useId();

  return (
    <form
      key={state.attempt ?? 0}
      action={formAction}
      onSubmit={(e) => {
        if (confirmText && !window.confirm(confirmText)) e.preventDefault();
      }}
      className="space-y-2"
      noValidate
    >
      {fields.length > 0 ? (
        <div className="flex flex-wrap items-end gap-2">
          {fields.map((f) => (
            <div key={f.name} className={f.width ?? "min-w-40 flex-1"}>
              <Field label={f.label} htmlFor={`${idBase}-${f.name}`} error={errors[f.name]}>
                <Input
                  id={`${idBase}-${f.name}`}
                  name={f.name}
                  type={f.type ?? "text"}
                  defaultValue={state.values?.[f.name] ?? f.defaultValue}
                  placeholder={f.placeholder}
                  invalid={!!errors[f.name]}
                  inputMode={f.type === "number" ? "numeric" : undefined}
                />
              </Field>
            </div>
          ))}
          <Button type="submit" variant={variant} disabled={pending}>
            {pending ? pendingLabel : submitLabel}
          </Button>
        </div>
      ) : (
        <Button type="submit" variant={variant} disabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </Button>
      )}
      {checkbox ? (
        <label className="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            name={checkbox.name}
            defaultChecked={state.values ? state.values[checkbox.name] === "on" : checkbox.defaultChecked}
            className="size-5 accent-brand"
          />
          {checkbox.label}
        </label>
      ) : null}
      {state.message ? <Alert tone="error">{state.message}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
    </form>
  );
}
