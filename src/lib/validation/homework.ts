import { z } from "zod";
import { isIsoDate } from "@/lib/dates";

export const homeworkSchema = z.object({
  section_id: z.string().uuid("Choose a section"),
  subject: z.string().trim().min(1, "Subject is required").max(100, "Subject must be at most 100 characters"),
  description_en: z.string().trim().min(1, "English description is required").max(2000, "Must be at most 2000 characters"),
  description_hi: z.string().trim().min(1, "Hindi description is required").max(2000, "Must be at most 2000 characters"),
  due_date: z.string().refine(isIsoDate, "Choose a valid due date"),
});

export type HomeworkInput = z.infer<typeof homeworkSchema>;
