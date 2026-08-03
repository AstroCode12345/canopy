"use client";

import { CloudOff, RotateCw } from "lucide-react";

/**
 * Shown when a read from the database failed, as opposed to succeeding and
 * coming back empty.
 *
 * Those two cases used to render identically, which was worst on the allergen
 * list: someone with a full profile hit a dropped connection and was told
 * "Pick your allergens first", i.e. the app appeared to have lost their
 * allergies. In an app people rely on to avoid an allergic reaction, "your
 * data is gone" is the single worst thing to say by accident.
 *
 * Retry reloads rather than re-running the fetch: these screens read once on
 * mount, and a reload restores the whole page's state without every caller
 * having to hand in a bespoke refetch callback.
 */
export function LoadError({ what }: { what: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-2">
        <CloudOff className="h-6 w-6 text-muted" strokeWidth={1.75} />
      </div>
      <p className="font-medium text-foreground">Couldn&apos;t load {what}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        Nothing has been lost. Check your connection and try again.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-4 inline-flex items-center gap-2 rounded-full bg-surface-2 px-5 py-2.5 text-sm font-semibold text-foreground ring-1 ring-border transition-colors hover:bg-accent-soft/40 active:scale-95"
      >
        <RotateCw className="h-4 w-4" />
        Try again
      </button>
    </div>
  );
}
