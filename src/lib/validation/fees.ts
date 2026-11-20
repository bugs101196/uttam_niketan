import { z } from "zod";

export const createInvoiceSchema = z.object({
  label: z.string().trim().min(1, "A label is required").max(100, "Must be at most 100 characters"),
});

export const cashPaymentSchema = z.object({
  amount: z.coerce
    .number({ message: "Enter an amount" })
    .positive("Amount must be greater than zero")
    .max(10_000_000, "Amount is too large"),
  note: z
    .string()
    .trim()
    .max(300, "Must be at most 300 characters")
    .optional()
    .transform((v) => v ?? ""),
});

export const reversePaymentSchema = z.object({
  reason: z.string().trim().min(3, "Give a short reason for the reversal").max(300, "Must be at most 300 characters"),
});

export const feeHeadSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(50, "Must be at most 50 characters"),
  name_hi: z
    .string()
    .trim()
    .max(50, "Must be at most 50 characters")
    .optional()
    .transform((v) => (v ? v : null)),
});

export const feeAmountSchema = z.object({
  fee_head_id: z.string().uuid("Choose a fee head"),
  amount: z.coerce
    .number({ message: "Enter an amount" })
    .min(0, "Amount cannot be negative")
    .max(10_000_000, "Amount is too large"),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type CashPaymentInput = z.infer<typeof cashPaymentSchema>;
export type ReversePaymentInput = z.infer<typeof reversePaymentSchema>;
export type FeeHeadInput = z.infer<typeof feeHeadSchema>;
export type FeeAmountInput = z.infer<typeof feeAmountSchema>;
