import { normalizePhone } from "@/lib/validation/student";

// Server-side WhatsApp Cloud API settings. Nothing here is NEXT_PUBLIC_; the
// access token and app secret must never reach the browser or the logs.
//
// WHATSAPP_MODE:
//   off  (default) nothing is sent; queued alerts wait and expire after 2 days
//   test only numbers in WHATSAPP_TEST_RECIPIENTS receive messages; other alerts are skipped
//   live every eligible guardian receives messages (needs school authorization)

export type WhatsAppMode = "off" | "test" | "live";

export interface WhatsAppConfig {
  mode: WhatsAppMode;
  configured: boolean;
  accessToken: string;
  phoneNumberId: string;
  templateName: string;
  apiVersion: string;
  /** Override only for local end-to-end tests against a fake server. */
  apiBaseUrl: string;
  appSecret: string;
  verifyToken: string;
  testRecipients: Set<string>;
}

export function parseMode(value: string | undefined): WhatsAppMode {
  return value === "test" || value === "live" ? value : "off";
}

export function parseTestRecipients(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((v) => normalizePhone(v))
      .filter((v): v is string => v !== null),
  );
}

export function whatsappConfig(env: Record<string, string | undefined> = process.env): WhatsAppConfig {
  const accessToken = env.WHATSAPP_ACCESS_TOKEN ?? "";
  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID ?? "";
  const templateName = env.WHATSAPP_TEMPLATE_NAME || "absence_alert";
  return {
    mode: parseMode(env.WHATSAPP_MODE),
    configured: Boolean(accessToken && phoneNumberId && templateName),
    accessToken,
    phoneNumberId,
    templateName,
    apiVersion: env.WHATSAPP_API_VERSION || "v21.0",
    apiBaseUrl: (env.WHATSAPP_API_BASE_URL || "https://graph.facebook.com").replace(/\/$/, ""),
    appSecret: env.WHATSAPP_APP_SECRET ?? "",
    verifyToken: env.WHATSAPP_VERIFY_TOKEN ?? "",
    testRecipients: parseTestRecipients(env.WHATSAPP_TEST_RECIPIENTS),
  };
}
