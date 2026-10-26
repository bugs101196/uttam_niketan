"use client";

import { useActionState } from "react";
import { Alert, Button } from "@/components/ui/form";
import { runNotificationQueue, type QueueRunState } from "./actions";

export function RunQueueButton() {
  const [state, action, pending] = useActionState<QueueRunState, FormData>(() => runNotificationQueue(), {});
  return (
    <form action={action} className="space-y-3">
      {state.message ? <Alert tone={state.tone ?? "info"}>{state.message}</Alert> : null}
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Sending…" : "Send queued alerts now"}
      </Button>
    </form>
  );
}
