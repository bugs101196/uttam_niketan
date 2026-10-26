import type { Dictionary } from "@/i18n/dictionaries";

export type NavKey = Exclude<keyof Dictionary["nav"], "menu" | "staffLogin">;

export const navLinks: { key: NavKey; href: string }[] = [
  { key: "home", href: "/" },
  { key: "about", href: "/about" },
  { key: "academics", href: "/academics" },
  { key: "admissions", href: "/admissions" },
  { key: "notices", href: "/notices" },
  { key: "gallery", href: "/gallery" },
  { key: "contact", href: "/contact" },
];
