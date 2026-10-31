import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, THEME_KEYS, THEMES, isThemeKey, themeStyle } from "@/lib/themes";

// Fixed tokens from globals.css that every theme is drawn against.
const WHITE = "#ffffff";
const BACKGROUND = "#fbf8f3";
const FOREGROUND = "#1f1a17";

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("website colour themes", () => {
  it.each(THEME_KEYS)("%s keeps every text/background pair readable (WCAG AA 4.5:1)", (key) => {
    const c = THEMES[key].colors;
    const pairs: [string, string, string][] = [
      ["white text on brand", WHITE, c.brand],
      ["white text on brand-strong", WHITE, c.brandStrong],
      ["brand text on white", c.brand, WHITE],
      ["brand text on page background", c.brand, BACKGROUND],
      ["brand text on accent-soft", c.brand, c.accentSoft],
      ["dark text on accent", FOREGROUND, c.accent],
      ["dark text on accent-soft", FOREGROUND, c.accentSoft],
    ];
    for (const [what, fg, bg] of pairs) {
      expect(contrast(fg, bg), `${key}: ${what}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("matches the database's allowed values and default", () => {
    expect([...THEME_KEYS]).toEqual(["maroon", "navy", "green", "blue", "plum"]);
    expect(DEFAULT_THEME).toBe("maroon");
  });

  it("keeps the default theme identical to the globals.css defaults", () => {
    expect(themeStyle(DEFAULT_THEME)).toEqual({
      "--brand": "#7a1f2b",
      "--brand-strong": "#5e1621",
      "--accent": "#e0a526",
      "--accent-soft": "#fbf0d5",
    });
  });

  it("rejects unknown theme names", () => {
    expect(isThemeKey("navy")).toBe(true);
    expect(isThemeKey("red")).toBe(false);
    expect(isThemeKey(undefined)).toBe(false);
  });
});
