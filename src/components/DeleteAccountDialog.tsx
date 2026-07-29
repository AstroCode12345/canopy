"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { deleteAccountDb } from "@/lib/db";
import { useProfile } from "@/lib/useProfile";

/**
 * Confirmation dialog for permanent account deletion.
 *
 * The confirmation is typing your own email address rather than a plain
 * "are you sure". This action cascades away the account, the allergen
 * profile, and every saved scan with no recovery path, so it should take a
 * deliberate act that a mis-tap cannot produce.
 *
 * The failure path matters as much as the success path: if the delete does
 * not go through, this must not sign the user out or navigate away, because
 * either one would look exactly like success and leave someone believing
 * their data is gone when it is not.
 */
export function DeleteAccountDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { supabase, user } = useProfile();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  const email = user?.email ?? "";
  const confirmed =
    email.length > 0 && typed.trim().toLowerCase() === email.toLowerCase();

  const handleDelete = async () => {
    if (!confirmed || busy) return;
    setBusy(true);
    setError("");

    const failure = await deleteAccountDb(supabase);
    if (failure) {
      // Stay exactly where we are. Nothing was deleted.
      setError(failure);
      setBusy(false);
      return;
    }

    // The account row is gone, so the session's user no longer exists. Clear
    // the cookies too, otherwise the app would carry a token pointing at a
    // deleted user until it expired.
    await supabase.auth.signOut();
    router.push("/welcome");
    router.refresh();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-account-title"
    >
      <button
        type="button"
        onClick={() => !busy && onClose()}
        aria-label="Cancel"
        className="absolute inset-0 animate-page-fade cursor-default bg-[#0b0f0d]/60 backdrop-blur-[2px]"
      />

      <div className="relative w-full max-w-md animate-sheet-up rounded-t-3xl border-t border-border bg-card px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5 text-foreground shadow-soft">
        <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-border-strong" />

        <div className="flex items-start justify-between gap-4">
          <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <button
            type="button"
            onClick={() => !busy && onClose()}
            disabled={busy}
            aria-label="Cancel"
            className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted transition-transform active:scale-95 disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <h2
          id="delete-account-title"
          className="mt-3 text-[19px] font-extrabold leading-tight"
        >
          Delete your account
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          This removes your login, your allergen list, and every saved scan.
          It happens right away and it cannot be undone. There is no backup
          copy kept for you.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          If you only want the scans gone, close this and use Clear scan
          history instead.
        </p>

        <label
          htmlFor="confirm-email"
          className="mt-4 block px-1 font-mono text-[11px] uppercase tracking-[0.16em] text-faint"
        >
          Type {email} to confirm
        </label>
        <input
          ref={inputRef}
          id="confirm-email"
          type="email"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={typed}
          onChange={(e) => {
            setTyped(e.target.value);
            if (error) setError("");
          }}
          disabled={busy}
          placeholder={email}
          className="mt-1.5 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-danger/60 disabled:opacity-50"
        />

        {error && (
          <p className="mt-3 rounded-2xl bg-danger-soft px-4 py-3 text-sm leading-relaxed text-danger-ink">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleDelete}
          disabled={!confirmed || busy}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-danger py-3.5 text-base font-semibold text-white shadow-soft transition active:scale-[0.99] disabled:opacity-40"
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Deleting…
            </>
          ) : (
            "Delete my account permanently"
          )}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="mt-1 w-full py-2.5 text-sm text-muted transition-colors hover:text-foreground disabled:opacity-40"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
