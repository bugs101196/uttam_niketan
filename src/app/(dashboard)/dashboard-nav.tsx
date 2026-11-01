"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { StaffRole } from "@/lib/auth/staff";

// Hiding links is for convenience only; each page enforces its own access.
const items: { href: string; label: string; roles: StaffRole[] }[] = [
  { href: "/dashboard", label: "Dashboard", roles: ["admin", "teacher"] },
  { href: "/attendance", label: "Attendance", roles: ["admin", "teacher"] },
  { href: "/reports/attendance", label: "Reports", roles: ["admin", "teacher"] },
  { href: "/students", label: "Students", roles: ["admin", "teacher"] },
  { href: "/staff", label: "Staff", roles: ["admin"] },
  { href: "/settings", label: "Settings", roles: ["admin"] },
];

export function DashboardNav({ role }: { role: StaffRole }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Staff" className="mx-auto max-w-6xl px-2">
      <ul className="flex flex-wrap gap-x-1">
        {items
          .filter((item) => item.roles.includes(role))
          .map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-11 items-center border-b-2 px-2.5 font-medium whitespace-nowrap sm:px-3 ${
                    active ? "border-brand text-brand" : "border-transparent text-muted hover:text-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
      </ul>
    </nav>
  );
}
