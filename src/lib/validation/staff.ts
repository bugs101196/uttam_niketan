import { randomBytes } from "node:crypto";
import { z } from "zod";

export const newStaffSchema = z.object({
  full_name: z.string().trim().min(2, "Full name is required").max(100, "Full name must be at most 100 characters"),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  role: z.enum(["teacher", "admin"], { message: "Choose a role" }),
});

export const assignmentSchema = z.object({
  teacher_id: z.string().uuid("Choose a teacher"),
  section_id: z.string().uuid("Choose a class and section"),
});

/** Readable temporary password, e.g. "Kq7m-3xPz-Wd9c". Shown once to the admin. */
export function temporaryPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = randomBytes(12);
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]);
  return [chars.slice(0, 4), chars.slice(4, 8), chars.slice(8, 12)].map((g) => g.join("")).join("-");
}
