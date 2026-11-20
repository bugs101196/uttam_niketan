"use server";

import { revalidatePath } from "next/cache";
import { describeFeesError } from "@/lib/fees";
import { requireAdmin } from "@/lib/auth/staff";
import { cashPaymentSchema, createInvoiceSchema, reversePaymentSchema } from "@/lib/validation/fees";
import { fieldErrors } from "@/lib/validation/student";
import { createInvoice, recordCashPayment, reversePayment } from "@/services/fees";

export interface FeesActionState {
  message?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
  attempt?: number;
}

const next = (prev: FeesActionState) => (prev.attempt ?? 0) + 1;

export async function createInvoiceAction(
  studentId: string,
  prev: FeesActionState,
  formData: FormData,
): Promise<FeesActionState> {
  await requireAdmin();
  const parsed = createInvoiceSchema.safeParse({ label: formData.get("label") });
  if (!parsed.success) {
    return { message: "Please correct the highlighted fields.", fieldErrors: fieldErrors(parsed.error), attempt: next(prev) };
  }

  try {
    await createInvoice(studentId, parsed.data.label);
  } catch (error) {
    return { message: describeFeesError(error as { code?: string; message?: string }), attempt: next(prev) };
  }

  revalidatePath(`/fees/${studentId}`);
  return { success: "Invoice created.", attempt: next(prev) };
}

export async function recordCashPaymentAction(
  studentId: string,
  invoiceId: string,
  prev: FeesActionState,
  formData: FormData,
): Promise<FeesActionState> {
  await requireAdmin();
  const parsed = cashPaymentSchema.safeParse({ amount: formData.get("amount"), note: formData.get("note") });
  if (!parsed.success) {
    return { message: "Please correct the highlighted fields.", fieldErrors: fieldErrors(parsed.error), attempt: next(prev) };
  }

  try {
    await recordCashPayment(invoiceId, parsed.data.amount, parsed.data.note);
  } catch (error) {
    return { message: describeFeesError(error as { code?: string; message?: string }), attempt: next(prev) };
  }

  revalidatePath(`/fees/${studentId}`);
  return { success: "Payment recorded.", attempt: next(prev) };
}

export async function reversePaymentAction(
  studentId: string,
  paymentId: string,
  prev: FeesActionState,
  formData: FormData,
): Promise<FeesActionState> {
  await requireAdmin();
  const parsed = reversePaymentSchema.safeParse({ reason: formData.get("reason") });
  if (!parsed.success) {
    return { message: "Please correct the highlighted fields.", fieldErrors: fieldErrors(parsed.error), attempt: next(prev) };
  }

  try {
    await reversePayment(paymentId, parsed.data.reason);
  } catch (error) {
    return { message: describeFeesError(error as { code?: string; message?: string }), attempt: next(prev) };
  }

  revalidatePath(`/fees/${studentId}`);
  return { success: "Payment reversed.", attempt: next(prev) };
}
