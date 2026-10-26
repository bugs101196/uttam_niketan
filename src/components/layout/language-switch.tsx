import { setLocale } from "@/app/actions/locale";
import { locales, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

export function LanguageSwitch({ locale, t }: { locale: Locale; t: Dictionary }) {
  return (
    <form action={setLocale} className="flex items-center gap-1" aria-label={t.language.label}>
      {locales.map((option) => {
        const active = option === locale;
        return (
          <button
            key={option}
            type="submit"
            name="locale"
            value={option}
            lang={option}
            aria-pressed={active}
            className={`min-h-11 rounded-full px-3 text-sm font-semibold transition-colors ${
              active ? "bg-brand text-brand-contrast" : "text-brand hover:bg-accent-soft"
            }`}
          >
            {t.language[option]}
          </button>
        );
      })}
    </form>
  );
}
