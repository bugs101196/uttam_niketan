import type { Metadata } from "next";
import Link from "next/link";
import { SchoolLogo } from "@/components/layout/school-logo";
import { SkipLink } from "@/components/layout/skip-link";
import { requireGuardian } from "@/lib/auth/guardian";
import { signOutGuardian } from "../login/actions";

export const metadata: Metadata = {
  title: { default: "Parent portal", template: "%s · Uttam Niketan parent portal" },
  robots: { index: false },
};

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  // Layouts are not a security boundary (pages and actions check again), but
  // this keeps signed-out and disabled users from seeing the shell at all.
  const guardian = await requireGuardian();

  return (
    <div className="min-h-dvh">
      <SkipLink label="Skip to main content" />
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/parent/dashboard" className="flex min-h-11 items-center gap-2 font-bold text-brand">
            <SchoolLogo size={40} />
            <span className="sr-only sm:not-sr-only">Uttam Niketan</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm font-semibold">
            <Link href="/parent/dashboard" className="min-h-11 content-center hover:text-brand">
              Dashboard
            </Link>
            <Link href="/parent/homework" className="min-h-11 content-center hover:text-brand">
              Homework
            </Link>
            <Link href="/parent/notices" className="min-h-11 content-center hover:text-brand">
              Notices
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <p className="hidden text-sm font-semibold sm:block">{guardian.fullName}</p>
            <form action={signOutGuardian}>
              <button
                type="submit"
                className="min-h-11 rounded-lg border border-border px-3 text-sm font-semibold hover:bg-accent-soft"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto max-w-3xl px-4 py-8 focus:outline-none">
        {children}
      </main>
    </div>
  );
}
