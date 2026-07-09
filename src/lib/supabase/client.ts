// Browser-side Supabase client.
//
// Use this in "use client" components (which is every page in Canopy today).
// createBrowserClient comes from @supabase/ssr and stores the auth session in
// COOKIES instead of localStorage. That choice matters: cookies travel with
// every request to our own server, so later our API routes (like /api/scan)
// can know WHO is making the request and attach scans to their account.
// Plain localStorage sessions would be invisible to the server.
//
// Safe to expose here: the URL and anon key are public by design. Row Level
// Security in Postgres is what actually protects data (see supabase/README.md).

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
