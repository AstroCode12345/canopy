"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { AllergenEditor } from "@/components/AllergenEditor";
import { saveAllergens, type Allergen } from "@/lib/storage";

interface Props {
  initial?: Allergen[];
  onClose: () => void;
  onSave: (list: Allergen[]) => void;
}

export function AllergenSetup({ initial = [], onClose, onSave }: Props) {
  const [selected, setSelected] = useState<Allergen[]>(initial);

  const handleSave = () => {
    saveAllergens(selected);
    onSave(selected);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="allergen-setup-title"
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/45 backdrop-blur-sm md:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[92dvh] w-full max-w-md flex-col rounded-t-3xl bg-card shadow-2xl md:rounded-3xl">
        <div className="flex items-start justify-between px-6 pt-6 pb-2">
          <div>
            <h2
              id="allergen-setup-title"
              className="text-xl font-semibold tracking-tight"
            >
              Your allergens
            </h2>
            <p className="mt-1 text-sm text-muted">
              Pick what Canopy should flag in your scans.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 -mt-2 rounded-full p-2 text-muted transition-colors hover:bg-accent-soft hover:text-accent"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <AllergenEditor selected={selected} onChange={setSelected} />
        </div>

        <div className="border-t border-border px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={handleSave}
            disabled={selected.length === 0}
            className="w-full rounded-full bg-accent py-3 text-base font-semibold text-white shadow-soft transition-opacity disabled:opacity-40"
          >
            Save{selected.length > 0 ? ` (${selected.length})` : ""}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="mt-2 w-full py-1 text-center text-sm text-muted hover:text-foreground"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
