---
name: site-content
description: Add or change public website content for Uttam Niketan — notices, gallery photos, the scrolling news strip, contact details, logo or icons. Use when the owner sends a notice, photos, a phone number/email/address, or asks for an announcement on the website.
---

# Public website content

Content lives in code (no CMS yet; a school-managed editor would be a change request). Every
visible text needs **English and Hindi**; write the Hindi yourself if only one language is given
and tell the owner so they can check it.

| What               | Where                                                                                                                                      | Notes                                                                                                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Notices            | `src/content/notices.ts`                                                                                                                   | Newest first, `date` YYYY-MM-DD, optional `highlightUntil` shows it in the home "Important notice" box and the news strip until that day (inclusive). Shown on `/notices` in both languages. |
| News strip         | `src/app/(public)/layout.tsx` (`AnnouncementBar` items) + `announcements` in `src/i18n/dictionaries.ts`                                    | Highlighted notices are added automatically. Keep items short; each links somewhere useful.                                                                                                  |
| Gallery            | images in `src/assets/gallery/<album>/`, list in `src/content/gallery.ts`                                                                  | Static imports (next/image makes WebP/AVIF sizes + blur). Each photo needs `alt` in both languages. First 4 photos also appear on the home page.                                             |
| Phones, email, map | `src/lib/school.ts`                                                                                                                        | Used by Contact page, footer and Admissions call buttons.                                                                                                                                    |
| Page text          | `src/i18n/dictionaries.ts`                                                                                                                 | Lines marked `// PLACEHOLDER` still await school-approved copy.                                                                                                                              |
| Logo & icons       | `src/assets/logo.png` (transparent cut-out, own shape, no box), `src/app/icon.png`, `apple-icon.png`, `favicon.ico`, `opengraph-image.jpg` | Regenerate all of them together.                                                                                                                                                             |

## Images

1. Images pasted in chat appear under the session's `images/` folder (`1.jpg`, `2.jpg`, …). If a
   new message's images are not there, they arrived only as pictures: ask the owner to attach them
   again; never redraw or guess them.
2. Optimise: `convert in.jpg -auto-orient -strip -sampling-factor 4:2:0 -interlace JPEG -quality 82
out.jpg`. `-strip` removes EXIF, including GPS location. Do not upscale (WhatsApp photos are
   ~1080 px wide).
3. Logos with a fake "transparent" checkerboard or a generator watermark need the background cut out
   (flood-fill from the corners on a solid background; mask by shape for checkerboards) before use.
4. **Children's faces:** publish identifiable students only with guardian permission (roadmap §16).
   If unclear, say so in the report; the owner decides.

## Finish

`npx tsc --noEmit && npx eslint src tests && npx vitest run --project unit` (notices and gallery have
tests that require both languages and valid dates), `npx next build`, a Playwright screenshot at
390 px and 1280 px, then commit, push a branch, and merge/deploy only when asked (see `ship-feature`).
