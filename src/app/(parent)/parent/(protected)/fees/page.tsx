import type { Metadata } from "next";
import { requireGuardian } from "@/lib/auth/guardian";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { listOwnInvoices } from "@/services/fees";

export const metadata: Metadata = { title: "Fees" };

const statusStyle: Record<string, string> = {
  unpaid: "text-red-700",
  partial: "text-amber-700",
  paid: "text-green-700",
  waived: "text-muted",
};

export default async function ParentFeesPage() {
  const guardian = await requireGuardian();
  const invoices = await listOwnInvoices();
  const text = guardian.preferredLanguage === "hi" ? "nameHi" : "name";

  if (invoices.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Fees</h1>
        <p className="mt-4 rounded-xl border border-border bg-surface p-5 text-muted">No invoices yet.</p>
      </div>
    );
  }

  const byChild = new Map<string, { studentName: string; invoices: typeof invoices }>();
  for (const invoice of invoices) {
    const entry = byChild.get(invoice.studentId) ?? { studentName: invoice.studentName, invoices: [] };
    entry.invoices.push(invoice);
    byChild.set(invoice.studentId, entry);
  }

  const overdueInvoices = invoices.filter((i) => i.overdue);

  return (
    <div>
      <h1 className="text-2xl font-bold">Fees</h1>

      {overdueInvoices.length > 0 ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-red-900" role="alert">
          <p className="font-semibold">
            {overdueInvoices.length === 1
              ? "1 invoice is overdue."
              : `${overdueInvoices.length} invoices are overdue.`}
          </p>
          <p className="mt-1 text-sm">Please pay the outstanding balance as soon as possible.</p>
        </div>
      ) : null}

      <div className="mt-6 space-y-8">
        {Array.from(byChild.entries()).map(([studentId, { studentName, invoices: childInvoices }]) => (
          <section key={studentId} aria-labelledby={`child-${studentId}`}>
            <h2 id={`child-${studentId}`} className="text-xl font-bold text-brand">
              {studentName}
            </h2>
            <ul className="mt-3 space-y-4">
              {childInvoices.map((invoice) => (
                <li key={invoice.id} className="rounded-xl border border-border bg-surface p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-semibold">{invoice.label}</p>
                    <div className="flex items-center gap-2">
                      {invoice.overdue ? (
                        <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-sm font-semibold text-red-800">
                          Overdue
                        </span>
                      ) : null}
                      <p className={`text-sm font-semibold uppercase ${statusStyle[invoice.status]}`}>{invoice.status}</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted">
                    Issued {formatDate(invoice.createdAt)}
                    {invoice.dueDate ? ` · Due ${formatDate(invoice.dueDate)}` : ""}
                  </p>

                  <dl className="mt-3 divide-y divide-border rounded-lg border border-border">
                    {invoice.items.map((item) => (
                      <div key={item.feeHeadId} className="flex justify-between px-3 py-2 text-sm">
                        <dt>{item[text] ?? item.name}</dt>
                        <dd>{formatMoney(item.amount)}</dd>
                      </div>
                    ))}
                    <div className="flex justify-between px-3 py-2 text-sm font-semibold">
                      <dt>Total</dt>
                      <dd>{formatMoney(invoice.totalAmount)}</dd>
                    </div>
                    <div className="flex justify-between px-3 py-2 text-sm font-semibold">
                      <dt>Balance due</dt>
                      <dd>{formatMoney(invoice.balance)}</dd>
                    </div>
                  </dl>

                  {invoice.payments.length > 0 ? (
                    <div className="mt-3">
                      <h3 className="text-sm font-semibold">Payment history</h3>
                      <ul className="mt-1 space-y-1 text-sm">
                        {invoice.payments.map((payment) => (
                          <li key={payment.id} className="flex justify-between">
                            <span className={payment.amount < 0 ? "text-red-700" : ""}>
                              {formatMoney(payment.amount)} · {payment.method}
                              {payment.status === "reversed" ? " · reversal" : ""}
                            </span>
                            <span className="text-muted">{formatDate(payment.createdAt)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
