"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { AllergenEditor } from "@/components/AllergenEditor";
import { getAllergensDb, replaceAllergensDb } from "@/lib/db";
import { type Allergen } from "@/lib/storage";
import { useProfile } from "@/lib/useProfile";

export default function ProfilePage() {
  // Real account (middleware guarantees someone is signed in here).
  const { supabase, user, profile } = useProfile();
  const [allergens, setAllergens] = useState<Allergen[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    if (!user) return; // wait for auth to resolve before fetching
    let cancelled = false;
    getAllergensDb(supabase).then((list) => {
      if (cancelled) return;
      setAllergens(list);
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [supabase, user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const ok = await replaceAllergensDb(supabase, user.id, allergens);
    // No refetch needed: the editor keys chips on label, not id, so what's
    // on screen already reflects the saved state. Saving stores label +
    // severity, which is exactly what's shown.
    if (ok) {
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    }
    setSaving(false);
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
        {user && (
          <div className="mb-6 flex items-center gap-3.5 rounded-3xl border border-border bg-card p-4 shadow-soft">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-lg font-bold text-white">
              {(profile?.display_name ?? user.email ?? "?")
                .trim()
                .charAt(0)
                .toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold">
                {profile?.display_name ?? "Your account"}
              </p>
              <p className="truncate text-[13px] text-muted">{user.email}</p>
            </div>
          </div>
        )}

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
          disabled={!hydrated || saving}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-accent py-3 text-base font-semibold text-white shadow-soft transition-opacity disabled:opacity-40"
        >
          {savedFlash ? (
            <>
              <Check className="h-5 w-5" />
              Saved
            </>
          ) : saving ? (
            "Saving..."
          ) : (
            `Save${allergens.length > 0 ? ` (${allergens.length})` : ""}`
          )}
        </button>
      </div>

      <BottomNav />
    </div>
  );
}
