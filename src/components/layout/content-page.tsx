import type { Metadata } from "next";
import type { Dictionary } from "@/i18n/dictionaries";
import { getI18n } from "@/i18n/server";
import { PlaceholderBanner } from "./placeholder-banner";

export type PageKey = keyof Dictionary["pages"];

export async function contentPageMetadata(key: PageKey): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.pages[key].title, description: t.pages[key].intro };
}

// Shared shell for public pages whose content the school has not supplied yet.
export async function ContentPage({ page }: { page: PageKey }) {
  const { t } = await getI18n();
  const { title, intro } = t.pages[page];
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold text-brand sm:text-4xl">{title}</h1>
      <p className="mt-3 text-lg text-muted">{intro}</p>
      <div className="mt-8">
        <PlaceholderBanner>{t.comingSoon}</PlaceholderBanner>
      </div>
    </div>
  );
}
