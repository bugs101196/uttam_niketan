import Link from "next/link";
import { PlaceholderBanner } from "@/components/layout/placeholder-banner";
import { getI18n } from "@/i18n/server";

export default async function HomePage() {
  const { t } = await getI18n();
  const home = t.home;

  return (
    <>
      <section className="bg-brand text-brand-contrast">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
          <p className="text-sm font-semibold tracking-wide text-accent uppercase">{home.eyebrow}</p>
          <h1 className="mt-3 text-4xl font-bold sm:text-5xl">{home.title}</h1>
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
      </section>

      <div className="mx-auto max-w-6xl px-4 pt-6">
        <PlaceholderBanner>{t.placeholderNotice}</PlaceholderBanner>
      </div>

      <section className="mx-auto max-w-6xl px-4 py-12" aria-labelledby="highlights">
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

      <section className="mx-auto grid max-w-6xl gap-4 px-4 sm:grid-cols-2">
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
          <p className="mt-2 text-muted">{home.noticesEmpty}</p>
        </div>
      </section>
    </>
  );
}
