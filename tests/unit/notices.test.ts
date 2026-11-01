import { describe, expect, it } from "vitest";
import { formatNoticeDate, highlightedNotices, notices } from "@/content/notices";
import { isIsoDate } from "@/lib/dates";

describe("public notices", () => {
  it("are complete in both languages, with valid dates, newest first", () => {
    for (const n of notices) {
      expect(isIsoDate(n.date), n.id).toBe(true);
      if (n.highlightUntil) expect(isIsoDate(n.highlightUntil) && n.highlightUntil >= n.date, n.id).toBe(true);
      for (const lang of ["en", "hi"] as const) {
        expect(n.title[lang].trim(), `${n.id} title ${lang}`).not.toBe("");
        expect(n.body[lang].trim(), `${n.id} body ${lang}`).not.toBe("");
      }
    }
    expect(new Set(notices.map((n) => n.id)).size).toBe(notices.length);
    expect([...notices].sort((a, b) => b.date.localeCompare(a.date))).toEqual(notices);
  });

  it("features the Chhath Puja closure on the home page until 16 November only", () => {
    const id = "2026-chhath-puja-holiday";
    expect(highlightedNotices("2026-10-31").map((n) => n.id)).not.toContain(id);
    expect(highlightedNotices("2026-11-01").map((n) => n.id)).toContain(id);
    expect(highlightedNotices("2026-11-16").map((n) => n.id)).toContain(id);
    expect(highlightedNotices("2026-11-17").map((n) => n.id)).not.toContain(id);
  });

  it("formats dates in each language without shifting the day", () => {
    expect(formatNoticeDate("2026-11-01", "en")).toBe("1 November 2026");
    expect(formatNoticeDate("2026-11-01", "hi")).toBe("1 नवंबर 2026");
  });
});
