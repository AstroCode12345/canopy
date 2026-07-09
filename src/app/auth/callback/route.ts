// The landing pad for every redirect-based auth flow.
//
// Two flows arrive here, both carrying a one-time ?code= parameter:
//   1. Google OAuth: Google redirects to Supabase, Supabase redirects here.
//   2. Email confirmation: the link in the signup email points here.
//
// The code alone is not a session. exchangeCodeForSession() trades it with
// the Auth server for real access + refresh tokens, which the server client
// writes into cookies (that is why this must be a route handler, where
// cookie writes are allowed). After that the user is properly signed in and
// we bounce them into the app.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Optional ?next= lets a flow choose where to land after auth.
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Missing or invalid code (expired link, reused link): back to sign-in
  // with an error flag the page can show a friendly message for.
  return NextResponse.redirect(`${origin}/sign-in?error=auth`);
}
