import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Signs out a user whose account was disabled while they were logged in.
// requireStaff() redirects here because pages cannot clear cookies themselves.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  if (request.nextUrl.searchParams.get("reason") === "inactive") url.searchParams.set("reason", "inactive");
  return NextResponse.redirect(url);
}
