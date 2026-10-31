import Link from "next/link";
import type { Dictionary } from "@/i18n/dictionaries";
import { schoolPhones } from "@/lib/school";
import { navLinks } from "./nav-links";
import { SchoolLogo } from "./school-logo";

export function SiteFooter({ t }: { t: Dictionary }) {
  return (
    <footer className="mt-16 bg-brand-strong text-brand-contrast">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2">
        <div className="flex gap-4">
          <div className="self-start rounded-full bg-white p-1">
            <SchoolLogo size={64} />
          </div>
          <div>
            <p className="text-lg font-bold">{t.meta.siteName}</p>
            <p className="mt-1 text-sm opacity-80">{t.home.eyebrow}</p>
            <address className="mt-2 text-sm not-italic opacity-90">
              <p>{t.footer.address}</p>
              <p className="mt-1">
                {t.contact.phoneLabel}:{" "}
                {schoolPhones.map((phone, i) => (
                  <span key={phone.tel}>
                    {i > 0 ? ", " : null}
                    <a href={`tel:${phone.tel}`} className="inline-block py-2 underline-offset-2 hover:underline">
                      {phone.display}
                    </a>
                  </span>
                ))}
              </p>
            </address>
          </div>
        </div>
        <nav aria-label={t.nav.menu}>
          <ul className="grid grid-cols-2 gap-x-4">
            {navLinks.map((link) => (
              <li key={link.key}>
                <Link href={link.href} className="flex min-h-11 items-center text-sm hover:underline">
                  {t.nav[link.key]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="border-t border-white/15">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-sm opacity-80">
          <p>
            © {new Date().getFullYear()} {t.meta.siteName}. {t.footer.rights}
          </p>
          <Link href="/login" className="flex min-h-11 items-center hover:underline">
            {t.nav.staffLogin}
          </Link>
        </div>
      </div>
    </footer>
  );
}
