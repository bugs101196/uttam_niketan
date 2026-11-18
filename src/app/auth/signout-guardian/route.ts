import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Mirrors src/app/auth/signout/route.ts for the parent portal. requireGuardian()
// redirects here for a signed-in user with no active guardians row (disabled,
// or a staff account that somehow reached a parent page).
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const url = request.nextUrl.clone();
  url.pathname = "/parent/login";
  url.search = "";
  if (request.nextUrl.searchParams.get("reason") === "inactive") url.searchParams.set("reason", "inactive");
  return NextResponse.redirect(url);
}
