import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SchoolLogo } from "@/components/layout/school-logo";
import { getGuardian } from "@/lib/auth/guardian";
import { isSupabaseConfigured } from "@/lib/env";
import { ParentLoginForm } from "./otp-login-form";

export const metadata: Metadata = {
  title: "Parent login",
  robots: { index: false },
};

const notices: Record<string, string> = {
  inactive: "This account is disabled. Please contact the school office.",
  "signed-out": "You have been signed out.",
};

export default async function ParentLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const configured = isSupabaseConfigured();
  if (configured && (await getGuardian())) redirect("/parent/dashboard");
  const { next, reason } = await searchParams;

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-3">
          <SchoolLogo size={56} priority />
          <span className="text-xl font-bold text-brand">Uttam Niketan</span>
        </Link>
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <h1 className="text-2xl font-bold">Parent login</h1>
          <p className="mt-1 mb-6 text-muted">
            Sign in with the mobile number the school office has on file for you.
          </p>
          {configured ? (
            <ParentLoginForm next={next} notice={reason ? notices[reason] : undefined} />
          ) : (
            <p role="status" className="rounded-lg border border-accent bg-accent-soft px-4 py-3">
              Parent login is not available yet.
            </p>
          )}
        </div>
        <p className="mt-6 text-center text-sm text-muted">
          School staff?{" "}
          <Link href="/login" className="font-semibold text-brand hover:underline">
            Sign in here
          </Link>
        </p>
      </div>
    </div>
  );
}
