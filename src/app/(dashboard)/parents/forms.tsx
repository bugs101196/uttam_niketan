"use client";

import { useActionState } from "react";
import { Alert, Button, Field, Input, Select } from "@/components/ui/form";
import { createGuardian, linkStudent, type GuardianActionState } from "./actions";

export function AddGuardianForm() {
  const [state, action, pending] = useActionState<GuardianActionState, FormData>(createGuardian, {});
  const errors = state.fieldErrors ?? {};
  return (
    <div className="space-y-4">
      {state.message ? <Alert tone="error">{state.message}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      <form key={state.attempt ?? 0} action={action} className="grid gap-4 sm:grid-cols-3" noValidate>
        <Field label="Full name" htmlFor="guardian_full_name" error={errors.full_name}>
          <Input id="guardian_full_name" name="full_name" required invalid={!!errors.full_name} autoComplete="off" />
        </Field>
        <Field label="Mobile number" htmlFor="guardian_phone" error={errors.phone} hint="e.g. 98765 43210">
          <Input id="guardian_phone" name="phone" required invalid={!!errors.phone} autoComplete="off" />
        </Field>
        <Field label="Language" htmlFor="guardian_language" error={errors.preferred_language}>
          <Select id="guardian_language" name="preferred_language" defaultValue="hi">
            <option value="hi">Hindi</option>
            <option value="en">English</option>
          </Select>
        </Field>
        <div className="sm:col-span-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Creating…" : "Create parent/guardian account"}
          </Button>
        </div>
      </form>
    </div>
  );
}

export function LinkStudentForm({ guardians }: { guardians: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<GuardianActionState, FormData>(linkStudent, {});
  const errors = state.fieldErrors ?? {};
  return (
    <div className="space-y-4">
      {state.message ? <Alert tone="error">{state.message}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      <form key={state.attempt ?? 0} action={action} className="grid gap-4 sm:grid-cols-[1fr_1fr_1fr_auto]" noValidate>
        <Field label="Parent/guardian" htmlFor="link_guardian" error={errors.guardian_id}>
          <Select id="link_guardian" name="guardian_id" required defaultValue="">
            <option value="">Choose…</option>
            {guardians.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Student's admission number" htmlFor="link_admission_no" error={errors.admission_no}>
          <Input id="link_admission_no" name="admission_no" required invalid={!!errors.admission_no} autoComplete="off" />
        </Field>
        <Field label="Relationship" htmlFor="link_relationship" hint="e.g. Mother, Father">
          <Input id="link_relationship" name="relationship" autoComplete="off" />
        </Field>
        <div className="flex items-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Linking…" : "Link"}
          </Button>
        </div>
      </form>
    </div>
  );
}
