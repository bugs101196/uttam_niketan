import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildTemplatePayload, isPermanentFailure, sendAbsenceTemplate } from "@/lib/whatsapp/client";
import { parseMode, parseTestRecipients, whatsappConfig } from "@/lib/whatsapp/config";
import { parseStatusEvents, verifySignature, verifySubscription } from "@/lib/whatsapp/webhook";
import { processNotificationQueue, type ClaimedJob, type QueueStore } from "@/lib/whatsapp/worker";

const message = {
  to: "+919876543210",
  language: "hi" as const,
  studentName: "Diya Test",
  classLabel: "Class 3 – A",
  date: "2026-10-26",
};

describe("template payload", () => {
  it("puts name, class and date in the approved order with the guardian's language", () => {
    const payload = buildTemplatePayload("absence_alert", message);
    expect(payload.to).toBe("919876543210");
    expect(payload.template.language.code).toBe("hi");
    expect(payload.template.components[0].parameters.map((p) => p.text)).toEqual([
      "Diya Test",
      "Class 3 – A",
      "26-10-2026",
    ]);
  });
});

describe("failure classification", () => {
  it.each([
    [null, undefined, false, "network error"],
    [503, undefined, false, "server error"],
    [429, undefined, false, "rate limited"],
    [400, 131056, false, "pair rate limit"],
    [401, 190, false, "expired token (fixable)"],
    [400, 131026, true, "undeliverable recipient"],
    [400, 132001, true, "template missing"],
  ] as [number | null, number | undefined, boolean, string][])("%s / %s -> permanent=%s (%s)", (status, code, permanent) => {
    expect(isPermanentFailure(status, code)).toBe(permanent);
  });
});

function fakeFetch(status: number, body: unknown): typeof fetch {
  return (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;
}

const config = whatsappConfig({
  WHATSAPP_MODE: "live",
  WHATSAPP_ACCESS_TOKEN: "secret-token",
  WHATSAPP_PHONE_NUMBER_ID: "12345",
  WHATSAPP_TEST_RECIPIENTS: "98765 43210, +91 99999 00001, junk",
});

describe("sending", () => {
  it("returns the provider message id on success", async () => {
    const result = await sendAbsenceTemplate(config, message, fakeFetch(200, { messages: [{ id: "wamid.1" }] }));
    expect(result).toEqual({ ok: true, messageId: "wamid.1" });
  });

  it("never puts the access token in the error", async () => {
    const result = await sendAbsenceTemplate(
      config,
      message,
      fakeFetch(400, { error: { code: 131026, message: "Message undeliverable" } }),
    );
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain("secret-token");
    expect(result).toMatchObject({ permanent: true });
  });

  it("treats a network failure as retryable", async () => {
    const failing = (async () => {
      throw new Error("ECONNRESET");
    }) as typeof fetch;
    expect(await sendAbsenceTemplate(config, message, failing)).toMatchObject({ ok: false, permanent: false });
  });
});

describe("config", () => {
  it("defaults to off and normalises test numbers", () => {
    expect(parseMode(undefined)).toBe("off");
    expect(parseMode("LIVE")).toBe("off");
    expect([...parseTestRecipients("98765 43210, +91 99999 00001, junk")]).toEqual(["+919876543210", "+919999900001"]);
    expect(whatsappConfig({}).configured).toBe(false);
  });
});

describe("webhook verification", () => {
  const secret = "app-secret";
  const body = JSON.stringify({ entry: [] });
  const sign = (b: string, s = secret) => `sha256=${createHmac("sha256", s).update(b).digest("hex")}`;

  it("accepts a correct signature and rejects tampering", () => {
    expect(verifySignature(body, sign(body), secret)).toBe(true);
    expect(verifySignature(body + " ", sign(body), secret)).toBe(false);
    expect(verifySignature(body, sign(body, "other"), secret)).toBe(false);
    expect(verifySignature(body, null, secret)).toBe(false);
    expect(verifySignature(body, "sha1=abc", secret)).toBe(false);
    expect(verifySignature(body, sign(body), "")).toBe(false);
  });

  it("answers the subscription challenge only with the right token", () => {
    const params = (token: string) =>
      new URLSearchParams({ "hub.mode": "subscribe", "hub.verify_token": token, "hub.challenge": "42" });
    expect(verifySubscription(params("verify-me"), "verify-me")).toBe("42");
    expect(verifySubscription(params("wrong"), "verify-me")).toBeNull();
    expect(verifySubscription(params(""), "")).toBeNull();
  });

  it("extracts status events and ignores everything else", () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                statuses: [
                  { id: "wamid.1", status: "delivered", timestamp: "1793000000" },
                  { id: "wamid.2", status: "failed", timestamp: "1793000001", errors: [{ title: "Undeliverable" }] },
                  { id: "wamid.3", status: "deleted" },
                ],
                messages: [{ id: "incoming" }],
              },
            },
          ],
        },
      ],
    };
    const events = parseStatusEvents(payload);
    expect(events.map((e) => [e.messageId, e.status, e.error])).toEqual([
      ["wamid.1", "delivered", null],
      ["wamid.2", "failed", "Undeliverable"],
    ]);
    expect(events[0].at).toBe(new Date(1793000000 * 1000).toISOString());
    expect(parseStatusEvents(null)).toEqual([]);
  });
});

describe("worker", () => {
  const job = (id: string, phone: string): ClaimedJob => ({
    id,
    recipient_phone: phone,
    template_language: "en",
    student_name: "Test Child",
    class_label: "Class 1 – A",
    attendance_date: "2026-10-26",
    attempts: 1,
  });

  function memoryStore(jobs: ClaimedJob[]) {
    const outcomes: [string, string, string | undefined][] = [];
    const store: QueueStore = {
      claim: async () => jobs,
      complete: async (id, outcome, messageId, error) => {
        outcomes.push([id, outcome, messageId ?? error]);
      },
    };
    return { store, outcomes };
  }

  it("does nothing when sending is off", async () => {
    const { store, outcomes } = memoryStore([job("a", "+919876543210")]);
    const result = await processNotificationQueue({ config: whatsappConfig({ WHATSAPP_MODE: "off" }), store });
    expect(result.status).toBe("disabled");
    expect(outcomes).toEqual([]);
  });

  it("in test mode sends only to test numbers and skips the rest", async () => {
    const { store, outcomes } = memoryStore([job("a", "+919876543210"), job("b", "+918888888888")]);
    const result = await processNotificationQueue({
      config: { ...config, mode: "test" },
      store,
      fetchImpl: fakeFetch(200, { messages: [{ id: "wamid.ok" }] }),
    });
    expect(result).toMatchObject({ sent: 1, skipped: 1 });
    expect(outcomes).toEqual([
      ["a", "sent", "wamid.ok"],
      ["b", "skipped", "Test mode: not a test recipient"],
    ]);
  });

  it("maps provider failures to retry or failed", async () => {
    const { store, outcomes } = memoryStore([job("a", "+919876543210")]);
    await processNotificationQueue({ config, store, fetchImpl: fakeFetch(503, {}) });
    const { store: store2, outcomes: outcomes2 } = memoryStore([job("b", "+919876543210")]);
    await processNotificationQueue({
      config,
      store: store2,
      fetchImpl: fakeFetch(400, { error: { code: 131026, message: "Undeliverable" } }),
    });
    expect(outcomes[0][1]).toBe("retry");
    expect(outcomes2[0][1]).toBe("failed");
  });
});
