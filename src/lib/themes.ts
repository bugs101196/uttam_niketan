// Website colour themes the school can choose from (Settings → Website colours).
// Keys must match the check on schools.website_theme. Every theme is tested for
// readable contrast (tests/unit/themes.test.ts), so the school cannot pick an
// unreadable combination.

export const THEME_KEYS = ["maroon", "navy", "green", "blue", "plum"] as const;
export type ThemeKey = (typeof THEME_KEYS)[number];
export const DEFAULT_THEME: ThemeKey = "maroon";

export interface Theme {
  label: string;
  description: string;
  colors: {
    brand: string; // headings, header text, main buttons (white text on it)
    brandStrong: string; // footer, hover (white text on it)
    accent: string; // highlight buttons (dark text on it)
    accentSoft: string; // light panels (dark and brand text on it)
  };
}

export const THEMES: Record<ThemeKey, Theme> = {
  maroon: {
    label: "Maroon & gold",
    description: "Matches the red ring of the school logo.",
    colors: { brand: "#7a1f2b", brandStrong: "#5e1621", accent: "#e0a526", accentSoft: "#fbf0d5" },
  },
  navy: {
    label: "Navy & gold",
    description: "Matches the blue band of the school logo.",
    colors: { brand: "#1b3160", brandStrong: "#11203f", accent: "#e0a526", accentSoft: "#fbf0d5" },
  },
  green: {
    label: "Green & yellow",
    description: "Fresh and natural.",
    colors: { brand: "#1f5f3a", brandStrong: "#154329", accent: "#f0b429", accentSoft: "#edf6e9" },
  },
  blue: {
    label: "Blue & orange",
    description: "Bright and friendly.",
    colors: { brand: "#1d4ed8", brandStrong: "#1e3a8a", accent: "#f59e0b", accentSoft: "#eaf1fd" },
  },
  plum: {
    label: "Purple & gold",
    description: "Calm and distinctive.",
    colors: { brand: "#5b2a86", brandStrong: "#421d63", accent: "#f2b632", accentSoft: "#f3ecfa" },
  },
};

export function isThemeKey(value: unknown): value is ThemeKey {
  return typeof value === "string" && (THEME_KEYS as readonly string[]).includes(value);
}

/** CSS custom properties that override the defaults in globals.css. */
export function themeStyle(key: ThemeKey): Record<string, string> {
  const c = THEMES[key].colors;
  return {
    "--brand": c.brand,
    "--brand-strong": c.brandStrong,
    "--accent": c.accent,
    "--accent-soft": c.accentSoft,
  };
}
