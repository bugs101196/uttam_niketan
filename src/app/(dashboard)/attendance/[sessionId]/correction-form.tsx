"use client";

import { useActionState } from "react";
import { Alert, Button, Field, Input, Select } from "@/components/ui/form";
import { ATTENDANCE_STATUSES, STATUS_LABELS, type AttendanceStatus } from "@/lib/attendance-status";
import { correctAttendance, type CorrectionState } from "../actions";

export function CorrectionForm({
  sessionId,
  studentId,
  studentName,
  current,
}: {
  sessionId: string;
  studentId: string;
  studentName: string;
  current: AttendanceStatus;
}) {
  const [state, action, pending] = useActionState<CorrectionState, FormData>(
    correctAttendance.bind(null, sessionId),
    {},
  );
  const idBase = `correct-${studentId}`;

  return (
    <form action={action} className="mt-3 space-y-3 rounded-lg border border-border bg-background p-3">
      {state.message ? <Alert tone="error">{state.message}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      <input type="hidden" name="student_id" value={studentId} />
      <Field label={`New status for ${studentName}`} htmlFor={`${idBase}-status`}>
        <Select id={`${idBase}-status`} name="status" defaultValue={current}>
          {ATTENDANCE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Reason (kept in the history)" htmlFor={`${idBase}-reason`} error={state.fieldErrors?.reason}>
        <Input id={`${idBase}-reason`} name="reason" required maxLength={300} invalid={!!state.fieldErrors?.reason} />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save correction"}
      </Button>
    </form>
  );
}
