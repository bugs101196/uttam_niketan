import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { processFeeReminderQueue } from "@/lib/whatsapp/worker";

// Daily run: finds newly-overdue invoices and sends/reschedules fee
// reminders. Unlike absence alerts (sent right after attendance is
// submitted), there is no natural "event" that makes an invoice overdue --
// this cron is the only trigger, not just a safety net. Vercel Cron calls
// this with "Authorization: Bearer $CRON_SECRET"; anything else is rejected.

export const dynamic = "force-dynamic";

function authorized(header: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false; // fail closed when not configured
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export async function GET(request: NextRequest) {
  if (!authorized(request.headers.get("authorization"))) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const result = await processFeeReminderQueue({ limit: 50 });
  return NextResponse.json(result);
}
