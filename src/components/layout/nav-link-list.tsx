"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export interface NavItem {
  href: string;
  label: string;
}

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Header links that mark the current page (aria-current) for sighted and screen-reader users. */
export function NavLinkList({ items, variant }: { items: NavItem[]; variant: "bar" | "menu" }) {
  const pathname = usePathname();
  return (
    <ul className={variant === "bar" ? "flex items-center gap-1" : undefined}>
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 items-center rounded-md px-3 font-medium hover:bg-accent-soft ${
                active ? "text-brand underline decoration-2 underline-offset-8" : "text-foreground"
              }`}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Closes the mobile <details> menu after navigation. The menu itself stays a
 * plain <details> so it still opens and closes without JavaScript.
 */
export function CloseOnNavigate({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();
  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [pathname]);
  return (
    <details
      ref={ref}
      className={className}
      onKeyDown={(e) => {
        if (e.key === "Escape" && ref.current?.open) {
          ref.current.open = false;
          ref.current.querySelector("summary")?.focus();
        }
      }}
    >
      {children}
    </details>
  );
}
