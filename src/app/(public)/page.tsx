import Image from "next/image";
import Link from "next/link";
import { PlaceholderBanner } from "@/components/layout/placeholder-banner";
import { SchoolLogo } from "@/components/layout/school-logo";
import { NoticeCard } from "@/components/notice-card";
import { albums } from "@/content/gallery";
import { formatNoticeDate, highlightedNotices, notices } from "@/content/notices";
import { getI18n } from "@/i18n/server";

export default async function HomePage() {
  const { locale, t } = await getI18n();
  const home = t.home;
  const important = highlightedNotices();
  const latest = notices.slice(0, 3);
  const photos = albums
    .flatMap((album) => album.photos.map((photo, i) => ({ photo, href: `/gallery/${album.id}/${i + 1}` })))
    .slice(0, 4);

  return (
    <>
      <section className="bg-brand text-brand-contrast">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-14 sm:py-20 md:flex-row md:items-center md:justify-between">
          <div className="animate-rise">
            <h1 className="text-4xl font-bold sm:text-5xl">{home.title}</h1>
            <p className="mt-2 text-xl font-semibold sm:text-2xl">{t.meta.place}</p>
            <p className="mt-3 inline-block rounded-md bg-accent px-3 py-1 font-bold text-foreground">
              {t.meta.classRange}
            </p>
            <p className="mt-4 max-w-2xl text-lg opacity-90 sm:text-xl">{home.tagline}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/admissions"
                className="flex min-h-12 items-center justify-center rounded-lg bg-accent px-6 font-semibold text-foreground hover:brightness-95"
              >
                {home.ctaAdmissions}
              </Link>
              <Link
                href="/contact"
                className="flex min-h-12 items-center justify-center rounded-lg border border-white/40 px-6 font-semibold hover:bg-white/10"
              >
                {home.ctaContact}
              </Link>
            </div>
          </div>
          <div className="animate-rise-delayed mx-auto shrink-0 drop-shadow-2xl md:mx-0">
            <SchoolLogo size={260} alt={t.logoAlt} priority />
          </div>
        </div>
      </section>

      {important.length > 0 ? (
        <section aria-labelledby="important-notice" className="mx-auto max-w-6xl px-4 pt-8">
          <h2
            id="important-notice"
            className="inline-block rounded-t-lg bg-accent px-4 py-1.5 text-sm font-bold tracking-wide text-foreground uppercase"
          >
            {home.importantNotice}
          </h2>
          <div className="divide-y divide-border rounded-b-xl rounded-tr-xl border-2 border-accent bg-surface">
            {important.map((notice) => (
              <NoticeCard key={notice.id} notice={notice} locale={locale} headingLevel={3} framed={false} />
            ))}
          </div>
        </section>
      ) : null}

      <div className="mx-auto max-w-6xl px-4 pt-6">
        <PlaceholderBanner>{t.placeholderNotice}</PlaceholderBanner>
      </div>

      <section className="reveal mx-auto max-w-6xl px-4 py-12" aria-labelledby="highlights">
        <h2 id="highlights" className="text-2xl font-bold text-brand">
          {home.highlightsTitle}
        </h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-3">
          {home.highlights.map((item) => (
            <li key={item.title} className="rounded-xl border border-border bg-surface p-5">
              <h3 className="text-lg font-semibold">{item.title}</h3>
              <p className="mt-2 text-muted">{item.body}</p>
            </li>
          ))}
        </ul>
      </section>

      {photos.length > 0 ? (
        <section className="reveal mx-auto max-w-6xl px-4 pb-12" aria-labelledby="school-life">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4">
            <h2 id="school-life" className="text-2xl font-bold text-brand">
              {home.galleryTitle}
            </h2>
            <Link href="/gallery" className="flex min-h-11 items-center font-semibold text-brand hover:underline">
              {home.viewGallery} →
            </Link>
          </div>
          <ul className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {photos.map(({ photo, href }) => (
              <li key={href}>
                <Link href={href} className="group block overflow-hidden rounded-xl">
                  <Image
                    src={photo.image}
                    alt={photo.alt[locale]}
                    placeholder="blur"
                    sizes="(min-width: 1024px) 280px, 50vw"
                    className="aspect-[4/3] w-full object-cover transition-transform duration-300 group-hover:scale-105 group-focus-visible:scale-105"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="reveal mx-auto grid max-w-6xl gap-4 px-4 sm:grid-cols-2">
        <div className="rounded-xl bg-accent-soft p-6">
          <h2 className="text-xl font-bold text-brand">{home.classesTitle}</h2>
          <p className="mt-2 text-lg">{home.classes}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-6">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-xl font-bold text-brand">{home.noticesTitle}</h2>
            <Link href="/notices" className="flex min-h-11 items-center font-semibold text-brand hover:underline">
              {home.viewAllNotices} →
            </Link>
          </div>
          {latest.length === 0 ? (
            <p className="mt-2 text-muted">{home.noticesEmpty}</p>
          ) : (
            <ul className="mt-2 divide-y divide-border">
              {latest.map((notice) => (
                <li key={notice.id} className="py-3">
                  <Link href="/notices" className="block hover:underline">
                    <span className="block text-sm text-muted">
                      <time dateTime={notice.date}>{formatNoticeDate(notice.date, locale)}</time>
                    </span>
                    <span className="font-semibold">{notice.title[locale]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
