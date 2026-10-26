"use client";

import { useActionState } from "react";
import { Alert, Button, Field, Input } from "@/components/ui/form";
import { signIn, type LoginState } from "./actions";

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(signIn, {});

  return (
    <form action={action} className="space-y-5" noValidate>
      {state.error ? <Alert tone="error">{state.error}</Alert> : notice ? <Alert tone="info">{notice}</Alert> : null}
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Email address" htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          required
          defaultValue={state.email}
        />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
