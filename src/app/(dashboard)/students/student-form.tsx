"use client";

import { useActionState } from "react";
import { Alert, Button, Field, Input, Select } from "@/components/ui/form";
import type { SectionOption } from "@/services/students";
import type { StudentFormState } from "./actions";

export interface StudentFormValues {
  admission_no: string;
  full_name: string;
  section_id: string;
  roll_no: string;
  guardian_name: string;
  guardian_phone: string;
  preferred_language: string;
  guardian_notifications_consent: boolean;
  enrollment_status: string;
}

export const emptyStudent: StudentFormValues = {
  admission_no: "",
  full_name: "",
  section_id: "",
  roll_no: "",
  guardian_name: "",
  guardian_phone: "",
  preferred_language: "hi",
  guardian_notifications_consent: false,
  enrollment_status: "active",
};

export function StudentForm({
  action,
  initial,
  sections,
  submitLabel,
  showStatus,
}: {
  action: (state: StudentFormState, formData: FormData) => Promise<StudentFormState>;
  initial: StudentFormValues;
  sections: SectionOption[];
  submitLabel: string;
  showStatus: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const errors = state.fieldErrors ?? {};
  // After a failed submit, show what the user typed rather than the original values.
  const v = state.values
    ? {
        ...initial,
        ...state.values,
        guardian_notifications_consent: state.values.guardian_notifications_consent === "on",
      }
    : initial;
  const describedBy = (name: string) => (errors[name] ? `${name}-error` : undefined);

  return (
    // Remount after each attempt so the inputs pick up the echoed values.
    <form key={state.attempt ?? 0} action={formAction} className="space-y-5" noValidate>
      {state.message ? <Alert tone="error">{state.message}</Alert> : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Admission number" htmlFor="admission_no" error={errors.admission_no}>
          <Input
            id="admission_no"
            name="admission_no"
            required
            defaultValue={v.admission_no}
            invalid={!!errors.admission_no}
            aria-describedby={describedBy("admission_no")}
            autoCapitalize="characters"
          />
        </Field>
        <Field label="Full name" htmlFor="full_name" error={errors.full_name}>
          <Input
            id="full_name"
            name="full_name"
            required
            defaultValue={v.full_name}
            invalid={!!errors.full_name}
            aria-describedby={describedBy("full_name")}
            autoComplete="off"
          />
        </Field>
        <Field label="Class and section" htmlFor="section_id" error={errors.section_id}>
          <Select
            id="section_id"
            name="section_id"
            required
            defaultValue={v.section_id}
            invalid={!!errors.section_id}
            aria-describedby={describedBy("section_id")}
          >
            <option value="">Choose…</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Roll number (optional)" htmlFor="roll_no" error={errors.roll_no}>
          <Input
            id="roll_no"
            name="roll_no"
            inputMode="numeric"
            defaultValue={v.roll_no}
            invalid={!!errors.roll_no}
            aria-describedby={describedBy("roll_no")}
          />
        </Field>
      </div>

      <fieldset className="space-y-5 rounded-xl border border-border p-4">
        <legend className="px-1 font-semibold">Parent / guardian</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Guardian name (optional)" htmlFor="guardian_name" error={errors.guardian_name}>
            <Input
              id="guardian_name"
              name="guardian_name"
              defaultValue={v.guardian_name}
              invalid={!!errors.guardian_name}
              aria-describedby={describedBy("guardian_name")}
              autoComplete="off"
            />
          </Field>
          <Field
            label="Guardian mobile (optional)"
            htmlFor="guardian_phone"
            error={errors.guardian_phone}
            hint="10-digit mobile number, e.g. 98765 43210"
          >
            <Input
              id="guardian_phone"
              name="guardian_phone"
              type="tel"
              inputMode="tel"
              defaultValue={v.guardian_phone}
              invalid={!!errors.guardian_phone}
              aria-describedby={describedBy("guardian_phone") ?? "guardian_phone-hint"}
              autoComplete="off"
            />
          </Field>
          <Field label="Message language" htmlFor="preferred_language" error={errors.preferred_language}>
            <Select id="preferred_language" name="preferred_language" defaultValue={v.preferred_language}>
              <option value="hi">Hindi</option>
              <option value="en">English</option>
            </Select>
          </Field>
        </div>
        <label className="flex min-h-11 items-start gap-3">
          <input
            type="checkbox"
            name="guardian_notifications_consent"
            defaultChecked={v.guardian_notifications_consent}
            className="mt-1 size-5 accent-brand"
          />
          <span>
            Guardian has agreed to receive school messages (such as absence alerts) on this number
            <span className="block text-sm text-muted">Record consent only when the guardian has given it.</span>
          </span>
        </label>
      </fieldset>

      {showStatus ? (
        <Field label="Enrolment status" htmlFor="enrollment_status" error={errors.enrollment_status}>
          <Select id="enrollment_status" name="enrollment_status" defaultValue={v.enrollment_status}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="transferred">Transferred</option>
          </Select>
        </Field>
      ) : (
        <input type="hidden" name="enrollment_status" value="active" />
      )}

      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
