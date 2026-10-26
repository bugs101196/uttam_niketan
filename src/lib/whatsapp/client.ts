import type { WhatsAppConfig } from "./config";

// Minimal WhatsApp Cloud API client for the approved absence template.
// Template body parameters, in this order (see docs/whatsapp-templates.md):
//   {{1}} student name   {{2}} class and section   {{3}} date (DD-MM-YYYY)

export interface AbsenceMessage {
  to: string; // E.164, e.g. +919876543210
  language: "en" | "hi";
  studentName: string;
  classLabel: string;
  date: string; // YYYY-MM-DD
}

export type SendResult = { ok: true; messageId: string } | { ok: false; permanent: boolean; error: string };

export function formatTemplateDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}-${m}-${y}`;
}

export function buildTemplatePayload(templateName: string, message: AbsenceMessage) {
  return {
    messaging_product: "whatsapp",
    to: message.to.replace(/^\+/, ""),
    type: "template",
    template: {
      name: templateName,
      language: { code: message.language },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: message.studentName },
            { type: "text", text: message.classLabel },
            { type: "text", text: formatTemplateDate(message.date) },
          ],
        },
      ],
    },
  };
}

// Error codes worth retrying: rate limits, temporary outages, and auth/config
// problems that an administrator can fix (the job then succeeds on retry
// instead of failing every queued alert permanently).
const TRANSIENT_CODES = new Set([1, 2, 4, 17, 80007, 130429, 131000, 131016, 131048, 131056, 190]);

/** Decides whether a failed send should be retried. */
export function isPermanentFailure(httpStatus: number | null, errorCode?: number): boolean {
  if (httpStatus === null) return false; // network error
  if (httpStatus >= 500 || httpStatus === 429 || httpStatus === 401) return false;
  if (errorCode !== undefined && TRANSIENT_CODES.has(errorCode)) return false;
  return httpStatus >= 400;
}

export async function sendAbsenceTemplate(
  config: Pick<WhatsAppConfig, "accessToken" | "phoneNumberId" | "templateName" | "apiVersion" | "apiBaseUrl">,
  message: AbsenceMessage,
  fetchImpl: typeof fetch = fetch,
): Promise<SendResult> {
  const url = `${config.apiBaseUrl}/${config.apiVersion}/${encodeURIComponent(config.phoneNumberId)}/messages`;
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(buildTemplatePayload(config.templateName, message)),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return { ok: false, permanent: false, error: "Network error contacting WhatsApp" };
  }

  let body: { messages?: { id?: string }[]; error?: { code?: number; message?: string } } = {};
  try {
    body = await response.json();
  } catch {
    // Non-JSON body: fall through with an empty object.
  }

  const messageId = body.messages?.[0]?.id;
  if (response.ok && messageId) return { ok: true, messageId };

  const code = body.error?.code;
  // Keep provider wording short and free of request data; never include the token.
  const detail = (body.error?.message ?? "").slice(0, 200);
  return {
    ok: false,
    permanent: isPermanentFailure(response.status, code),
    error: `WhatsApp error ${response.status}${code ? ` (code ${code})` : ""}${detail ? `: ${detail}` : ""}`,
  };
}
