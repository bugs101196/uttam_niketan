import type { Metadata } from "next";
import { Button } from "@/components/ui/form";
import { requireAdmin } from "@/lib/auth/staff";
import { listGuardians } from "@/services/guardians";
import { setGuardianActive, unlinkStudent } from "./actions";
import { AddGuardianForm, LinkStudentForm } from "./forms";

export const metadata: Metadata = { title: "Parents and guardians" };

export default async function ParentsPage() {
  const admin = await requireAdmin();
  const guardians = await listGuardians(admin);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold">Parents and guardians</h1>
        <p className="text-muted">
          Create a parent&apos;s sign-in account and link it to their child. Parents cannot register themselves —
          every account and every child link is created here.
        </p>
      </div>

      <section aria-labelledby="add-guardian" className="rounded-xl border border-border bg-surface p-5">
        <h2 id="add-guardian" className="mb-4 text-lg font-bold">
          Add a parent/guardian
        </h2>
        <AddGuardianForm />
      </section>

      <section aria-labelledby="link" className="rounded-xl border border-border bg-surface p-5">
        <h2 id="link" className="text-lg font-bold">
          Link a child
        </h2>
        <p className="mb-4 text-muted">Find the student by their admission number, same as on the Students page.</p>
        <LinkStudentForm guardians={guardians.map((g) => ({ id: g.id, name: `${g.fullName} (${g.phone})` }))} />
      </section>

      <section aria-labelledby="guardian-list">
        <h2 id="guardian-list" className="mb-3 text-lg font-bold">
          All parents/guardians ({guardians.length})
        </h2>
        <ul className="space-y-3">
          {guardians.map((g) => (
            <li key={g.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{g.fullName}</p>
                  <p className="text-sm text-muted">
                    {g.phone} · {g.preferredLanguage === "hi" ? "Hindi" : "English"}
                  </p>
                </div>
                <div className="flex gap-2 text-sm">
                  <span
                    className={`rounded-full border px-2.5 py-0.5 ${
                      g.isActive
                        ? "border-green-200 bg-green-50 text-green-800"
                        : "border-gray-200 bg-gray-100 text-gray-700"
                    }`}
                  >
                    {g.isActive ? "Active" : "Disabled"}
                  </span>
                </div>
              </div>

              <div className="mt-3">
                <p className="text-sm text-muted">Children</p>
                {g.children.length === 0 ? (
                  <p className="text-sm">None linked yet</p>
                ) : (
                  <ul className="mt-1 flex flex-wrap gap-2">
                    {g.children.map((c) => (
                      <li
                        key={c.studentId}
                        className="flex items-center gap-1 rounded-full bg-accent-soft py-0.5 pr-1 pl-3 text-sm"
                      >
                        {c.studentName}
                        {c.relationship ? ` · ${c.relationship}` : ""}
                        <form action={unlinkStudent.bind(null, g.id, c.studentId)}>
                          <button
                            type="submit"
                            aria-label={`Unlink ${g.fullName} from ${c.studentName}`}
                            className="flex size-8 items-center justify-center rounded-full hover:bg-white"
                          >
                            ✕
                          </button>
                        </form>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-4">
                <form action={setGuardianActive.bind(null, g.id, !g.isActive)}>
                  <Button type="submit" variant={g.isActive ? "danger" : "secondary"}>
                    {g.isActive ? "Disable account" : "Re-enable account"}
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
