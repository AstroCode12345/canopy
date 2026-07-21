// Next.js middleware entry point. Runs updateSession (session refresh +
// route protection) on every request the matcher lets through.

import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Run on everything EXCEPT:
  //   _next/static, _next/image  : Next.js build assets
  //   favicon, icon, apple-icon,
  //   manifest.webmanifest       : PWA metadata files, must stay public
  //   api/                       : API routes manage their own auth (see
  //                                requireSessionInProduction() in
  //                                src/lib/apiAuth.ts) rather than going
  //                                through middleware, specifically so the
  //                                red-team harness can keep calling
  //                                /api/scan unauthenticated against a
  //                                local dev server. The guard itself is a
  //                                production-only no-op in dev.
  //   image files                : static assets
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
