"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { AllergenEditor } from "@/components/AllergenEditor";
import { getAllergens, saveAllergens, type Allergen } from "@/lib/storage";

export default function ProfilePage() {
  const [allergens, setAllergens] = useState<Allergen[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    setAllergens(getAllergens());
    setHydrated(true);
  }, []);

  const handleSave = () => {
    saveAllergens(allergens);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-6 pt-10 pb-2">
        <h1 className="text-2xl font-semibold tracking-tight">Your profile</h1>
        <p className="mt-1 text-sm text-muted">
          The allergens Canopy watches for in every scan.
        </p>
      </header>

      <main className="flex-1 px-6 pt-4 pb-44">
        {hydrated && (
          <AllergenEditor selected={allergens} onChange={setAllergens} />
        )}
      </main>

      {/* Sticky save bar — sits above the BottomNav */}
      <div
        className="fixed inset-x-0 z-10 px-6 pb-3 pt-6 bg-gradient-to-t from-background via-background to-transparent"
        style={{ bottom: "calc(64px + env(safe-area-inset-bottom))" }}
      >
        <button
          type="button"
          onClick={handleSave}
          disabled={!hydrated}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-accent py-3 text-base font-semibold text-white shadow-soft transition-opacity disabled:opacity-40"
        >
          {savedFlash ? (
            <>
              <Check className="h-5 w-5" />
              Saved
            </>
          ) : (
            `Save${allergens.length > 0 ? ` (${allergens.length})` : ""}`
          )}
        </button>
      </div>

      <BottomNav />
    </div>
  );
}
