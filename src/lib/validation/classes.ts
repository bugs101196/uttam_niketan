import { z } from "zod";
import { isIsoDate } from "@/lib/dates";

// Names may use any script (e.g. Hindi), digits, spaces and simple punctuation.
const label = (max: number, what: string) =>
  z
    .string()
    .trim()
    .min(1, `${what} is required`)
    .max(max, `${what} must be at most ${max} characters`)
    .regex(/^[\p{L}\p{M}\p{N} .()\-/]+$/u, `${what} can use letters, numbers, spaces and . ( ) - /`);

export const academicYearSchema = z
  .object({
    name: label(20, "Year name"),
    start_date: z.string().refine(isIsoDate, "Choose a start date"),
    end_date: z.string().refine(isIsoDate, "Choose an end date"),
    copy_structure: z.boolean(),
  })
  .refine((v) => v.end_date > v.start_date, { path: ["end_date"], message: "End date must be after the start date" });

export const classSchema = z.object({
  name: label(40, "Class name"),
  sort_order: z.coerce.number().int("Order must be a whole number").min(0).max(99),
});

export const sectionSchema = z.object({
  name: label(10, "Section name"),
});
