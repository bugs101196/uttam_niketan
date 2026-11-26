"use client";

import { useActionState } from "react";
import { Alert, Button } from "@/components/ui/form";
import { runFeeReminderQueue, type QueueRunState } from "./actions";

export function RunFeeReminderQueueButton() {
  const [state, action, pending] = useActionState<QueueRunState, FormData>(() => runFeeReminderQueue(), {});
  return (
    <form action={action} className="space-y-3">
      {state.message ? <Alert tone={state.tone ?? "info"}>{state.message}</Alert> : null}
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Checking…" : "Check overdue invoices now"}
      </Button>
    </form>
  );
}
