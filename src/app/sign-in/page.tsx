"use client";

// Real authentication, backed by Supabase Auth.
//
// Three flows live here:
//   1. Create profile: supabase.auth.signUp. The name field travels as
//      full_name metadata, which the database trigger (handle_new_user in
//      supabase/migrations) reads to build the profiles row. With email
//      confirmation enabled, signUp sends a link and returns NO session;
//      we show a "check your email" screen until they click it.
//   2. Sign in: signInWithPassword. Session lands in cookies immediately.
//   3. Google: signInWithOAuth redirects to Google, then back through
//      /auth/callback, which exchanges the one-time code for a session.

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Leaf, MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.6 9.2c0-.6-.1-1.2-.2-1.8H9v3.5h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.6Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.4 0 4.5-.8 6-2.2l-2.9-2.2c-.8.5-1.8.9-3.1.9-2.4 0-4.4-1.6-5.1-3.8H.9v2.3A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.9 10.7a5.4 5.4 0 0 1 0-3.4V5H.9a9 9 0 0 0 0 8l3-2.3Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.6c1.3 0 2.5.5 3.4 1.3l2.6-2.6A9 9 0 0 0 .9 5l3 2.3C4.6 5.2 6.6 3.6 9 3.6Z"
      />
    </svg>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
        {label}
      </span>
      <div className="flex items-center rounded-2xl border border-border-strong bg-card px-4 py-3.5">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          className="w-full bg-transparent text-[15px] font-medium text-foreground outline-none placeholder:text-faint placeholder:font-normal"
        />
      </div>
    </label>
  );
}

function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const mode = params.get("mode") === "in" ? "in" : "create";
  // /auth/callback bounces here with ?error=auth when a link is bad/expired.
  const arrivedWithError = params.get("error") === "auth";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    arrivedWithError
      ? "That sign-in link was invalid or expired. Try again."
      : null,
  );
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);

  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);

    if (mode === "create") {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          // Lands in auth.users.raw_user_meta_data, where the
          // handle_new_user trigger picks it up for profiles.display_name.
          data: { full_name: name.trim() },
          emailRedirectTo: `${location.origin}/auth/callback?next=/profile`,
        },
      });
      setBusy(false);
      if (error) {
        setError(error.message);
        return;
      }
      if (!data.session) {
        // Email confirmation is on: no session until they click the link.
        setAwaitingConfirm(true);
        return;
      }
      // Confirmation disabled: signed in right away. A brand-new account can
      // never already have allergens, so this always means "go set them up" —
      // no need to query the database just to confirm what we already know.
      router.push("/profile");
      router.refresh();
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      setBusy(false);
      if (error) {
        setError(error.message);
        return;
      }
      router.push("/");
      router.refresh();
    }
  };

  const handleGoogle = async () => {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/auth/callback`,
      },
    });
    // On success the browser navigates away to Google; we only land back
    // here if starting the flow failed (e.g. provider not enabled yet).
    if (error) setError(error.message);
  };

  // "Check your email" state after signup with confirmation enabled.
  if (awaitingConfirm) {
    return (
      <div className="hero-bg flex min-h-dvh flex-col bg-background">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">
            <MailCheck className="h-7 w-7" strokeWidth={1.75} />
          </span>
          <h1 className="mt-5 text-[1.6rem] font-bold tracking-tight">
            Check your email
          </h1>
          <p className="mt-2.5 max-w-[300px] text-[15px] leading-relaxed text-muted">
            We sent a confirmation link to{" "}
            <span className="font-semibold text-foreground">{email}</span>.
            Click it to activate your account, then come back and sign in.
          </p>
          <Link
            href="/sign-in?mode=in"
            className="mt-7 flex items-center justify-center rounded-full bg-accent px-8 py-3 text-base font-semibold text-white shadow-soft"
          >
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  const heading = mode === "in" ? "Welcome back" : "Create your profile";
  const sub =
    mode === "in"
      ? "Sign in to reach your allergens and scan history."
      : "Your allergens and history will be saved to your account.";
  const cta = mode === "in" ? "Sign in" : "Create profile";
  const canSubmit =
    email.trim() && password && (mode === "in" || name.trim());

  return (
    <div className="hero-bg flex min-h-dvh flex-col bg-background">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
        <Link
          href="/welcome"
          aria-label="Back"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-surface-2"
        >
          <ArrowLeft className="h-4.5 w-4.5" />
        </Link>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col pt-7">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent shadow-soft">
            <Leaf className="h-5.5 w-5.5 text-white" strokeWidth={2} />
          </span>
          <h1 className="mt-4.5 text-[1.9rem] font-bold leading-tight tracking-tight">
            {heading}
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">{sub}</p>

          <div className="mt-7 space-y-3.5">
            {mode === "create" && (
              <Field
                label="Your name"
                value={name}
                onChange={setName}
                placeholder="e.g. Mara"
                required
                autoComplete="name"
              />
            )}
            <Field
              label="Email"
              value={email}
              onChange={setEmail}
              type="email"
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
            <Field
              label="Password"
              value={password}
              onChange={setPassword}
              type="password"
              placeholder={mode === "create" ? "6+ characters" : "••••••••"}
              required
              autoComplete={
                mode === "create" ? "new-password" : "current-password"
              }
            />
          </div>

          {error && (
            <p className="mt-3 rounded-2xl bg-danger-soft px-4 py-3 text-[13px] font-medium leading-snug text-danger-ink">
              {error}
            </p>
          )}

          <div className="flex-1" />

          <button
            type="submit"
            disabled={!canSubmit || busy}
            className="mt-6 flex w-full items-center justify-center rounded-full bg-accent py-3.5 text-base font-semibold text-white shadow-soft transition active:scale-[0.99] disabled:opacity-40"
          >
            {busy ? "One moment..." : cta}
          </button>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={busy}
            className="mt-3 flex w-full items-center justify-center gap-2.5 rounded-full border border-border-strong bg-card py-3.5 text-base font-semibold text-foreground transition active:scale-[0.99] disabled:opacity-40"
          >
            <GoogleGlyph />
            Continue with Google
          </button>

          <p className="mt-5 text-center text-[13.5px] text-muted">
            {mode === "in" ? (
              <>
                New here?{" "}
                <Link
                  href="/sign-in?mode=create"
                  className="font-semibold text-accent"
                >
                  Create a profile
                </Link>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <Link
                  href="/sign-in?mode=in"
                  className="font-semibold text-accent"
                >
                  Sign in
                </Link>
              </>
            )}
          </p>
        </form>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-background" />}>
      <SignInForm />
    </Suspense>
  );
}
