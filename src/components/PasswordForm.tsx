"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// Supabase rejects anything shorter than 6 by default. Checking here too so
// the person finds out while typing rather than after a round trip.
const MIN_LENGTH = 8;

/**
 * Sets a new password on the CURRENT session, shared by two flows that do
 * exactly the same thing once you have a session:
 *
 *   /change-password  a signed-in user choosing a new password
 *   /reset-password   someone who arrived from a recovery email, where the
 *                     link already exchanged itself for a real session via
 *                     the auth callback
 *
 * Because both end in supabase.auth.updateUser({ password }), the only
 * difference worth encoding is the wording and where you land afterwards.
 */
export function PasswordForm({
  submitLabel,
  doneMessage,
  nextHref,
}: {
  submitLabel: string;
  doneMessage: string;
  nextHref: string;
}) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const tooShort = password.length > 0 && password.length < MIN_LENGTH;
  const mismatch = confirm.length > 0 && password !== confirm;
  const ready = password.length >= MIN_LENGTH && password === confirm && !busy;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError("");

    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      // The common real-world cause here is an expired or already-used
      // recovery link, which leaves no session to update.
      setError(
        updateError.message ||
          "Couldn't set that password. Your link may have expired.",
      );
      setBusy(false);
      return;
    }

    setDone(true);
    setBusy(false);
    router.refresh();
  };

  if (done) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
          <Check className="h-6 w-6" />
        </div>
        <p className="font-semibold">{doneMessage}</p>
        <button
          type="button"
          onClick={() => router.push(nextHref)}
          className="mt-4 inline-flex items-center rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-white"
        >
          Continue
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label
          htmlFor="new-password"
          className="px-1 font-mono text-[11px] uppercase tracking-[0.16em] text-faint"
        >
          New password
        </label>
        <input
          id="new-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={busy}
          className="mt-1.5 w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-accent/60 disabled:opacity-50"
        />
        <p className="mt-1.5 px-1 text-[12px] text-faint">
          {tooShort
            ? `At least ${MIN_LENGTH} characters.`
            : `${MIN_LENGTH} characters or more.`}
        </p>
      </div>

      <div>
        <label
          htmlFor="confirm-password"
          className="px-1 font-mono text-[11px] uppercase tracking-[0.16em] text-faint"
        >
          Confirm password
        </label>
        <input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          disabled={busy}
          className="mt-1.5 w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-accent/60 disabled:opacity-50"
        />
        {mismatch && (
          <p className="mt-1.5 px-1 text-[12px] text-danger">
            These don&apos;t match yet.
          </p>
        )}
      </div>

      {error && (
        <p className="rounded-2xl bg-danger-soft px-4 py-3 text-sm leading-relaxed text-danger-ink">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!ready}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-accent py-3.5 text-base font-semibold text-white shadow-soft transition active:scale-[0.99] disabled:opacity-40"
      >
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving…
          </>
        ) : (
          submitLabel
        )}
      </button>
    </form>
  );
}
