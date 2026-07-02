"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { Allergen, Severity } from "@/lib/storage";

const COMMON: Array<{ id: string; label: string }> = [
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

  const find = (id: string) => selected.find((a) => a.id === id);

  const cycle = (id: string, label: string) => {
    const existing = find(id);
    const next = nextSeverity(existing?.severity);
    if (!next) {
      onChange(selected.filter((a) => a.id !== id));
    } else if (existing) {
      onChange(
        selected.map((a) => (a.id === id ? { ...a, severity: next } : a)),
      );
    } else {
      onChange([...selected, { id, label, severity: next }]);
    }
  };

  const addCustom = () => {
    const label = customInput.trim();
    if (!label) return;
    const id = `custom-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    if (selected.some((a) => a.id === id)) {
      setCustomInput("");
      return;
    }
    onChange([...selected, { id, label, severity: "allergy" }]);
    setCustomInput("");
  };

  const customSelections = selected.filter((a) => a.id.startsWith("custom-"));

  return (
    <div className="space-y-6">
      {/* Severity legend */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-xs leading-relaxed text-muted">
          Tap a chip to cycle through severity:
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
          <span className="rounded-full bg-danger px-2.5 py-1 font-semibold uppercase tracking-wider text-white">
            Severe
          </span>
          <span className="text-muted">avoid completely</span>
          <span className="text-muted">·</span>
          <span className="rounded-full bg-warning-soft px-2.5 py-1 font-semibold uppercase tracking-wider text-warning ring-1 ring-warning/30">
            Mild
          </span>
          <span className="text-muted">be aware</span>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
          Common
        </h3>
        <div className="flex flex-wrap gap-2">
          {COMMON.map((item) => (
            <SeverityChip
              key={item.id}
              label={item.label}
              severity={find(item.id)?.severity}
              onClick={() => cycle(item.id, item.label)}
            />
          ))}
        </div>
      </div>

      {customSelections.length > 0 && (
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
            Your additions
          </h3>
          <div className="flex flex-wrap gap-2">
            {customSelections.map((item) => (
              <SeverityChip
                key={item.id}
                label={item.label}
                severity={item.severity}
                onClick={() => cycle(item.id, item.label)}
              />
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted">
            Tap past Mild to remove a custom allergen.
          </p>
        </div>
      )}

      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
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
            className="flex-1 rounded-full border border-border bg-background px-4 py-2 text-sm outline-none focus:border-accent/60"
          />
          <button
            type="button"
            onClick={addCustom}
            disabled={!customInput.trim()}
            aria-label="Add custom allergen"
            className="rounded-full bg-accent px-4 py-2 text-white transition-opacity disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
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
    "rounded-full px-4 py-2 text-sm font-medium transition-all active:scale-95";
  let style: string;
  if (severity === "allergy") {
    style = "bg-danger text-white shadow-sm shadow-danger/30";
  } else if (severity === "intolerance") {
    style =
      "bg-warning-soft text-warning ring-1 ring-warning/30 shadow-sm shadow-warning/15";
  } else {
    style =
      "bg-card text-foreground ring-1 ring-border hover:ring-accent/40 hover:bg-accent-soft/40";
  }

  const ariaLabel =
    severity === "allergy"
      ? `${label}, severe — tap to mark as mild`
      : severity === "intolerance"
        ? `${label}, mild — tap to remove`
        : `${label}, off — tap to mark as severe`;

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
