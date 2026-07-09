// Server-side Supabase client, for API routes (like /api/scan) and any
// future server components.
//
// Why a second helper: on the server there is no browser to hold cookies,
// so this client reads the auth session out of the INCOMING REQUEST's
// cookies (via Next.js's cookies() helper). That is how a route handler can
// answer "who is calling me?" with supabase.auth.getUser().
//
// The try/catch around setAll: when called from a Server Component, Next.js
// forbids writing cookies (the response has already started streaming).
// That is fine to ignore, because middleware or route handlers do the
// actual session refreshing; this client only needs to READ who you are.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component; safe to ignore (see note above).
          }
        },
      },
    },
  );
}
