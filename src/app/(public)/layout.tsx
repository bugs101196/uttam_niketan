import { AnnouncementBar } from "@/components/layout/announcement-bar";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { SkipLink } from "@/components/layout/skip-link";
import { highlightedNotices } from "@/content/notices";
import { getI18n } from "@/i18n/server";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const { locale, t } = await getI18n();
  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink label={t.skipToContent} />
      <SiteHeader locale={locale} t={t} />
      <AnnouncementBar
        label={t.announcements.label}
        pauseLabel={t.announcements.pause}
        playLabel={t.announcements.play}
        items={[
          { text: t.announcements.admissionsSoon, href: "/admissions" },
          ...highlightedNotices().map((n) => ({ text: n.title[locale], href: "/notices" })),
        ]}
      />
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>
      <SiteFooter t={t} />
    </div>
  );
}
