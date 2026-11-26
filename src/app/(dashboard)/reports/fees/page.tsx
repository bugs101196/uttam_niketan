import type { Metadata } from "next";
import Link from "next/link";
import { Button, Input, Select } from "@/components/ui/form";
import { requireAdmin } from "@/lib/auth/staff";
import { formatDate, formatDateTime, formatMonth, isIsoMonth, monthRange, todayIn } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { getSchoolTimezone } from "@/services/attendance";
import { listYears } from "@/services/classes";
import { getCollectionReport, getOutstandingReport } from "@/services/fees";

export const metadata: Metadata = { title: "Fee reports" };

export default async function FeeReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const today = todayIn(await getSchoolTimezone(admin));
  const view = params.view === "dues" ? "dues" : "collections";

  return (
    <div>
      <h1 className="text-2xl font-bold">Fee reports</h1>
      <p className="text-muted">Collections are what was actually paid or reversed. Dues are what is still owed.</p>

      <nav aria-label="Report type" className="mt-4 flex gap-2">
        {(["collections", "dues"] as const).map((v) => (
          <Link
            key={v}
            href={`/reports/fees?view=${v}`}
            aria-current={view === v ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-lg border px-4 font-semibold ${
              view === v ? "border-brand bg-brand text-brand-contrast" : "border-border bg-surface hover:bg-accent-soft"
            }`}
          >
            {v === "collections" ? "Collections" : "Outstanding dues"}
          </Link>
        ))}
      </nav>

      {view === "collections" ? (
        <CollectionsReport
          month={isIsoMonth(params.month) && params.month <= today.slice(0, 7) ? params.month : today.slice(0, 7)}
          today={today}
        />
      ) : (
        <DuesReport yearParam={params.year} />
      )}
    </div>
  );
}

async function CollectionsReport({ month, today }: { month: string; today: string }) {
  const { from, to } = monthRange(month);
  const report = await getCollectionReport(from, to > today ? today : to);

  return (
    <section className="mt-6" aria-labelledby="collections-title">
      <form className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="view" value="collections" />
        <div>
          <label htmlFor="month" className="mb-1 block font-medium">
            Month
          </label>
          <Input id="month" name="month" type="month" defaultValue={month} max={today.slice(0, 7)} />
        </div>
        <Button type="submit" variant="secondary">
          Show
        </Button>
      </form>

      <h2 id="collections-title" className="mt-6 text-lg font-bold">
        {formatMonth(month)}
      </h2>
      <p className="text-sm text-muted">
        {report.entries.length} {report.entries.length === 1 ? "entry" : "entries"}
      </p>

      {report.entries.length === 0 ? (
        <p className="mt-3 text-muted">No payments or reversals recorded this month.</p>
      ) : (
        <>
          <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full min-w-[42rem] text-left text-sm">
              <thead className="border-b border-border bg-background">
                <tr>
                  <th className="px-4 py-3 font-semibold">When</th>
                  <th className="px-3 py-3 font-semibold">Student</th>
                  <th className="px-3 py-3 font-semibold">Method</th>
                  <th className="px-3 py-3 font-semibold">Received by</th>
                  <th className="px-3 py-3 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {report.entries.map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(e.createdAt)}</td>
                    <td className="px-3 py-3">
                      <Link href={`/fees/${e.studentId}`} className="text-brand hover:underline">
                        {e.studentName}
                      </Link>
                      <p className="text-xs text-muted">{e.sectionLabel}</p>
                    </td>
                    <td className="px-3 py-3 capitalize">{e.method}</td>
                    <td className="px-3 py-3">{e.receivedByName ?? "—"}</td>
                    <td className={`px-3 py-3 text-right tabular-nums ${e.amount < 0 ? "text-red-700" : ""}`}>
                      {formatMoney(e.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <dl className="mt-4 grid gap-3 sm:grid-cols-4">
            <SummaryStat label="Cash" value={report.totals.cash} />
            <SummaryStat label="Online" value={report.totals.online} />
            <SummaryStat label="Reversed" value={report.totals.reversed} />
            <SummaryStat label="Net collected" value={report.totals.net} emphasize />
          </dl>
        </>
      )}
    </section>
  );
}

function SummaryStat({ label, value, emphasize }: { label: string; value: number; emphasize?: boolean }) {
  return (
    <div className={`rounded-xl border border-border p-4 ${emphasize ? "bg-accent-soft" : "bg-surface"}`}>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className={`mt-1 text-lg font-bold tabular-nums ${value < 0 ? "text-red-700" : ""}`}>{formatMoney(value)}</dd>
    </div>
  );
}

async function DuesReport({ yearParam }: { yearParam: string | undefined }) {
  const years = await listYears();
  const year = years.find((y) => y.id === yearParam) ?? years.find((y) => y.isActive) ?? years[0];

  if (!year) {
    return <p className="mt-6 text-muted">No academic year set up yet.</p>;
  }

  const report = await getOutstandingReport(year.id);

  return (
    <section className="mt-6" aria-labelledby="dues-title">
      <form className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="view" value="dues" />
        <div>
          <label htmlFor="year" className="mb-1 block font-medium">
            Academic year
          </label>
          <Select id="year" name="year" defaultValue={year.id}>
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="secondary">
          Show
        </Button>
      </form>

      <h2 id="dues-title" className="mt-6 text-lg font-bold">
        {year.name}
      </h2>
      <p className="text-sm text-muted">
        {report.rows.length} {report.rows.length === 1 ? "invoice" : "invoices"} with a balance due
      </p>

      {report.rows.length === 0 ? (
        <p className="mt-3 text-muted">Nothing outstanding for this year.</p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="border-b border-border bg-background">
              <tr>
                <th className="px-4 py-3 font-semibold">Student</th>
                <th className="px-3 py-3 font-semibold">Class</th>
                <th className="px-3 py-3 font-semibold">Invoice</th>
                <th className="px-3 py-3 font-semibold">Due date</th>
                <th className="px-3 py-3 text-right font-semibold">Total</th>
                <th className="px-3 py-3 text-right font-semibold">Balance due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {report.rows.map((r) => (
                <tr key={r.invoiceId}>
                  <td className="px-4 py-3 font-medium">
                    {r.rollNo ? <span className="mr-2 text-muted">{r.rollNo}.</span> : null}
                    <Link href={`/fees/${r.studentId}`} className="hover:underline">
                      {r.studentName}
                    </Link>
                  </td>
                  <td className="px-3 py-3">{r.sectionLabel}</td>
                  <td className="px-3 py-3">{r.label}</td>
                  <td className="px-3 py-3">
                    {r.dueDate ? formatDate(r.dueDate) : "—"}
                    {r.overdue ? (
                      <span className="ml-2 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-800">
                        Overdue
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatMoney(r.totalAmount)}</td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums">{formatMoney(r.balance)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-border font-semibold">
              <tr>
                <td className="px-4 py-3" colSpan={5}>
                  Total outstanding
                </td>
                <td className="px-3 py-3 text-right tabular-nums">{formatMoney(report.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
