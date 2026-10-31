import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { LanguageSwitch } from "./language-switch";
import { SchoolLogo } from "./school-logo";
import { navLinks } from "./nav-links";

// Server-rendered header. The mobile menu uses <details> so it works without
// JavaScript on slow connections and low-end phones.
export function SiteHeader({ locale, t }: { locale: Locale; t: Dictionary }) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex min-h-11 items-center gap-3">
          <SchoolLogo size={44} priority />
          <span className="text-lg font-bold text-brand">{t.meta.siteName}</span>
        </Link>

        <nav aria-label={t.nav.menu} className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {navLinks.map((link) => (
              <li key={link.key}>
                <Link
                  href={link.href}
                  className="flex min-h-11 items-center rounded-md px-3 font-medium text-foreground hover:bg-accent-soft"
                >
                  {t.nav[link.key]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden lg:block">
          <LanguageSwitch locale={locale} t={t} />
        </div>

        <details className="group relative lg:hidden">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-md border border-border px-3 font-semibold text-brand">
            <span aria-hidden className="text-xl leading-none group-open:hidden">
              ☰
            </span>
            <span aria-hidden className="hidden text-xl leading-none group-open:inline">
              ✕
            </span>
            {t.nav.menu}
          </summary>
          <div className="absolute right-0 mt-2 w-64 rounded-lg border border-border bg-surface p-2 shadow-lg">
            <nav aria-label={t.nav.menu}>
              <ul>
                {navLinks.map((link) => (
                  <li key={link.key}>
                    <Link
                      href={link.href}
                      className="flex min-h-11 items-center rounded-md px-3 font-medium hover:bg-accent-soft"
                    >
                      {t.nav[link.key]}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="mt-2 border-t border-border pt-2">
              <LanguageSwitch locale={locale} t={t} />
            </div>
          </div>
        </details>
      </div>
    </header>
  );
}
