import type { Metadata } from "next";
import Link from "next/link";
import { Button, Input, Select } from "@/components/ui/form";
import { requireAdmin } from "@/lib/auth/staff";
import { listSectionOptions, listStudents, PAGE_SIZE } from "@/services/students";

export const metadata: Metadata = { title: "Fees" };

export default async function FeesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const sections = await listSectionOptions(admin);

  const q = params.q ?? "";
  const sectionId = sections.some((s) => s.id === params.section) ? params.section : undefined;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);

  const { students, total } = await listStudents({ q, sectionId, status: "active", page });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (n: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (sectionId) sp.set("section", sectionId);
    if (n > 1) sp.set("page", String(n));
    const s = sp.toString();
    return s ? `/fees?${s}` : "/fees";
  };

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold">Fees</h1>
        <p className="text-muted">Find a student to create an invoice, record a cash payment, or review their ledger.</p>
      </div>

      <form
        className="mt-6 grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-[2fr_1.5fr_auto]"
        role="search"
      >
        <label className="sr-only" htmlFor="q">
          Search by name or admission number
        </label>
        <Input id="q" name="q" type="search" placeholder="Search name or admission no." defaultValue={q} />
        <label className="sr-only" htmlFor="section">
          Class and section
        </label>
        <Select id="section" name="section" defaultValue={sectionId ?? ""}>
          <option value="">All classes</option>
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      <p className="mt-4 text-sm text-muted" aria-live="polite">
        {total === 1 ? "1 student" : `${total} students`}
      </p>

      {students.length === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-border bg-surface p-8 text-center text-muted">
          No active students match these filters.
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {students.map((s) => (
            <li key={s.id}>
              <Link
                href={`/fees/${s.id}`}
                className="flex min-h-16 items-center justify-between gap-3 px-4 py-3 hover:bg-accent-soft"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">{s.full_name}</p>
                  <p className="text-sm text-muted">
                    {s.sections.classes.name} – {s.sections.name}
                    {s.roll_no ? ` · Roll ${s.roll_no}` : ""} · {s.admission_no}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 ? (
        <nav aria-label="Pages" className="mt-4 flex items-center justify-between">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="min-h-11 rounded-lg border border-border px-4 py-2 font-semibold">
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm text-muted">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Link href={pageHref(page + 1)} className="min-h-11 rounded-lg border border-border px-4 py-2 font-semibold">
              Next →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
