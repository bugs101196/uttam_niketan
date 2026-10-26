import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { whatsappConfig } from "@/lib/whatsapp/config";
import { parseStatusEvents, verifySignature, verifySubscription } from "@/lib/whatsapp/webhook";

// WhatsApp Cloud API webhook: delivery status updates for sent alerts.
// Configure the callback URL https://<site>/api/webhooks/whatsapp in the Meta
// app with WHATSAPP_VERIFY_TOKEN, and set WHATSAPP_APP_SECRET for signatures.

export const dynamic = "force-dynamic";

/** Subscription handshake. */
export async function GET(request: NextRequest) {
  const challenge = verifySubscription(request.nextUrl.searchParams, whatsappConfig().verifyToken);
  if (challenge === null) return new NextResponse("Forbidden", { status: 403 });
  return new NextResponse(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
}

/** Status callbacks. Unsigned or badly signed requests are rejected before parsing. */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (!verifySignature(raw, request.headers.get("x-hub-signature-256"), whatsappConfig().appSecret)) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new NextResponse("Bad request", { status: 400 });
  }

  const events = parseStatusEvents(payload);
  if (events.length > 0) {
    const db = createAdminClient();
    for (const event of events) {
      const { error } = await db.rpc("apply_whatsapp_status", {
        p_provider_message_id: event.messageId,
        p_status: event.status,
        p_at: event.at,
        p_error: event.error ?? undefined,
      });
      if (error) {
        console.error("whatsapp webhook: apply status failed", error.code);
        // 500 makes Meta retry later; status updates are idempotent.
        return new NextResponse("Retry later", { status: 500 });
      }
    }
  }
  return NextResponse.json({ received: events.length });
}
