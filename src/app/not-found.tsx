import Link from "next/link";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { SkipLink } from "@/components/layout/skip-link";
import { getI18n } from "@/i18n/server";

// Shown for any unknown URL (and notFound() calls), with the normal site
// header so visitors can find their way back.
export default async function NotFound() {
  const { locale, t } = await getI18n();
  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink label={t.skipToContent} />
      <SiteHeader locale={locale} t={t} />
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-3xl flex-1 px-4 py-16 focus:outline-none">
        <p className="font-semibold text-muted">404</p>
        <h1 className="mt-1 text-3xl font-bold text-brand sm:text-4xl">{t.notFound.title}</h1>
        <p className="mt-3 text-lg text-muted">{t.notFound.body}</p>
        <Link
          href="/"
          className="mt-8 inline-flex min-h-12 items-center rounded-lg bg-brand px-6 font-semibold text-brand-contrast hover:bg-brand-strong"
        >
          {t.notFound.home}
        </Link>
      </main>
      <SiteFooter t={t} />
    </div>
  );
}
