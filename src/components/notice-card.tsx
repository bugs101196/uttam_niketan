import type { Notice } from "@/content/notices";
import { formatNoticeDate } from "@/content/notices";
import type { Locale } from "@/i18n/config";

// One notice in the visitor's language first, then the other language, so
// every family can read it whichever language is selected.
export function NoticeCard({
  notice,
  locale,
  headingLevel = 2,
  framed = true,
}: {
  notice: Notice;
  locale: Locale;
  headingLevel?: 2 | 3;
  framed?: boolean; // false when the parent already draws the frame
}) {
  const other: Locale = locale === "hi" ? "en" : "hi";
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <article className={framed ? "rounded-xl border border-border bg-surface p-5" : "p-5"}>
      <p className="text-sm font-semibold text-muted">
        <time dateTime={notice.date}>{formatNoticeDate(notice.date, locale)}</time>
      </p>
      <Heading className="mt-1 text-xl font-bold text-brand">{notice.title[locale]}</Heading>
      <p className="mt-2 text-lg">{notice.body[locale]}</p>
      <div lang={other} className="mt-4 border-t border-border pt-4">
        <p className="font-semibold text-brand">{notice.title[other]}</p>
        <p className="mt-1">{notice.body[other]}</p>
      </div>
    </article>
  );
}
