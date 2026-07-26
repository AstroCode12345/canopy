// Guard shared by every API route that spends real money per request
// (/api/scan calls the Anthropic API; /api/barcode calls Open Food Facts,
// cheap but still a public endpoint worth locking). Neither route is
// covered by middleware.ts, which explicitly excludes api/ so the redteam
// suite can drive /api/scan directly against a local dev server with no
// session. That exclusion is intentional and this file preserves it: the
// gates below only activate in production. In dev (`next dev`, which the
// redteam suite runs against) they are a no-op, so `npm run redteam` keeps
// working exactly as before.
//
// Two separate questions get answered here, and they are not the same:
//
//   Auth asks WHO. Without it, the deployed URL is a public, unauthenticated
//   way to spend the app owner's Anthropic credits.
//
//   Rate limiting asks HOW MUCH. Auth alone still lets a single signed-in
//   account drain the budget, either deliberately or through a retry loop in
//   a buggy client. The counter lives in Postgres rather than in memory
//   because Vercel spreads requests across serverless instances that are
//   recycled constantly, so a module-level variable would reset
//   unpredictably and only catch abuse by luck.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const WINDOW_SECONDS = 60 * 60;

/**
 * Auth check plus per-account rate limit, in a single pass.
 *
 * Combined on purpose: both need the same validated user, and asking
 * Supabase's auth server twice per request would double the latency of the
 * cheapest part of the route for no benefit.
 *
 * Call as the first line of the route handler:
 *
 *   const blocked = await guardApiRoute({ endpoint: "scan", maxPerHour: 60 });
 *   if (blocked) return blocked;
 *
 * Deliberately uses getUser(), not getSession(): getSession() only decodes
 * the cookie locally and trusts it, which is fine on pages because
 * middleware.ts re-validates the token server-side on every navigation
 * (see useProfile.ts). Middleware does not run on api/ routes at all, so
 * there is no upstream revalidation here. This call IS the check, and it
 * has to actually ask Supabase whether the token is still good rather than
 * trust what the cookie claims.
 */
export async function guardApiRoute({
  endpoint,
  maxPerHour,
}: {
  endpoint: string;
  maxPerHour: number;
}): Promise<NextResponse | null> {
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

  const { data: used, error } = await supabase.rpc(
    "record_and_check_rate_limit",
    { p_endpoint: endpoint, p_window_seconds: WINDOW_SECONDS },
  );

  if (error) {
    // Fail OPEN, loudly.
    //
    // This is a deliberate safety call, not an oversight. The realistic
    // cause is the migration not being applied to this environment yet, and
    // the thing on the other side of this guard is a tool someone may be
    // standing in a shop relying on to tell them whether a food will hurt
    // them. Refusing every scan to protect a budget would trade a real
    // safety failure for a financial one. The log line is the alarm; the
    // scan still happens.
    console.error(
      `[apiAuth] rate limit check failed for ${endpoint}, allowing request:`,
      error.message,
    );
    return null;
  }

  if (typeof used === "number" && used > maxPerHour) {
    return NextResponse.json(
      {
        error:
          "You've hit the hourly limit for scans. Try again in a little while.",
      },
      { status: 429, headers: { "Retry-After": String(WINDOW_SECONDS) } },
    );
  }

  return null;
}
