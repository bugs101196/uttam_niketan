import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/form";
import { requireAdmin } from "@/lib/auth/staff";
import { formatDate, formatDateTime } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { whatsappConfig } from "@/lib/whatsapp/config";
import type { Database } from "@/types/database";
import { setMessagingEnabled } from "./actions";
import { RunQueueButton } from "./run-queue-button";

export const metadata: Metadata = { title: "Settings" };

type JobStatus = Database["public"]["Enums"]["notification_status"];

const STATUSES: JobStatus[] = ["queued", "processing", "sent", "delivered", "read", "failed", "cancelled", "skipped"];

const statusStyle: Record<JobStatus, string> = {
  queued: "border-amber-200 bg-amber-50 text-amber-800",
  processing: "border-amber-200 bg-amber-50 text-amber-800",
  sent: "border-green-200 bg-green-50 text-green-800",
  delivered: "border-green-200 bg-green-50 text-green-800",
  read: "border-green-200 bg-green-50 text-green-800",
  failed: "border-red-200 bg-red-50 text-red-800",
  cancelled: "border-gray-200 bg-gray-100 text-gray-700",
  skipped: "border-gray-200 bg-gray-100 text-gray-700",
};

const modeText = {
  off: "Off — nothing is sent. Alerts wait in the queue and expire after 2 days.",
  test: "Test — only the configured test numbers receive messages; other alerts are skipped.",
  live: "Live — guardians who have consented receive absence alerts.",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const admin = await requireAdmin();
  const { status } = await searchParams;
  const filter = STATUSES.includes(status as JobStatus) ? (status as JobStatus) : undefined;
  const supabase = await createClient();
  const config = whatsappConfig();

  const [{ data: school }, { count: consented }, jobsQuery] = await Promise.all([
    supabase.from("schools").select("name, whatsapp_enabled").eq("id", admin.schoolId).single(),
    supabase
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("enrollment_status", "active")
      .eq("guardian_notifications_consent", true)
      .not("guardian_phone", "is", null),
    (() => {
      let q = supabase
        .from("notification_jobs")
        .select(
          "id, attendance_date, status, attempts, last_error, created_at, sent_at, delivered_at, read_at, template_language, students(full_name)",
        )
        .order("created_at", { ascending: false })
        .limit(100);
      if (filter) q = q.eq("status", filter);
      return q;
    })(),
  ]);
  const jobs = jobsQuery.data ?? [];
  const enabled = school?.whatsapp_enabled ?? false;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted">{school?.name}</p>
      </div>

      <Link
        href="/settings/classes"
        className="flex min-h-16 items-center justify-between rounded-xl border border-border bg-surface p-5 hover:bg-accent-soft"
      >
        <span>
          <span className="block text-lg font-bold">Classes &amp; academic year</span>
          <span className="text-muted">Add or rename classes and sections, start a new academic year</span>
        </span>
        <span aria-hidden className="text-2xl text-brand">
          →
        </span>
      </Link>

      <section aria-labelledby="messaging" className="rounded-xl border border-border bg-surface p-5">
        <h2 id="messaging" className="text-lg font-bold">
          WhatsApp absence alerts
        </h2>
        <p className="mt-1 text-muted">
          When attendance is submitted, guardians of absent students receive a WhatsApp message — only if the guardian
          has agreed and a mobile number is recorded.
        </p>

        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-background p-3">
            <dt className="text-sm text-muted">School setting</dt>
            <dd className="font-semibold">{enabled ? "On" : "Off"}</dd>
          </div>
          <div className="rounded-lg bg-background p-3">
            <dt className="text-sm text-muted">Server sending</dt>
            <dd className="font-semibold capitalize">
              {config.mode}
              {config.mode !== "off" && !config.configured ? " (not configured)" : ""}
            </dd>
          </div>
          <div className="rounded-lg bg-background p-3">
            <dt className="text-sm text-muted">Students with consent and a number</dt>
            <dd className="font-semibold">{consented ?? 0}</dd>
          </div>
        </dl>
        <p className="mt-3 text-sm text-muted">{modeText[config.mode]}</p>
        {config.mode === "test" ? (
          <p className="text-sm text-muted">Test numbers configured: {config.testRecipients.size}</p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-start gap-3">
          <form action={setMessagingEnabled.bind(null, !enabled)}>
            <Button type="submit" variant={enabled ? "danger" : "primary"}>
              {enabled ? "Turn alerts off" : "Turn alerts on"}
            </Button>
          </form>
          <RunQueueButton />
        </div>
        <p className="mt-2 text-sm text-muted">
          Alerts are sent only when both the school setting is on and server sending is test or live. Live sending needs
          the school&apos;s WhatsApp Business account, approved templates and written authorization.
        </p>
      </section>

      <section aria-labelledby="log">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="log" className="text-lg font-bold">
            Message log
          </h2>
          <nav aria-label="Filter by status" className="flex flex-wrap gap-1 text-sm">
            <Link
              href="/settings"
              aria-current={!filter ? "page" : undefined}
              className={`rounded-full border px-3 py-1.5 ${!filter ? "border-brand bg-brand text-brand-contrast" : "border-border"}`}
            >
              All
            </Link>
            {STATUSES.map((s) => (
              <Link
                key={s}
                href={`/settings?status=${s}`}
                aria-current={filter === s ? "page" : undefined}
                className={`rounded-full border px-3 py-1.5 capitalize ${filter === s ? "border-brand bg-brand text-brand-contrast" : "border-border"}`}
              >
                {s}
              </Link>
            ))}
          </nav>
        </div>

        {jobs.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-border bg-surface p-6 text-center text-muted">
            No messages {filter ? `with status “${filter}”` : "yet"}.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-surface">
            {jobs.map((job) => (
              <li key={job.id} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium">{job.students?.full_name ?? "Student"}</p>
                  <p className="text-sm text-muted">
                    Absent {formatDate(job.attendance_date)} · {job.template_language === "hi" ? "Hindi" : "English"} ·
                    queued {formatDateTime(job.created_at)}
                    {job.attempts > 1 ? ` · ${job.attempts} attempts` : ""}
                  </p>
                  {job.last_error ? <p className="text-sm text-red-700">{job.last_error}</p> : null}
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2.5 py-0.5 text-sm capitalize ${statusStyle[job.status]}`}
                >
                  {job.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
