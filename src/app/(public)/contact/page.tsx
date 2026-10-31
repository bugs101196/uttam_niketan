import { contentPageMetadata } from "@/components/layout/content-page";
import { PlaceholderBanner } from "@/components/layout/placeholder-banner";
import { getI18n } from "@/i18n/server";
import { schoolPhones } from "@/lib/school";

export const generateMetadata = () => contentPageMetadata("contact");

export default async function ContactPage() {
  const { t } = await getI18n();
  const { title, intro } = t.pages.contact;
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold text-brand sm:text-4xl">{title}</h1>
      <p className="mt-3 text-lg text-muted">{intro}</p>

      <address className="mt-8 grid gap-4 not-italic sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-5">
          <h2 className="font-semibold text-brand">{t.contact.addressLabel}</h2>
          <p className="mt-2 text-lg">{t.meta.siteName}</p>
          <p className="text-lg">{t.footer.address}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5">
          <h2 className="font-semibold text-brand">{t.contact.phoneLabel}</h2>
          <ul className="mt-2">
            {schoolPhones.map((phone) => (
              <li key={phone.tel}>
                <a
                  href={`tel:${phone.tel}`}
                  className="flex min-h-11 items-center text-lg font-semibold text-brand underline-offset-2 hover:underline"
                >
                  {phone.display}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </address>

      <div className="mt-8">
        <PlaceholderBanner>{t.comingSoon}</PlaceholderBanner>
      </div>
    </div>
  );
}
