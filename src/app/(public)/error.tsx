"use client";

import { useEffect } from "react";

// Client error boundaries cannot read the language cookie on the server, so
// the message is shown in both languages.
export default function PublicError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("public page error", error.digest ?? error.message);
  }, [error]);
  return (
    <div role="alert" className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold text-brand">Something went wrong</h1>
      <p lang="hi" className="mt-1 text-xl font-semibold text-brand">
        कुछ गड़बड़ हो गई
      </p>
      <p className="mt-4 text-lg text-muted">This page could not be loaded. Please try again in a moment.</p>
      <p lang="hi" className="text-lg text-muted">
        यह पृष्ठ लोड नहीं हो सका। कृपया थोड़ी देर बाद फिर से प्रयास करें।
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-8 inline-flex min-h-12 items-center rounded-lg bg-brand px-6 font-semibold text-brand-contrast hover:bg-brand-strong"
      >
        Try again · फिर से प्रयास करें
      </button>
    </div>
  );
}
