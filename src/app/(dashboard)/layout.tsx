import type { Metadata } from "next";
import Link from "next/link";
import { SchoolLogo } from "@/components/layout/school-logo";
import { signOut } from "@/app/(auth)/login/actions";
import { requireStaff } from "@/lib/auth/staff";
import { DashboardNav } from "./dashboard-nav";

export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s · Uttam Niketan staff" },
  robots: { index: false },
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Layouts are not a security boundary (pages and actions check again), but
  // this keeps signed-out and disabled users from seeing the shell at all.
  const staff = await requireStaff();

  return (
    <div className="min-h-dvh">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/dashboard" className="flex min-h-11 items-center gap-2 font-bold text-brand">
            <SchoolLogo size={40} />
            <span className="sr-only sm:not-sr-only">Uttam Niketan</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="text-right text-sm leading-tight">
              <p className="font-semibold">{staff.fullName}</p>
              <p className="text-muted capitalize">{staff.role}</p>
            </div>
            <form action={signOut}>
              <button
                type="submit"
                className="min-h-11 rounded-lg border border-border px-3 text-sm font-semibold hover:bg-accent-soft"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
        <DashboardNav role={staff.role} />
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
