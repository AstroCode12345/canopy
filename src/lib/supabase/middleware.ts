// Session refresh + route protection, run by src/middleware.ts on every
// matched request BEFORE the page renders.
//
// Two jobs:
//
// 1. REFRESH: auth tokens expire (about an hour). supabase.auth.getUser()
//    here validates the token against the Auth server and, if it is close to
//    expiring, rotates it. The rotated token has to be written into BOTH the
//    request cookies (so code later in this same request sees it) and the
//    response cookies (so the browser stores it for next time). That is what
//    the setAll dance below does, and it is why the Supabase docs are strict
//    about returning this exact response object unmodified.
//
// 2. PROTECT: signed-out visitors are redirected to /welcome for any page
//    that is not in PUBLIC_PATHS. This runs at the edge of the server, before
//    any page code, so there is no flash of protected content. Note this is a
//    UX gate, not the security boundary. Even if someone bypassed it, Row
//    Level Security in Postgres would still return zero rows without a valid
//    session. Defense in depth: the redirect is for humans, RLS is the wall.

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Pages that make sense for a signed-out visitor.
const PUBLIC_PATHS = ["/welcome", "/sign-in", "/auth", "/disclaimer"];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not put code between createServerClient and getUser: getUser is the
  // call that performs the refresh, and it must see the original cookies.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some(
    (p) => path === p || path.startsWith(p + "/"),
  );

  if (!user && !isPublic) {
    // Signed out, trying to reach the app: send to the welcome screen.
    const url = request.nextUrl.clone();
    url.pathname = "/welcome";
    return NextResponse.redirect(url);
  }

  if (user && (path === "/welcome" || path.startsWith("/sign-in"))) {
    // Already signed in: the auth screens are pointless, go home.
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
