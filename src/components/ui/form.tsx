import type { ComponentProps, ReactNode } from "react";

// Small set of accessible, large-tap-target form primitives for the staff app.

const control =
  "block min-h-12 w-full rounded-lg border border-border bg-surface px-3 text-base text-foreground " +
  "focus:border-brand focus:outline-2 focus:outline-brand/30 aria-[invalid=true]:border-red-600";

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block font-medium">
        {label}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${htmlFor}-hint`} className="mt-1 text-sm text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${htmlFor}-error`} className="mt-1 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Input({ invalid, ...props }: ComponentProps<"input"> & { invalid?: boolean }) {
  return <input {...props} aria-invalid={invalid || undefined} className={control} />;
}

export function Select({ invalid, ...props }: ComponentProps<"select"> & { invalid?: boolean }) {
  return <select {...props} aria-invalid={invalid || undefined} className={control} />;
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: "primary" | "secondary" | "danger" }) {
  const styles = {
    primary: "bg-brand text-brand-contrast hover:bg-brand-strong",
    secondary: "border border-border bg-surface text-foreground hover:bg-accent-soft",
    danger: "border border-red-300 bg-surface text-red-700 hover:bg-red-50",
  }[variant];
  return (
    <button
      {...props}
      className={`inline-flex min-h-12 items-center justify-center rounded-lg px-5 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${styles} ${className}`}
    />
  );
}

export function Alert({ tone, children }: { tone: "error" | "success" | "info"; children: ReactNode }) {
  const styles = {
    error: "border-red-300 bg-red-50 text-red-800",
    success: "border-green-300 bg-green-50 text-green-800",
    info: "border-accent bg-accent-soft text-foreground",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-lg border px-4 py-3 ${styles}`}>
      {children}
    </div>
  );
}
