"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/form";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("staff page error", error.digest ?? error.message);
  }, [error]);
  return (
    <div role="alert" className="max-w-xl">
      <h1 className="text-2xl font-bold">This page could not be loaded</h1>
      <p className="mt-2 text-muted">
        Nothing you saved has been lost. Check your internet connection and try again. If it keeps happening, tell the
        school office{error.digest ? ` (reference ${error.digest})` : ""}.
      </p>
      <Button type="button" onClick={reset} className="mt-6">
        Try again
      </Button>
    </div>
  );
}
