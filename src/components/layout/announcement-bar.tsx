"use client";

import Link from "next/link";
import { useState } from "react";

export interface Announcement {
  text: string;
  href?: string;
}

/**
 * Scrolling news strip under the header. Pauses on hover/focus and has a
 * pause button (WCAG 2.2.2); visitors who prefer reduced motion get a still
 * list. The second copy of the items only makes the loop seamless and is
 * hidden from screen readers.
 */
export function AnnouncementBar({
  label,
  items,
  pauseLabel,
  playLabel,
}: {
  label: string;
  items: Announcement[];
  pauseLabel: string;
  playLabel: string;
}) {
  const [paused, setPaused] = useState(false);
  if (items.length === 0) return null;

  const list = (hidden: boolean) => (
    <ul aria-hidden={hidden || undefined} className="flex shrink-0 items-center">
      {items.map((item, i) => (
        <li key={i} className="flex items-center whitespace-nowrap">
          <span aria-hidden className="px-4 text-accent">
            ★
          </span>
          {item.href ? (
            <Link
              href={item.href}
              tabIndex={hidden ? -1 : undefined}
              className="font-semibold underline-offset-4 hover:underline"
            >
              {item.text}
            </Link>
          ) : (
            <span className="font-semibold">{item.text}</span>
          )}
        </li>
      ))}
    </ul>
  );

  return (
    <section aria-label={label} className="border-b border-brand-strong bg-brand-strong text-brand-contrast">
      <div className="mx-auto flex max-w-6xl items-center gap-2 pl-4">
        <span className="shrink-0 rounded-sm bg-accent px-2 py-0.5 text-xs font-bold tracking-wide text-foreground uppercase">
          {label}
        </span>
        <div className="marquee relative min-w-0 flex-1 overflow-hidden py-2" data-paused={paused}>
          <div
            className="marquee-track flex w-max"
            style={{ ["--marquee-duration" as string]: `${items.length * 12}s` }}
          >
            {list(false)}
            {list(true)}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          aria-pressed={paused}
          className="flex size-11 shrink-0 items-center justify-center text-sm hover:bg-white/10"
        >
          <span aria-hidden>{paused ? "▶" : "❚❚"}</span>
          <span className="sr-only">{paused ? playLabel : pauseLabel}</span>
        </button>
      </div>
    </section>
  );
}
