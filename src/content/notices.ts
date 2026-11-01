import type { Locale } from "@/i18n/config";
import { todayIn } from "@/lib/dates";

// School notices shown on the public website, newest first. Every notice is
// written in both languages. Dates are "YYYY-MM-DD" in the school's timezone.
// `highlightUntil` shows the notice at the top of the home page until that
// day (inclusive).

export interface Notice {
  id: string;
  date: string;
  highlightUntil?: string;
  title: Record<Locale, string>;
  body: Record<Locale, string>;
}

export const notices: Notice[] = [
  {
    id: "2026-chhath-puja-holiday",
    date: "2026-11-01",
    highlightUntil: "2026-11-16",
    title: {
      en: "School closed for Chhath Puja (13–16 November)",
      hi: "छठ पूजा के अवसर पर विद्यालय बंद (13–16 नवंबर)",
    },
    body: {
      en: "The school will remain closed from 13 November to 16 November 2026 on account of Chhath Puja. School will reopen on 17 November 2026 at the usual time.",
      hi: "छठ पूजा के अवसर पर विद्यालय 13 नवंबर से 16 नवंबर 2026 तक बंद रहेगा। विद्यालय 17 नवंबर 2026 को सामान्य समय पर खुलेगा।",
    },
  },
];

/** Notices to feature on the home page today. */
export function highlightedNotices(today: string = todayIn()): Notice[] {
  return notices.filter((n) => n.highlightUntil && n.date <= today && today <= n.highlightUntil);
}

/** "1 November 2026" / "1 नवंबर 2026". */
export function formatNoticeDate(isoDate: string, locale: Locale): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}
