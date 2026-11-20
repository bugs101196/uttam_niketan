import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type InvoiceStatus = Database["public"]["Enums"]["invoice_status"];
export type PaymentMethod = Database["public"]["Enums"]["payment_method"];
export type PaymentStatus = Database["public"]["Enums"]["payment_status"];

type SupabaseClient = ReturnType<typeof createClient> extends Promise<infer T> ? T : never;

export interface InvoiceLineItem {
  feeHeadId: string;
  name: string;
  nameHi: string | null;
  amount: number;
}

export interface Payment {
  id: string;
  amount: number; // positive = payment, negative = reversal
  method: PaymentMethod;
  status: PaymentStatus; // 'completed' = a payment, 'reversed' = a reversal entry -- descriptive only
  note: string | null;
  reversedPaymentId: string | null;
  createdAt: string;
}

export interface InvoiceDetail {
  id: string;
  studentId: string;
  label: string;
  totalAmount: number;
  status: InvoiceStatus;
  createdAt: string;
  items: InvoiceLineItem[];
  payments: Payment[];
  balance: number; // totalAmount minus the sum of every payment's signed amount
}

type InvoiceRow = { id: string; student_id: string; label: string; total_amount: number; status: InvoiceStatus; created_at: string };

/** Joins invoice_items and fee_payments onto a batch of already-fetched invoice rows. */
async function attachLines(supabase: SupabaseClient, invoices: InvoiceRow[]): Promise<InvoiceDetail[]> {
  if (invoices.length === 0) return [];
  const ids = invoices.map((i) => i.id);

  const [itemsResult, paymentsResult] = await Promise.all([
    supabase
      .from("invoice_items")
      .select("invoice_id, amount, fee_heads!inner(id, name, name_hi)")
      .in("invoice_id", ids),
    supabase
      .from("fee_payments")
      .select("id, invoice_id, amount, method, status, note, reversed_payment_id, created_at")
      .in("invoice_id", ids)
      .order("created_at"),
  ]);
  if (itemsResult.error) throw itemsResult.error;
  if (paymentsResult.error) throw paymentsResult.error;

  return invoices.map((inv) => {
    const items = (itemsResult.data ?? [])
      .filter((it) => it.invoice_id === inv.id)
      .map((it) => ({ feeHeadId: it.fee_heads.id, name: it.fee_heads.name, nameHi: it.fee_heads.name_hi, amount: it.amount }));
    const payments = (paymentsResult.data ?? [])
      .filter((p) => p.invoice_id === inv.id)
      .map((p) => ({
        id: p.id,
        amount: p.amount,
        method: p.method,
        status: p.status,
        note: p.note,
        reversedPaymentId: p.reversed_payment_id,
        createdAt: p.created_at,
      }));
    const balance = inv.total_amount - payments.reduce((sum, p) => sum + p.amount, 0);
    return {
      id: inv.id,
      studentId: inv.student_id,
      label: inv.label,
      totalAmount: inv.total_amount,
      status: inv.status,
      createdAt: inv.created_at,
      items,
      payments,
      balance,
    };
  });
}

/** Every invoice for one student, newest first. RLS scopes this to the admin's own school. */
export async function listInvoicesForStudent(studentId: string): Promise<InvoiceDetail[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("student_invoices")
    .select("id, student_id, label, total_amount, status, created_at")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return attachLines(supabase, data ?? []);
}

export interface OwnInvoice extends InvoiceDetail {
  studentName: string;
}

/** Every invoice across all of the signed-in guardian's linked children. */
export async function listOwnInvoices(): Promise<OwnInvoice[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("student_invoices")
    .select("id, student_id, label, total_amount, status, created_at, students!inner(full_name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const detailed = await attachLines(supabase, data ?? []);
  return detailed.map((detail, i) => ({ ...detail, studentName: data![i].students.full_name }));
}

export async function createInvoice(studentId: string, label: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_invoice", { p_student_id: studentId, p_label: label });
  if (error) throw error;
  return data;
}

export async function recordCashPayment(invoiceId: string, amount: number, note: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_cash_payment", {
    p_invoice_id: invoiceId,
    p_amount: amount,
    p_note: note,
  });
  if (error) throw error;
  return data;
}

export async function reversePayment(paymentId: string, reason: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reverse_payment", { p_payment_id: paymentId, p_reason: reason });
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Settings: the fee catalog and per-class pricing. Admin-managed config, not
// the ledger -- see the 20261120000200 migration's grant comment.
// ---------------------------------------------------------------------------

export interface FeeHeadOption {
  id: string;
  name: string;
  nameHi: string | null;
}

export async function listFeeHeads(): Promise<FeeHeadOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("fee_heads").select("id, name, name_hi").order("name");
  if (error) throw error;
  return data.map((h) => ({ id: h.id, name: h.name, nameHi: h.name_hi }));
}

export interface FeeStructureEntry {
  id: string;
  classId: string;
  feeHeadId: string;
  feeHeadName: string;
  amount: number;
}

/** Every priced fee head, per class, for one academic year. */
export async function listFeeStructures(yearId: string): Promise<FeeStructureEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fee_structures")
    .select("id, class_id, fee_head_id, amount, fee_heads!inner(name)")
    .eq("academic_year_id", yearId);
  if (error) throw error;
  return data.map((r) => ({ id: r.id, classId: r.class_id, feeHeadId: r.fee_head_id, feeHeadName: r.fee_heads.name, amount: r.amount }));
}
