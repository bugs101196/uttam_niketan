import type { Metadata } from "next";
import { NoticeCard } from "@/components/notice-card";
import { notices } from "@/content/notices";
import { requireGuardian } from "@/lib/auth/guardian";

export const metadata: Metadata = { title: "Notices" };

export default async function ParentNoticesPage() {
  const guardian = await requireGuardian();
  const locale = guardian.preferredLanguage;

  return (
    <div>
      <h1 className="text-2xl font-bold">Notices</h1>
      {notices.length === 0 ? (
        <p className="mt-4 text-muted">No notices right now.</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {notices.map((notice) => (
            <li key={notice.id}>
              <NoticeCard notice={notice} locale={locale} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
