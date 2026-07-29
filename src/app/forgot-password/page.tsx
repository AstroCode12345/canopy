"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [supabase] = useState(() => createClient());
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || busy) return;
    setBusy(true);

    // The recovery link goes through the same callback every other
    // redirect flow uses, which trades the one-time code for a session and
    // then forwards to the page that sets the new password.
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${location.origin}/auth/callback?next=/reset-password`,
    });

    // Deliberately not branching on the result. Supabase returns the same
    // shape whether or not an account exists, and surfacing a difference
    // would turn this form into a way to test which email addresses are
    // registered. The confirmation below says "if there's an account" for
    // the same reason.
    setBusy(false);
    setSent(true);
  };

  if (sent) {
    return (
      <div className="hero-bg flex min-h-dvh flex-col bg-background">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent">
            <MailCheck className="h-7 w-7" strokeWidth={1.75} />
          </span>
          <h1 className="mt-5 text-[1.6rem] font-bold tracking-tight">
            Check your email
          </h1>
          <p className="mt-2.5 max-w-[320px] text-[15px] leading-relaxed text-muted">
            If there&apos;s a Canopy account for{" "}
            <span className="font-semibold text-foreground">
              {email.trim()}
            </span>
            , a reset link is on its way. It expires after a while, so use it
            soon.
          </p>
          <Link
            href="/sign-in?mode=in"
            className="mt-7 flex items-center justify-center rounded-full bg-accent px-8 py-3 text-base font-semibold text-white shadow-soft"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="hero-bg flex min-h-dvh flex-col bg-background">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
        <Link
          href="/sign-in?mode=in"
          className="inline-flex w-fit items-center gap-1 py-2 text-sm text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Sign in
        </Link>

        <form onSubmit={submit} className="flex flex-1 flex-col pt-8">
          <h1 className="text-[1.7rem] font-bold tracking-tight">
            Reset your password
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            Enter the email you signed up with and we&apos;ll send a link to
            set a new password.
          </p>

          <label
            htmlFor="reset-email"
            className="mt-7 px-1 font-mono text-[11px] uppercase tracking-[0.16em] text-faint"
          >
            Email
          </label>
          <input
            id="reset-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
            placeholder="you@example.com"
            className="mt-1.5 w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-accent/60 disabled:opacity-50"
          />

          <div className="flex-1" />

          <button
            type="submit"
            disabled={!email.trim() || busy}
            className="mt-6 flex w-full items-center justify-center rounded-full bg-accent py-3.5 text-base font-semibold text-white shadow-soft transition active:scale-[0.99] disabled:opacity-40"
          >
            {busy ? "Sending..." : "Send reset link"}
          </button>
        </form>
      </div>
    </div>
  );
}
