import { describe, expect, it } from "vitest";
import { albums, findPhoto } from "@/content/gallery";
import { isIsoDate } from "@/lib/dates";

describe("gallery albums", () => {
  it("have unique URL-safe ids, valid dates when given, and photo descriptions in both languages", () => {
    expect(new Set(albums.map((a) => a.id)).size).toBe(albums.length);
    for (const a of albums) {
      expect(a.id, a.id).toMatch(/^[a-z0-9-]+$/);
      if (a.date !== undefined) expect(isIsoDate(a.date), a.id).toBe(true);
      expect(a.title.en.trim() && a.title.hi.trim(), a.id).toBeTruthy();
      expect(a.photos.length, a.id).toBeGreaterThan(0);
      for (const p of a.photos) expect(p.alt.en.trim() && p.alt.hi.trim(), a.id).toBeTruthy();
    }
  });

  it("finds photos by album and position, and nothing out of range", () => {
    const first = albums[0];
    expect(findPhoto(first.id, 0)?.photo).toBe(first.photos[0]);
    expect(findPhoto(first.id, first.photos.length)).toBeUndefined();
    expect(findPhoto(first.id, -1)).toBeUndefined();
    expect(findPhoto("no-such-album", 0)).toBeUndefined();
  });
});
