import { z } from "zod";
import { normalizePhone } from "@/lib/validation/student";

const phone = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const normalized = normalizePhone(v);
    if (!normalized) {
      ctx.addIssue({ code: "custom", message: "Enter a 10-digit mobile number, e.g. 98765 43210" });
      return z.NEVER;
    }
    return normalized;
  });

export const requestOtpSchema = z.object({ phone });

export const verifyOtpSchema = z.object({
  phone,
  token: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code"),
});
