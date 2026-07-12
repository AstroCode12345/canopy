"use client";

// One hook that answers "who is signed in, and what is their profile row?"
// for any client component (Home greeting, Profile header, Settings account
// card). Replaces the old getIdentity() localStorage reads.
//
// Why a hook instead of a plain function: auth state can CHANGE while a page
// is open (sign out in another tab, token refresh). onAuthStateChange keeps
// every component using this hook in sync automatically.

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export function useProfile() {
  // useMemo so we create the client once per component, not on every render.
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // "cancelled" guards against a slow response landing after the component
    // is gone (or after a newer load started) and writing stale state.
    let cancelled = false;

    async function load() {
      // getSession() reads the session straight from the cookie with NO
      // network call, unlike getUser() which round-trips to Supabase's auth
      // server. That round-trip was on the critical path of every page load.
      // It's safe to trust the cookie here: middleware.ts revalidates and
      // refreshes the token server-side on every navigation before the page
      // renders, so the session the client reads is already fresh and vetted.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      if (cancelled) return;
      setUser(user);

      if (user) {
        // maybeSingle: expect 0 or 1 rows without treating 0 as an error.
        // RLS already scopes this to our own row; .eq makes intent explicit.
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();
        if (cancelled) return;
        setProfile(data);
      } else {
        setProfile(null);
      }
      setLoading(false);
    }

    load();

    // Re-run on any auth event (signed in, signed out, token refreshed).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      load();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [supabase]);

  return { supabase, user, profile, loading };
}
