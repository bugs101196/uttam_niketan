import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/staff";
import { formatMoney } from "@/lib/money";
import { getYearStructure, listYears } from "@/services/classes";
import { listFeeHeads, listFeeStructures } from "@/services/fees";
import { createFeeHead, deleteFeeHead, deleteFeeStructureEntry, renameFeeHead, setFeeAmount } from "./actions";
import { FeeAmountForm } from "./fee-amount-form";
import { InlineForm } from "./inline-form";

export const metadata: Metadata = { title: "Fee structure" };

export default async function FeesSettingsPage() {
  await requireAdmin();
  const years = await listYears();
  const active = years.find((y) => y.isActive);

  const [feeHeads, classes, structures] = await Promise.all([
    listFeeHeads(),
    active ? getYearStructure(active.id) : Promise.resolve([]),
    active ? listFeeStructures(active.id) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/settings" className="inline-flex min-h-11 items-center font-semibold text-brand">
          ← Settings
        </Link>
        <h1 className="text-2xl font-bold">Fee structure</h1>
        <p className="text-muted">
          Set the fee catalog and how much each class owes, per fee head, for the active academic year. Creating an
          invoice for a student copies these amounts at that moment -- a later change here never rewrites an
          already-issued invoice.
        </p>
      </div>

      <section aria-labelledby="fee-heads" className="rounded-xl border border-border bg-surface p-5">
        <h2 id="fee-heads" className="text-lg font-bold">
          Fee heads
        </h2>
        <p className="mt-1 text-muted">The catalog of fee categories (Tuition, Admission, Exam Fee, …).</p>

        {feeHeads.length === 0 ? (
          <p className="mt-3 text-muted">No fee heads yet. Add one below.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {feeHeads.map((h) => (
              <li key={h.id} className="py-3">
                <p className="font-semibold">
                  {h.name}
                  {h.nameHi ? <span className="ml-2 text-muted">· {h.nameHi}</span> : null}
                </p>
                <details className="mt-1">
                  <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold text-brand">
                    Rename or delete
                  </summary>
                  <div className="mt-2 space-y-3">
                    <InlineForm
                      action={renameFeeHead.bind(null, h.id)}
                      submitLabel="Save"
                      fields={[
                        { name: "name", label: "Name", defaultValue: h.name },
                        { name: "name_hi", label: "Hindi name (optional)", defaultValue: h.nameHi ?? "" },
                      ]}
                    />
                    <InlineForm
                      action={deleteFeeHead.bind(null, h.id)}
                      submitLabel="Delete fee head"
                      pendingLabel="Deleting…"
                      variant="danger"
                      confirmText={`Delete ${h.name}? This only works if no fee structure uses it.`}
                    />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 rounded-lg border border-border p-3">
          <h3 className="mb-2 font-semibold">Add a fee head</h3>
          <InlineForm
            action={createFeeHead}
            submitLabel="Add"
            fields={[
              { name: "name", label: "Name", placeholder: "Tuition" },
              { name: "name_hi", label: "Hindi name (optional)", placeholder: "ट्यूशन" },
            ]}
          />
        </div>
      </section>

      {!active ? (
        <p className="rounded-xl border border-dashed border-border bg-surface p-6 text-center text-muted">
          No active academic year. Set one under{" "}
          <Link href="/settings/classes" className="font-semibold text-brand">
            Classes &amp; academic year
          </Link>{" "}
          before pricing fees.
        </p>
      ) : (
        <section aria-labelledby="fee-structure" className="space-y-4">
          <h2 id="fee-structure" className="text-lg font-bold">
            Amounts for {active.name}
          </h2>
          {classes.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border bg-surface p-6 text-center text-muted">
              No classes in this year yet.
            </p>
          ) : feeHeads.length === 0 ? (
            <p className="text-muted">Add a fee head above before pricing a class.</p>
          ) : (
            <ul className="space-y-3">
              {classes.map((c) => {
                const entries = structures.filter((s) => s.classId === c.id);
                return (
                  <li key={c.id} className="rounded-xl border border-border bg-surface p-4">
                    <h3 className="text-lg font-semibold">{c.name}</h3>
                    {entries.length === 0 ? (
                      <p className="mt-1 text-sm text-muted">No fee amounts set yet.</p>
                    ) : (
                      <ul className="mt-2 divide-y divide-border">
                        {entries.map((e) => (
                          <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                            <span>
                              {e.feeHeadName} · {formatMoney(e.amount)}
                            </span>
                            <InlineForm
                              action={deleteFeeStructureEntry.bind(null, e.id)}
                              submitLabel="Remove"
                              pendingLabel="Removing…"
                              variant="danger"
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-3">
                      <FeeAmountForm action={setFeeAmount.bind(null, c.id, active.id)} feeHeads={feeHeads} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
