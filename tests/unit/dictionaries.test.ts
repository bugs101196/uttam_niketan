import { describe, expect, it } from "vitest";
import { isLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

function shape(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(shape);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shape(v)]));
  }
  return typeof value;
}

describe("dictionaries", () => {
  it("has the same keys and list lengths in every language", () => {
    const [first, ...rest] = locales.map(getDictionary);
    for (const dict of rest) expect(shape(dict)).toEqual(shape(first));
  });

  it("has no empty strings", () => {
    const leaves = (value: unknown): unknown[] =>
      value && typeof value === "object" ? Object.values(value).flatMap(leaves) : [value];
    for (const locale of locales) {
      expect(leaves(getDictionary(locale)).filter((s) => typeof s !== "string" || s.trim() === "")).toEqual([]);
    }
  });

  it("only accepts supported locales", () => {
    expect(isLocale("hi")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});
