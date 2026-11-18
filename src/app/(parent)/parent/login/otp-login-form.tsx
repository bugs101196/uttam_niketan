"use client";

import { useActionState, useEffect, useState } from "react";
import { Alert, Button, Field, Input } from "@/components/ui/form";
import { requestParentOtp, verifyParentOtp, type ParentLoginState } from "./actions";

const initial: ParentLoginState = { step: "phone" };

export function ParentLoginForm({ next, notice }: { next?: string; notice?: string }) {
  const [phoneState, phoneAction, phonePending] = useActionState(requestParentOtp, initial);
  const [otpState, otpAction, otpPending] = useActionState(verifyParentOtp, initial);
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (phoneState.step === "otp" && phoneState.phone) {
      setStep("otp");
      setPhone(phoneState.phone);
    } else if (phoneState.error) {
      setStep("phone");
    }
  }, [phoneState]);

  useEffect(() => {
    // verifyParentOtp bounces back to "phone" for a disabled account.
    if (otpState.step === "phone" && otpState.error) setStep("phone");
  }, [otpState]);

  if (step === "phone") {
    return (
      <form action={phoneAction} className="space-y-5" noValidate>
        {phoneState.error ? <Alert tone="error">{phoneState.error}</Alert> : notice ? <Alert tone="info">{notice}</Alert> : null}
        <Field label="Mobile number" htmlFor="phone">
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            placeholder="98765 43210"
            defaultValue={phoneState.phone}
          />
        </Field>
        <Button type="submit" disabled={phonePending} className="w-full">
          {phonePending ? "Sending code…" : "Send code"}
        </Button>
      </form>
    );
  }

  return (
    <form action={otpAction} className="space-y-5" noValidate>
      {otpState.error ? <Alert tone="error">{otpState.error}</Alert> : null}
      <input type="hidden" name="next" value={next ?? ""} />
      <input type="hidden" name="phone" value={phone} />
      <p className="text-sm text-muted">Code sent to {phone}.</p>
      <Field label="6-digit code" htmlFor="token">
        <Input
          id="token"
          name="token"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
        />
      </Field>
      <Button type="submit" disabled={otpPending} className="w-full">
        {otpPending ? "Verifying…" : "Verify and sign in"}
      </Button>
      <button
        type="button"
        onClick={() => setStep("phone")}
        className="min-h-11 w-full text-center text-sm text-muted hover:underline"
      >
        Use a different number
      </button>
    </form>
  );
}
