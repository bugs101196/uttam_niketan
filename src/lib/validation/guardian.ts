import { z } from "zod";
import { normalizePhone } from "@/lib/validation/student";

export const newGuardianSchema = z.object({
  full_name: z.string().trim().min(2, "Full name is required").max(100, "Full name must be at most 100 characters"),
  phone: z
    .string()
    .trim()
    .transform((v, ctx) => {
      const phone = normalizePhone(v);
      if (!phone) {
        ctx.addIssue({ code: "custom", message: "Enter a 10-digit mobile number, e.g. 98765 43210" });
        return z.NEVER;
      }
      return phone;
    }),
  preferred_language: z.enum(["hi", "en"], { message: "Choose a language" }),
});

export const linkStudentSchema = z.object({
  guardian_id: z.string().uuid("Choose a parent/guardian"),
  student_id: z.string().uuid("Choose a student"),
  relationship: z
    .string()
    .trim()
    .max(50, "Must be at most 50 characters")
    .transform((v) => (v === "" ? null : v)),
});
