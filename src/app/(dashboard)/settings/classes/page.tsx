import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/staff";
import { formatDate } from "@/lib/dates";
import { getYearStructure, listYears } from "@/services/classes";
import {
  activateAcademicYear,
  createAcademicYear,
  createClass,
  createSection,
  deleteClass,
  deleteSection,
  renameSection,
  updateClass,
} from "./actions";
import { InlineForm } from "./inline-form";

export const metadata: Metadata = { title: "Classes & academic year" };

export default async function ClassesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const { year: yearParam } = await searchParams;
  const years = await listYears();
  const active = years.find((y) => y.isActive);
  const selected = years.find((y) => y.id === yearParam) ?? active ?? years[0];
  const classes = selected ? await getYearStructure(selected.id) : [];
  const nextOrder = classes.length ? Math.max(...classes.map((c) => c.sortOrder)) + 1 : 0;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/settings" className="inline-flex min-h-11 items-center font-semibold text-brand">
          ← Settings
        </Link>
        <h1 className="text-2xl font-bold">Classes &amp; academic year</h1>
        <p className="text-muted">
          Teachers, students and attendance use the classes and sections of the <strong>active</strong> year.
        </p>
      </div>

      <section aria-labelledby="years" className="rounded-xl border border-border bg-surface p-5">
        <h2 id="years" className="text-lg font-bold">
          Academic years
        </h2>
        {years.length === 0 ? (
          <p className="mt-2 text-muted">No academic year yet. Add one below.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {years.map((y) => (
              <li key={y.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-semibold">
                    {y.name}{" "}
                    {y.isActive ? (
                      <span className="ml-1 rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-sm font-medium text-green-800">
                        Active
                      </span>
                    ) : null}
                  </p>
                  <p className="text-sm text-muted">
                    {formatDate(y.startDate)} – {formatDate(y.endDate)}
                  </p>
                </div>
                <div className="flex flex-wrap items-start gap-2">
                  <Link
                    href={`/settings/classes?year=${y.id}`}
                    aria-current={selected?.id === y.id ? "page" : undefined}
                    className={`inline-flex min-h-12 items-center rounded-lg border px-4 font-semibold ${
                      selected?.id === y.id ? "border-brand text-brand" : "border-border hover:bg-accent-soft"
                    }`}
                  >
                    {selected?.id === y.id ? "Showing classes" : "Show classes"}
                  </Link>
                  {!y.isActive ? (
                    <InlineForm
                      action={activateAcademicYear.bind(null, y.id)}
                      submitLabel="Make active"
                      pendingLabel="Switching…"
                      confirmText={`Make ${y.name} the active year?\n\nTeachers will only see the classes of ${y.name}. Students stay in their current sections until they are moved to this year's classes.`}
                    />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}

        <details className="mt-4 rounded-lg border border-border p-3">
          <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-brand">
            Add an academic year
          </summary>
          <div className="mt-3">
            <InlineForm
              action={createAcademicYear}
              submitLabel="Add year"
              fields={[
                { name: "name", label: "Name", placeholder: "2027-28", width: "w-36" },
                { name: "start_date", label: "Starts", type: "date", width: "w-44" },
                { name: "end_date", label: "Ends", type: "date", width: "w-44" },
              ]}
              checkbox={
                active
                  ? {
                      name: "copy_structure",
                      label: `Copy the classes and sections of ${active.name}`,
                      defaultChecked: true,
                    }
                  : undefined
              }
            />
            <p className="mt-2 text-sm text-muted">
              A new year is not active until you choose “Make active”. Moving students into the new year’s classes is a
              separate step.
            </p>
          </div>
        </details>
      </section>

      {selected ? (
        <section aria-labelledby="classes" className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="classes" className="text-lg font-bold">
              Classes in {selected.name}
              {selected.isActive ? "" : " (not active)"}
            </h2>
            <p className="text-sm text-muted">
              {classes.length} classes · {classes.reduce((n, c) => n + c.sections.length, 0)} sections
            </p>
          </div>

          {classes.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border bg-surface p-6 text-center text-muted">
              No classes in this year yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {classes.map((c) => (
                <li key={c.id} className="rounded-xl border border-border bg-surface p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-lg font-semibold">{c.name}</h3>
                    <span className="text-sm text-muted">Order {c.sortOrder}</span>
                  </div>

                  <ul className="mt-2 flex flex-wrap gap-2">
                    {c.sections.map((s) => {
                      const inUse = s.students > 0 || s.teachers > 0;
                      return (
                        <li key={s.id} className="rounded-lg border border-border bg-background p-3">
                          <p className="font-medium">
                            Section {s.name}
                            <span className="ml-2 text-sm font-normal text-muted">
                              {s.students} {s.students === 1 ? "student" : "students"} · {s.teachers}{" "}
                              {s.teachers === 1 ? "teacher" : "teachers"}
                            </span>
                          </p>
                          <details className="mt-1">
                            <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold text-brand">
                              Edit
                            </summary>
                            <div className="mt-2 space-y-3">
                              <InlineForm
                                action={renameSection.bind(null, s.id)}
                                submitLabel="Rename"
                                fields={[{ name: "name", label: "Section name", defaultValue: s.name, width: "w-32" }]}
                              />
                              {inUse ? (
                                <p className="text-sm text-muted">
                                  Can’t be deleted while it has students or teachers.
                                </p>
                              ) : (
                                <InlineForm
                                  action={deleteSection.bind(null, s.id)}
                                  submitLabel="Delete section"
                                  pendingLabel="Deleting…"
                                  variant="danger"
                                  confirmText={`Delete ${c.name} – ${s.name}?`}
                                />
                              )}
                            </div>
                          </details>
                        </li>
                      );
                    })}
                  </ul>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <InlineForm
                      action={createSection.bind(null, c.id)}
                      submitLabel="Add section"
                      fields={[{ name: "name", label: "New section", placeholder: "B", width: "w-32" }]}
                    />
                    <details>
                      <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold text-brand">
                        Rename or delete {c.name}
                      </summary>
                      <div className="mt-2 space-y-3">
                        <InlineForm
                          action={updateClass.bind(null, c.id)}
                          submitLabel="Save"
                          fields={[
                            { name: "name", label: "Class name", defaultValue: c.name },
                            {
                              name: "sort_order",
                              label: "Order",
                              type: "number",
                              defaultValue: c.sortOrder,
                              width: "w-24",
                            },
                          ]}
                        />
                        {c.sections.length === 0 ? (
                          <InlineForm
                            action={deleteClass.bind(null, c.id)}
                            submitLabel="Delete class"
                            pendingLabel="Deleting…"
                            variant="danger"
                            confirmText={`Delete ${c.name}?`}
                          />
                        ) : (
                          <p className="text-sm text-muted">Delete its sections first to delete this class.</p>
                        )}
                      </div>
                    </details>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="rounded-xl border border-border bg-surface p-4">
            <h3 className="mb-2 font-semibold">Add a class to {selected.name}</h3>
            <InlineForm
              action={createClass.bind(null, selected.id)}
              submitLabel="Add class"
              fields={[
                { name: "name", label: "Class name", placeholder: "Class 9" },
                { name: "sort_order", label: "Order", type: "number", defaultValue: nextOrder, width: "w-24" },
              ]}
            />
            <p className="mt-2 text-sm text-muted">Order decides where the class appears in lists (0 = first).</p>
          </div>
        </section>
      ) : null}
    </div>
  );
}
