import { contentPageMetadata } from "@/components/layout/content-page";
import { NoticeCard } from "@/components/notice-card";
import { notices } from "@/content/notices";
import { getI18n } from "@/i18n/server";

export const generateMetadata = () => contentPageMetadata("notices");

export default async function NoticesPage() {
  const { locale, t } = await getI18n();
  const { title, intro } = t.pages.notices;
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold text-brand sm:text-4xl">{title}</h1>
      <p className="mt-3 text-lg text-muted">{intro}</p>
      {notices.length === 0 ? (
        <p className="mt-8 text-muted">{t.home.noticesEmpty}</p>
      ) : (
        <ul className="mt-8 space-y-4">
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
