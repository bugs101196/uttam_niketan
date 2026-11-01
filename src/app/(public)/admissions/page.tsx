import { contentPageMetadata } from "@/components/layout/content-page";
import { getI18n } from "@/i18n/server";
import { schoolPhones } from "@/lib/school";

export const generateMetadata = () => contentPageMetadata("admissions");

export default async function AdmissionsPage() {
  const { t } = await getI18n();
  const { title, intro } = t.pages.admissions;
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="animate-rise text-3xl font-bold text-brand sm:text-4xl">{title}</h1>
      <p className="mt-3 text-lg text-muted">{intro}</p>

      <section
        aria-labelledby="admissions-soon"
        className="animate-rise-delayed mt-8 rounded-xl border-2 border-accent bg-accent-soft p-6"
      >
        <h2 id="admissions-soon" className="text-2xl font-bold text-brand">
          {t.admissionsSoon.title}
        </h2>
        <p className="mt-2 text-lg">{t.admissionsSoon.body}</p>
        <ul className="mt-5 flex flex-col gap-3 sm:flex-row">
          {schoolPhones.map((phone) => (
            <li key={phone.tel}>
              <a
                href={`tel:${phone.tel}`}
                className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-brand px-6 font-semibold text-brand-contrast hover:bg-brand-strong"
              >
                {t.admissionsSoon.call} {phone.display}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
