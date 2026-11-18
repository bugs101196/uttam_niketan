import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/form";
import { requireStaff } from "@/lib/auth/staff";
import { formatDate } from "@/lib/dates";
import { listSectionOptions } from "@/services/students";
import { listHomework } from "@/services/homework";
import { createHomeworkAction, deleteHomeworkAction } from "./actions";
import { HomeworkForm } from "./forms";

export const metadata: Metadata = { title: "Homework" };

export default async function HomeworkPage() {
  const staff = await requireStaff();
  const [items, sections] = await Promise.all([listHomework(), listSectionOptions(staff)]);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold">Homework</h1>
        <p className="text-muted">
          {staff.role === "teacher"
            ? "Post homework for the sections you teach."
            : "Homework posted by teachers across the school."}
        </p>
      </div>

      {staff.role !== "office" ? (
        <section aria-labelledby="post-homework" className="rounded-xl border border-border bg-surface p-5">
          <h2 id="post-homework" className="mb-4 text-lg font-bold">
            Post homework
          </h2>
          <HomeworkForm
            action={createHomeworkAction}
            sections={sections}
            submitLabel="Post homework"
            pendingLabel="Posting…"
          />
        </section>
      ) : null}

      <section aria-labelledby="homework-list">
        <h2 id="homework-list" className="mb-3 text-lg font-bold">
          All homework ({items.length})
        </h2>
        {items.length === 0 ? (
          <p className="text-muted">No homework posted yet.</p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => {
              const canEdit = staff.role === "admin" || item.createdBy === staff.id;
              return (
                <li key={item.id} className="rounded-xl border border-border bg-surface p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">
                        {item.subject} · {item.sectionLabel}
                      </p>
                      <p className="text-sm text-muted">Due {formatDate(item.dueDate)}</p>
                    </div>
                    {canEdit ? (
                      <div className="flex gap-2">
                        <Link href={`/homework/${item.id}/edit`} className="text-sm font-semibold text-brand hover:underline">
                          Edit
                        </Link>
                        {staff.role === "admin" ? (
                          <form action={deleteHomeworkAction.bind(null, item.id)}>
                            <Button type="submit" variant="danger">
                              Delete
                            </Button>
                          </form>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <p className="mt-2">{item.descriptionEn}</p>
                  <p lang="hi" className="mt-1 text-muted">
                    {item.descriptionHi}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
