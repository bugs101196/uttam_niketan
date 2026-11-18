import type { Metadata } from "next";
import { formatDate } from "@/lib/dates";
import { requireGuardian } from "@/lib/auth/guardian";
import { listHomework } from "@/services/homework";

export const metadata: Metadata = { title: "Homework" };

export default async function ParentHomeworkPage() {
  const guardian = await requireGuardian();
  const items = await listHomework();
  const text = guardian.preferredLanguage === "hi" ? "descriptionHi" : "descriptionEn";

  return (
    <div>
      <h1 className="text-2xl font-bold">Homework</h1>
      {items.length === 0 ? (
        <p className="mt-4 text-muted">No homework posted yet.</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {items.map((item) => (
            <li key={item.id} className="rounded-xl border border-border bg-surface p-5">
              <p className="font-semibold">
                {item.subject} · {item.sectionLabel}
              </p>
              <p className="text-sm text-muted">Due {formatDate(item.dueDate)}</p>
              <p className="mt-2">{item[text]}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
