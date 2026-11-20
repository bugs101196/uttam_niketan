"use client";

import { useActionState } from "react";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui/form";
import type { HomeworkActionState } from "./actions";

type HomeworkFormProps = {
  action: (prev: HomeworkActionState, formData: FormData) => Promise<HomeworkActionState>;
  sections: { id: string; label: string }[];
  submitLabel: string;
  pendingLabel: string;
  defaultValues?: {
    section_id?: string;
    subject?: string;
    description_en?: string;
    description_hi?: string;
    due_date?: string;
  };
};

export function HomeworkForm({ action, sections, submitLabel, pendingLabel, defaultValues }: HomeworkFormProps) {
  const [state, formAction, pending] = useActionState<HomeworkActionState, FormData>(action, {});
  const errors = state.fieldErrors ?? {};

  return (
    <div className="space-y-4">
      {state.message ? <Alert tone="error">{state.message}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      <form key={state.attempt ?? 0} action={formAction} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Section" htmlFor="hw_section" error={errors.section_id}>
            <Select id="hw_section" name="section_id" required defaultValue={defaultValues?.section_id ?? ""}>
              <option value="">Choose…</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Subject" htmlFor="hw_subject" error={errors.subject}>
            <Input
              id="hw_subject"
              name="subject"
              required
              invalid={!!errors.subject}
              autoComplete="off"
              defaultValue={defaultValues?.subject}
              placeholder="e.g. Mathematics"
            />
          </Field>
        </div>
        <Field label="Due date" htmlFor="hw_due_date" error={errors.due_date}>
          <Input
            id="hw_due_date"
            name="due_date"
            type="date"
            required
            invalid={!!errors.due_date}
            defaultValue={defaultValues?.due_date}
          />
        </Field>
        <Field label="Description (English)" htmlFor="hw_description_en" error={errors.description_en}>
          <Textarea
            id="hw_description_en"
            name="description_en"
            required
            invalid={!!errors.description_en}
            defaultValue={defaultValues?.description_en}
          />
        </Field>
        <Field label="Description (Hindi)" htmlFor="hw_description_hi" error={errors.description_hi}>
          <Textarea
            id="hw_description_hi"
            name="description_hi"
            required
            invalid={!!errors.description_hi}
            defaultValue={defaultValues?.description_hi}
          />
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </Button>
      </form>
    </div>
  );
}
