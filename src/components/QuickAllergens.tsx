"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { COMMON } from "@/components/AllergenEditor";
import type { Allergen } from "@/lib/storage";

// Same label-based identity rule the profile editor uses: ids churn (slug
// before save, UUID after), labels don't.
const norm = (s: string) => s.trim().toLowerCase();

/**
 * Quick allergens: one-off additions made at scan time.
 *
 * They ride along with the profile list for THIS scan and get frozen into
 * the scan's history snapshot (allergensAtTime), so the record honestly
 * reflects what was actually checked. What they never do is reach the
 * allergens table — the saved profile is untouched, which is the whole
 * point. State lives in the scan page, so leaving the page drops them.
 *
 * Severity is always "allergy" (severe). Someone reaching for this is
 * checking for a specific thing they're worried about right now, and the
 * cautious tier is the safe default when we can't ask.
 */
export const QUICK_SEVERITY = "allergy" as const;

export function makeQuickAllergen(label: string): Allergen {
  return {
    id: `quick-${norm(label).replace(/[^a-z0-9]+/g, "-")}`,
    label: label.trim(),
    severity: QUICK_SEVERITY,
  };
}

/**
 * The row of "also checking for X" chips. Rendered in two places with
 * different backdrops: over the live camera (dark glass) and on the label
 * preview screen (light card), hence the tone switch.
 */
export function QuickAllergenChips({
  quick,
  onRemove,
  onOpen,
  tone,
}: {
  quick: Allergen[];
  onRemove: (label: string) => void;
  onOpen: () => void;
  tone: "dark" | "light";
}) {
  const dark = tone === "dark";

  return (
    <div
      className={`flex flex-wrap items-center gap-2 ${
        dark ? "justify-center" : "justify-start"
      }`}
    >
      {quick.map((a) => (
        <span
          key={a.label}
          className="inline-flex items-center gap-1.5 rounded-full bg-danger py-1.5 pl-3.5 pr-1.5 text-xs font-semibold text-white shadow-sm shadow-danger/30"
        >
          {a.label}
          <button
            type="button"
            onClick={() => onRemove(a.label)}
            aria-label={`Stop checking for ${a.label}`}
            className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 transition-transform active:scale-90"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={onOpen}
        className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all active:scale-95 ${
          dark
            ? "bg-white/[0.12] text-white backdrop-blur hover:bg-white/20"
            : "bg-surface-2 text-muted ring-1 ring-border hover:text-foreground hover:ring-accent/40"
        }`}
      >
        <Plus className="h-3.5 w-3.5" />
        {quick.length > 0 ? "Add another" : "Also check for…"}
      </button>
    </div>
  );
}

/**
 * Bottom sheet for adding a one-off allergen. Light card over a dimmed
 * backdrop, so it reads as a native sheet whether it opens over the dark
 * camera or the light preview screen.
 */
export function QuickAllergenSheet({
  quick,
  profile,
  onAdd,
  onRemove,
  onClose,
}: {
  quick: Allergen[];
  profile: Allergen[];
  onAdd: (label: string) => void;
  onRemove: (label: string) => void;
  onClose: () => void;
}) {
  const [input, setInput] = useState("");
  const [note, setNote] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const inProfile = (label: string) =>
    profile.some((a) => norm(a.label) === norm(label));
  const inQuick = (label: string) =>
    quick.some((a) => norm(a.label) === norm(label));

  const submit = (raw: string) => {
    const label = raw.trim();
    if (!label) return;
    // Never fail silently here. An add that looks like it did nothing is the
    // exact bug that got reported against the profile editor (2026-07-13).
    if (inProfile(label)) {
      setNote(`${label} is already on your profile, so every scan checks it.`);
      setInput("");
      return;
    }
    if (inQuick(label)) {
      setNote(`Already checking for ${label} on this scan.`);
      setInput("");
      return;
    }
    onAdd(label);
    setNote("");
    setInput("");
    inputRef.current?.focus();
  };

  const taken = (label: string) => inProfile(label) || inQuick(label);
  const suggestions = COMMON.filter((c) => !taken(c.label));

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-allergen-title"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute inset-0 animate-page-fade cursor-default bg-[#0b0f0d]/60 backdrop-blur-[2px]"
      />

      {/* text-foreground is load-bearing, not decoration: over the camera this
          sheet renders inside a text-white container, so anything without an
          explicit color (the heading, the input's typed text) inherits white
          and vanishes against the card. */}
      <div className="relative w-full max-w-md animate-sheet-up rounded-t-3xl border-t border-border bg-card px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5 text-foreground shadow-soft">
        {/* Grab handle: the affordance that says "this sheet dismisses". */}
        <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-border-strong" />

        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
              Just this scan
            </p>
            <h2
              id="quick-allergen-title"
              className="mt-1 text-xl font-bold tracking-tight"
            >
              Check for something else
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted transition-transform active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-2 text-sm leading-relaxed text-muted">
          Canopy will watch for this on the next scan and treat it as severe.
          Your saved profile stays exactly as it is.
        </p>

        <div className="mt-4 flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (note) setNote("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit(input);
              }
            }}
            placeholder="e.g. mustard"
            aria-label="Allergen to check on this scan"
            className="flex-1 rounded-full border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-accent/60"
          />
          <button
            type="button"
            onClick={() => submit(input)}
            disabled={!input.trim()}
            aria-label="Add to this scan"
            className="rounded-full bg-accent px-4 py-2.5 text-white transition-opacity active:scale-95 disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {note && <p className="mt-2 px-1 text-xs text-muted">{note}</p>}

        {quick.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
              On this scan
            </h3>
            <div className="flex flex-wrap gap-2">
              {quick.map((a) => (
                <span
                  key={a.label}
                  className="inline-flex items-center gap-1.5 rounded-full bg-danger py-1.5 pl-3.5 pr-1.5 text-sm font-medium text-white"
                >
                  {a.label}
                  <button
                    type="button"
                    onClick={() => onRemove(a.label)}
                    aria-label={`Remove ${a.label}`}
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 transition-transform active:scale-90"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {suggestions.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
              Common ones
            </h3>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => submit(c.label)}
                  className="rounded-full bg-card px-3.5 py-1.5 text-sm font-medium text-foreground ring-1 ring-border transition-all hover:bg-accent-soft/40 hover:ring-accent/40 active:scale-95"
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-full bg-accent py-3 text-base font-semibold text-white shadow-soft transition active:scale-[0.99]"
        >
          Done
        </button>
      </div>
    </div>
  );
}
