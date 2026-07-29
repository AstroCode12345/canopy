"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { Allergen, Severity } from "@/lib/storage";

/**
 * The nine preset allergens. Exported because this list is the app's single
 * source of truth for "what counts as a preset": the printable card keys its
 * translations off these exact labels (src/lib/allergenTranslations.ts), and
 * the quick-allergen sheet offers them as suggestions.
 */
export const COMMON: Array<{ id: string; label: string }> = [
  { id: "peanuts", label: "Peanuts" },
  { id: "tree-nuts", label: "Tree nuts" },
  { id: "dairy", label: "Dairy" },
  { id: "eggs", label: "Eggs" },
  { id: "gluten", label: "Gluten / Wheat" },
  { id: "soy", label: "Soy" },
  { id: "shellfish", label: "Shellfish" },
  { id: "fish", label: "Fish" },
  { id: "sesame", label: "Sesame" },
];

function nextSeverity(
  current: Severity | undefined,
): Severity | undefined {
  if (!current) return "allergy";
  if (current === "allergy") return "intolerance";
  return undefined;
}

interface Props {
  selected: Allergen[];
  onChange: (next: Allergen[]) => void;
}

export function AllergenEditor({ selected, onChange }: Props) {
  const [customInput, setCustomInput] = useState("");

  // Match on LABEL, not id. Allergen ids change: they're slugs when a chip is
  // first tapped, but become database UUIDs once saved and reloaded. Label is
  // the stable identity (the DB enforces one row per user per label), so
  // keying on it keeps chips highlighted no matter where the data came from.
  const norm = (s: string) => s.trim().toLowerCase();
  const findByLabel = (label: string) =>
    selected.find((a) => norm(a.label) === norm(label));

  const cycle = (id: string, label: string) => {
    const existing = findByLabel(label);
    const next = nextSeverity(existing?.severity);
    if (!next) {
      onChange(selected.filter((a) => norm(a.label) !== norm(label)));
    } else if (existing) {
      onChange(
        selected.map((a) =>
          norm(a.label) === norm(label) ? { ...a, severity: next } : a,
        ),
      );
    } else {
      onChange([...selected, { id, label, severity: next }]);
    }
  };

  const addCustom = () => {
    const label = customInput.trim();
    if (!label) return;
    if (findByLabel(label)) {
      setCustomInput("");
      return;
    }
    const id = `custom-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    onChange([...selected, { id, label, severity: "allergy" }]);
    setCustomInput("");
  };

  // A custom allergen is anything the user added that isn't one of the presets,
  // decided by label so it survives the id changing across a save/reload.
  const commonLabels = new Set(COMMON.map((c) => norm(c.label)));
  const customSelections = selected.filter(
    (a) => !commonLabels.has(norm(a.label)),
  );

  return (
    <div className="space-y-6">
      {/* Severity legend: an inline key, using the same pill styling as the
          chips below so the mapping is obvious at a glance. */}
      <div className="flex flex-wrap items-center gap-[7px] text-[11px] font-medium text-muted">
        <span>Tap to cycle:</span>
        <span className="inline-flex items-center rounded-full bg-danger px-2.5 py-[3px] text-[9px] font-bold uppercase tracking-[0.04em] text-white">
          Severe
        </span>
        <span className="text-faint">avoid completely</span>
        <span className="inline-flex items-center rounded-full bg-warning-soft px-2.5 py-[3px] text-[9px] font-bold uppercase tracking-[0.04em] text-warning-ink">
          Mild
        </span>
        <span className="text-faint">be aware</span>
      </div>

      <div>
        <h3 className="mb-[9px] font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-faint">
          Common
        </h3>
        <div className="flex flex-wrap gap-[7px]">
          {COMMON.map((item) => (
            <SeverityChip
              key={item.id}
              label={item.label}
              severity={findByLabel(item.label)?.severity}
              onClick={() => cycle(item.id, item.label)}
            />
          ))}
        </div>
      </div>

      {/* "Add your own" sits ABOVE the added chips on purpose: when someone
          types an allergen and taps +, the new chip must appear directly
          below the input, where they're already looking. With the sections
          the other way around, the chip appeared off-screen above the fold
          on phones and the add looked like it silently did nothing (bug
          report 2026-07-13). */}
      <div>
        <h3 className="mb-[9px] font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-faint">
          Add your own
        </h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustom();
              }
            }}
            placeholder="e.g. mustard"
            className="flex-1 rounded-full border border-border-strong bg-card px-4 py-[11px] text-[13px] font-medium outline-none placeholder:text-faint focus:border-accent/60"
          />
          <button
            type="button"
            onClick={addCustom}
            disabled={!customInput.trim()}
            aria-label="Add custom allergen"
            className="flex w-[42px] shrink-0 items-center justify-center rounded-full bg-accent text-white transition-opacity disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {customSelections.length > 0 && (
          <div className="mt-3">
            <div className="flex flex-wrap gap-[7px]">
              {customSelections.map((item) => (
                <SeverityChip
                  key={item.label}
                  label={item.label}
                  severity={item.severity}
                  onClick={() => cycle(item.id, item.label)}
                />
              ))}
            </div>
            <p className="mt-2 text-[11px] text-faint">
              Tap a chip past Mild to remove it.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function SeverityChip({
  label,
  severity,
  onClick,
}: {
  label: string;
  severity: Severity | undefined;
  onClick: () => void;
}) {
  const base =
    "rounded-full px-3.5 py-2 text-[12.5px] font-semibold transition-all active:scale-95";
  let style: string;
  if (severity === "allergy") {
    style = "bg-danger text-white";
  } else if (severity === "intolerance") {
    style = "bg-warning-soft text-warning-ink border border-warning";
  } else {
    style =
      "bg-card text-foreground border border-border-strong hover:border-accent/40";
  }

  const ariaLabel =
    severity === "allergy"
      ? `${label}, severe. Tap to mark as mild`
      : severity === "intolerance"
        ? `${label}, mild. Tap to remove`
        : `${label}, off. Tap to mark as severe`;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={severity !== undefined}
      className={`${base} ${style}`}
    >
      {label}
    </button>
  );
}
