import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert } from "@/components/ui/form";
import { requireAdmin } from "@/lib/auth/staff";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { getStudent } from "@/services/students";
import { listInvoicesForStudent } from "@/services/fees";
import { createInvoiceAction, recordCashPaymentAction, reversePaymentAction } from "./actions";
import { CreateInvoiceForm, RecordPaymentForm, ReversePaymentForm } from "./forms";

export const metadata: Metadata = { title: "Fees" };

const statusStyle: Record<string, string> = {
  unpaid: "text-red-700",
  partial: "text-amber-700",
  paid: "text-green-700",
  waived: "text-muted",
};

export default async function StudentFeesPage({ params }: { params: Promise<{ studentId: string }> }) {
  await requireAdmin();
  const { studentId } = await params;

  // RLS returns nothing for a student outside the admin's own school.
  const student = await getStudent(studentId);
  if (!student) notFound();

  const invoices = await listInvoicesForStudent(studentId);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/fees" className="inline-flex min-h-11 items-center font-semibold text-brand">
          ← Fees
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{student.full_name}</h1>
        <p className="text-muted">
          {student.sections.classes.name} – {student.sections.name} · {student.admission_no}
        </p>
      </div>

      <section aria-labelledby="create-invoice" className="rounded-xl border border-border bg-surface p-5">
        <h2 id="create-invoice" className="mb-4 text-lg font-bold">
          Create an invoice
        </h2>
        <CreateInvoiceForm action={createInvoiceAction.bind(null, studentId)} />
      </section>

      <section aria-labelledby="invoices">
        <h2 id="invoices" className="mb-3 text-lg font-bold">
          Invoices ({invoices.length})
        </h2>
        {invoices.length === 0 ? (
          <p className="text-muted">No invoices yet.</p>
        ) : (
          <ul className="space-y-4">
            {invoices.map((invoice) => {
              const reversedIds = new Set(invoice.payments.map((p) => p.reversedPaymentId).filter((id) => id !== null));
              return (
                <li key={invoice.id} className="rounded-xl border border-border bg-surface p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-semibold">{invoice.label}</p>
                    <p className={`text-sm font-semibold uppercase ${statusStyle[invoice.status]}`}>{invoice.status}</p>
                  </div>
                  <p className="text-sm text-muted">Created {formatDate(invoice.createdAt)}</p>

                  <dl className="mt-3 divide-y divide-border rounded-lg border border-border">
                    {invoice.items.map((item) => (
                      <div key={item.feeHeadId} className="flex justify-between px-3 py-2 text-sm">
                        <dt>{item.name}</dt>
                        <dd>{formatMoney(item.amount)}</dd>
                      </div>
                    ))}
                    <div className="flex justify-between px-3 py-2 text-sm font-semibold">
                      <dt>Total</dt>
                      <dd>{formatMoney(invoice.totalAmount)}</dd>
                    </div>
                    <div className="flex justify-between px-3 py-2 text-sm font-semibold">
                      <dt>Balance</dt>
                      <dd>{formatMoney(invoice.balance)}</dd>
                    </div>
                  </dl>

                  {invoice.payments.length > 0 ? (
                    <div className="mt-4">
                      <h3 className="text-sm font-semibold">Payment history</h3>
                      <ul className="mt-2 space-y-2">
                        {invoice.payments.map((payment) => {
                          const canReverse = payment.status === "completed" && payment.amount > 0 && !reversedIds.has(payment.id);
                          return (
                            <li key={payment.id} className="rounded-lg border border-border p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                <span className={payment.amount < 0 ? "text-red-700" : ""}>
                                  {formatMoney(payment.amount)} · {payment.method}
                                  {payment.status === "reversed" ? " · reversal" : ""}
                                </span>
                                <span className="text-muted">{formatDate(payment.createdAt)}</span>
                              </div>
                              {payment.note ? <p className="mt-1 text-sm text-muted">{payment.note}</p> : null}
                              {canReverse ? (
                                <div className="mt-2">
                                  <ReversePaymentForm action={reversePaymentAction.bind(null, studentId, payment.id)} />
                                </div>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : null}

                  {invoice.status !== "waived" && invoice.status !== "paid" ? (
                    <div className="mt-4">
                      <RecordPaymentForm action={recordCashPaymentAction.bind(null, studentId, invoice.id)} />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {invoices.length === 0 ? (
        <Alert tone="info">Set fees for this student&apos;s class under Settings before creating an invoice.</Alert>
      ) : null}
    </div>
  );
}
