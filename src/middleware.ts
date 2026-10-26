import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isProtectedPath } from "@/lib/auth/paths";

// Refreshes the Supabase session cookie and sends signed-out visitors to the
// login page. This is a convenience redirect only: every protected page and
// action still checks the user itself, and RLS guards the data.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        },
      },
    },
  );

  // getUser() validates the token with Supabase Auth; do not trust getSession() here.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isProtectedPath(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Public website pages do not need auth, so keep the middleware off them.
  matcher: [
    "/login",
    "/dashboard/:path*",
    "/students/:path*",
    "/attendance/:path*",
    "/reports/:path*",
    "/staff/:path*",
    "/settings/:path*",
  ],
};
