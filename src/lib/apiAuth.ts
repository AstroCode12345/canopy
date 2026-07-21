// Auth guard shared by every API route that spends real money per request
// (/api/scan calls the Anthropic API; /api/barcode calls Open Food Facts,
// cheap but still a public endpoint worth locking). Neither route is
// covered by middleware.ts, which explicitly excludes api/ so the redteam
// suite can drive /api/scan directly against a local dev server with no
// session. That exclusion is intentional and this file preserves it: the
// gate below only activates in production. In dev (`next dev`, which the
// redteam suite runs against) it's a no-op, so `npm run redteam` keeps
// working exactly as before.
//
// In production it closes the actual gap: without this, the deployed URL
// is a public, unauthenticated way to spend the app owner's Anthropic
// credits. A real user is always signed in by the time they reach the scan
// screen (the app has no anonymous flow), so requiring a session here costs
// legitimate users nothing.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Returns a 401 response if this request must be blocked, or null if the
 * route should proceed. Call as the first line of the route handler:
 *
 *   const blocked = await requireSessionInProduction();
 *   if (blocked) return blocked;
 *
 * Deliberately uses getUser(), not getSession(): getSession() only decodes
 * the cookie locally and trusts it, which is fine on pages because
 * middleware.ts re-validates the token server-side on every navigation
 * (see useProfile.ts). Middleware does not run on api/ routes at all, so
 * there is no upstream revalidation here — this call IS the check, and it
 * has to actually ask Supabase's auth server whether the token is still
 * good, not just trust what the cookie claims.
 */
export async function requireSessionInProduction(): Promise<NextResponse | null> {
  if (process.env.NODE_ENV !== "production") return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Sign in to use this feature." },
      { status: 401 },
    );
  }
  return null;
}
