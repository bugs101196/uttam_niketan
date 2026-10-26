import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifies Meta's X-Hub-Signature-256 header ("sha256=<hex HMAC of the raw
 * body with the app secret>") in constant time. Fails closed when the secret
 * or header is missing.
 */
export function verifySignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!appSecret || !header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest();
  let received: Buffer;
  try {
    received = Buffer.from(header.slice("sha256=".length), "hex");
  } catch {
    return false;
  }
  return received.length === expected.length && timingSafeEqual(received, expected);
}

/** Answers Meta's subscription check: returns the challenge when the token matches. */
export function verifySubscription(params: URLSearchParams, verifyToken: string): string | null {
  if (!verifyToken) return null;
  const token = params.get("hub.verify_token") ?? "";
  const ok =
    params.get("hub.mode") === "subscribe" &&
    token.length === verifyToken.length &&
    timingSafeEqual(Buffer.from(token), Buffer.from(verifyToken));
  return ok ? params.get("hub.challenge") : null;
}

export interface StatusEvent {
  messageId: string;
  status: "sent" | "delivered" | "read" | "failed";
  at: string; // ISO timestamp
  error: string | null;
}

const KNOWN = new Set(["sent", "delivered", "read", "failed"]);

/** Pulls message status updates out of a webhook payload, ignoring anything else. */
export function parseStatusEvents(payload: unknown): StatusEvent[] {
  const events: StatusEvent[] = [];
  const entries = (payload as { entry?: unknown[] })?.entry;
  if (!Array.isArray(entries)) return events;
  for (const entry of entries) {
    const changes = (entry as { changes?: unknown[] })?.changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      const statuses = (change as { value?: { statuses?: unknown[] } })?.value?.statuses;
      if (!Array.isArray(statuses)) continue;
      for (const raw of statuses) {
        const s = raw as {
          id?: unknown;
          status?: unknown;
          timestamp?: unknown;
          errors?: { title?: string; message?: string }[];
        };
        if (typeof s.id !== "string" || typeof s.status !== "string" || !KNOWN.has(s.status)) continue;
        const seconds = Number(s.timestamp);
        events.push({
          messageId: s.id,
          status: s.status as StatusEvent["status"],
          at:
            Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000).toISOString() : new Date().toISOString(),
          error: s.errors?.[0] ? (s.errors[0].message ?? s.errors[0].title ?? "Delivery failed").slice(0, 200) : null,
        });
      }
    }
  }
  return events;
}
