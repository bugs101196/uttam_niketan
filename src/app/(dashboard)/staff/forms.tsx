"use client";

import { useActionState } from "react";
import { Alert, Button, Field, Input, Select } from "@/components/ui/form";
import type { SectionOption } from "@/services/students";
import { assignSection, createStaffAccount, resetStaffPassword, type StaffActionState } from "./actions";

function Credentials({ state }: { state: StaffActionState }) {
  if (!state.credentials) return null;
  return (
    <Alert tone="success">
      <p className="font-semibold">{state.success}</p>
      <p className="mt-2">Share these privately. The password is shown only once:</p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 font-mono text-sm">
        <dt>Email</dt>
        <dd className="break-all">{state.credentials.email}</dd>
        <dt>Password</dt>
        <dd className="select-all">{state.credentials.password}</dd>
      </dl>
    </Alert>
  );
}

export function AddStaffForm() {
  const [state, action, pending] = useActionState<StaffActionState, FormData>(createStaffAccount, {});
  const errors = state.fieldErrors ?? {};
  return (
    <div className="space-y-4">
      {state.message ? <Alert tone="error">{state.message}</Alert> : null}
      <Credentials state={state} />
      <form key={state.attempt ?? 0} action={action} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label="Full name" htmlFor="staff_full_name" error={errors.full_name}>
          <Input id="staff_full_name" name="full_name" required invalid={!!errors.full_name} autoComplete="off" />
        </Field>
        <Field label="Email address (used to sign in)" htmlFor="staff_email" error={errors.email}>
          <Input id="staff_email" name="email" type="email" required invalid={!!errors.email} autoComplete="off" />
        </Field>
        <Field label="Role" htmlFor="staff_role" error={errors.role}>
          <Select id="staff_role" name="role" defaultValue="teacher">
            <option value="teacher">Teacher</option>
            <option value="admin">Principal / admin</option>
          </Select>
        </Field>
        <div className="flex items-end">
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Creating…" : "Create account"}
          </Button>
        </div>
      </form>
    </div>
  );
}

export function AssignSectionForm({
  teachers,
  sections,
}: {
  teachers: { id: string; name: string }[];
  sections: SectionOption[];
}) {
  const [state, action, pending] = useActionState<StaffActionState, FormData>(assignSection, {});
  return (
    <div className="space-y-4">
      {state.message ? <Alert tone="error">{state.message}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      <form action={action} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label="Teacher" htmlFor="assign_teacher">
          <Select id="assign_teacher" name="teacher_id" required defaultValue="">
            <option value="">Choose…</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Class and section" htmlFor="assign_section">
          <Select id="assign_section" name="section_id" required defaultValue="">
            <option value="">Choose…</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? "Assigning…" : "Assign"}
        </Button>
      </form>
    </div>
  );
}

export function ResetPasswordForm({ profileId, name }: { profileId: string; name: string }) {
  const [state, action, pending] = useActionState<StaffActionState, FormData>(
    resetStaffPassword.bind(null, profileId),
    {},
  );
  return (
    <div className="space-y-3">
      {state.message ? <Alert tone="error">{state.message}</Alert> : null}
      <Credentials state={state} />
      <form
        action={action}
        onSubmit={(e) => {
          if (!confirm(`Reset the password for ${name}? Their current password will stop working.`)) e.preventDefault();
        }}
      >
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Resetting…" : "Reset password"}
        </Button>
      </form>
    </div>
  );
}
