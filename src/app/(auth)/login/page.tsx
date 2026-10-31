import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SchoolLogo } from "@/components/layout/school-logo";
import { getStaff } from "@/lib/auth/staff";
import { isSupabaseConfigured } from "@/lib/env";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Staff login",
  robots: { index: false },
};

const notices: Record<string, string> = {
  inactive: "Your account is disabled. Please contact the school administrator.",
  "signed-out": "You have been signed out.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const configured = isSupabaseConfigured();
  if (configured && (await getStaff())) redirect("/dashboard");
  const { next, reason } = await searchParams;

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-3">
          <SchoolLogo size={56} priority />
          <span className="text-xl font-bold text-brand">Uttam Niketan</span>
        </Link>
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <h1 className="text-2xl font-bold">Staff login</h1>
          <p className="mt-1 mb-6 text-muted">For school staff only. Accounts are created by the school office.</p>
          {configured ? (
            <LoginForm next={next} notice={reason ? notices[reason] : undefined} />
          ) : (
            <p role="status" className="rounded-lg border border-accent bg-accent-soft px-4 py-3">
              Staff login is not available yet. It will be switched on once the school&apos;s accounts are set up.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
