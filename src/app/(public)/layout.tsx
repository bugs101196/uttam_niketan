import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { getI18n } from "@/i18n/server";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const { locale, t } = await getI18n();
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader locale={locale} t={t} />
      <main className="flex-1">{children}</main>
      <SiteFooter t={t} />
    </div>
  );
}
