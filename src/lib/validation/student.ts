import { z } from "zod";

/**
 * Normalises a guardian phone number to E.164 (+91XXXXXXXXXX).
 * Accepts the ways numbers are usually written in India: "98765 43210",
 * "098765-43210", "+91 98765 43210", "919876543210". Numbers with another
 * country code must start with "+". Returns null when the input is not a
 * plausible number.
 */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/[\s\-().]/g, "").replace(/^\+/, "");
  if (!/^\d+$/.test(digits)) return null;

  const indianMobile = /^[6-9]\d{9}$/;
  if (!hasPlus) {
    if (indianMobile.test(digits)) return `+91${digits}`;
    if (digits.length === 11 && digits.startsWith("0") && indianMobile.test(digits.slice(1)))
      return `+91${digits.slice(1)}`;
    if (digits.length === 12 && digits.startsWith("91") && indianMobile.test(digits.slice(2))) return `+${digits}`;
    return null;
  }
  if (digits.startsWith("91")) return indianMobile.test(digits.slice(2)) ? `+${digits}` : null;
  return /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : null;
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be at most ${max} characters`)
    .transform((v) => (v === "" ? null : v));

export const studentSchema = z.object({
  admission_no: z
    .string()
    .trim()
    .min(1, "Admission number is required")
    .max(30, "Admission number must be at most 30 characters")
    .regex(/^[A-Za-z0-9/\-]+$/, "Use only letters, numbers, / and -"),
  full_name: z.string().trim().min(2, "Full name is required").max(100, "Full name must be at most 100 characters"),
  section_id: z.string().uuid("Choose a class and section"),
  roll_no: z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === "") return null;
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1 || n > 999) {
        ctx.addIssue({ code: "custom", message: "Roll number must be a whole number from 1 to 999" });
        return z.NEVER;
      }
      return n;
    }),
  guardian_name: optionalText(100),
  guardian_phone: z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === "") return null;
      const phone = normalizePhone(v);
      if (!phone) {
        ctx.addIssue({ code: "custom", message: "Enter a 10-digit mobile number, e.g. 98765 43210" });
        return z.NEVER;
      }
      return phone;
    }),
  preferred_language: z.enum(["hi", "en"], { message: "Choose a language" }),
  guardian_notifications_consent: z.boolean(),
  enrollment_status: z.enum(["active", "inactive", "transferred"], { message: "Choose a status" }),
});

export type StudentInput = z.infer<typeof studentSchema>;

/** Reads the student form. Checkbox fields are absent when unchecked. */
export function parseStudentForm(formData: FormData) {
  const text = (key: string) => String(formData.get(key) ?? "");
  return studentSchema.safeParse({
    admission_no: text("admission_no"),
    full_name: text("full_name"),
    section_id: text("section_id"),
    roll_no: text("roll_no"),
    guardian_name: text("guardian_name"),
    guardian_phone: text("guardian_phone"),
    preferred_language: text("preferred_language"),
    guardian_notifications_consent: formData.get("guardian_notifications_consent") === "on",
    enrollment_status: text("enrollment_status") || "active",
  });
}

/** First error message per field, for showing next to inputs. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
