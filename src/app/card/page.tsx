"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Printer, ShieldAlert } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { getAllergensDb } from "@/lib/db";
import type { Allergen } from "@/lib/storage";
import { useProfile } from "@/lib/useProfile";
import {
  CARD_COPY,
  CARD_LANGUAGES,
  isTranslatablePreset,
  translateAllergenLabel,
  type CardLanguage,
} from "@/lib/allergenTranslations";

/** One allergen's text: the real translation for a preset label, or the
 * original English with an EN mark for anything Canopy has no vetted
 * translation for (see allergenTranslations.ts). */
function nameFor(allergen: Allergen, lang: CardLanguage): string {
  if (isTranslatablePreset(allergen.label)) {
    return translateAllergenLabel(allergen.label, lang);
  }
  return lang === "en" ? allergen.label : `${allergen.label} (EN)`;
}

export default function AllergenCardPage() {
  const { supabase, user } = useProfile();
  const [allergens, setAllergens] = useState<Allergen[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [selected, setSelected] = useState<Set<CardLanguage>>(
    () => new Set<CardLanguage>(["en"]),
  );

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

  const toggle = (code: CardLanguage) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });

  // Always render in CARD_LANGUAGES order, never in the order they were
  // tapped, so the same picks always produce the same card.
  const chosen = useMemo(
    () => CARD_LANGUAGES.filter((l) => selected.has(l.code)),
    [selected],
  );

  const severe = allergens.filter((a) => a.severity === "allergy");
  const mild = allergens.filter((a) => a.severity === "intolerance");
  const hasCustom = allergens.some((a) => !isTranslatablePreset(a.label));

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-6 pt-10 pb-2 print:hidden">
        <Link
          href="/profile"
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <h1 className="text-[23px] font-extrabold leading-[1.2]">Allergen card</h1>
        <p className="mt-1 text-sm text-muted">
          Pick every language you might need, then hand this to a waiter, a
          host, or a school nurse.
        </p>
      </header>

      <main className="flex-1 px-6 pt-4 pb-32">
        {!hydrated && (
          <div
            className="h-72 animate-pulse rounded-[20px] border border-border bg-card"
            aria-hidden
          />
        )}

        {hydrated && allergens.length === 0 && (
          <div className="rounded-[20px] border border-border bg-card p-6 text-center shadow-soft">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <p className="font-semibold">No allergens saved yet</p>
            <p className="mt-1 text-sm text-muted">
              Add your allergens first, then come back to build your card.
            </p>
            <Link
              href="/profile"
              className="mt-4 inline-block rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-white"
            >
              Set up allergens
            </Link>
          </div>
        )}

        {hydrated && allergens.length > 0 && (
          <div className="space-y-5">
            {/* Picker (app chrome, never printed) */}
            <div className="print:hidden">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
                  Languages · {chosen.length}
                </h2>
                <div className="flex gap-3 text-[13px]">
                  <button
                    type="button"
                    onClick={() =>
                      setSelected(new Set(CARD_LANGUAGES.map((l) => l.code)))
                    }
                    className="font-medium text-accent"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelected(new Set<CardLanguage>(["en"]))}
                    className="font-medium text-muted transition-colors hover:text-foreground"
                  >
                    Reset
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {/* English names here, native names on the card: whoever is
                    picking does not read these languages, and whoever reads
                    the card does. */}
                {CARD_LANGUAGES.map(({ code, nativeName, englishName }) => {
                  const on = selected.has(code);
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => toggle(code)}
                      aria-pressed={on}
                      title={nativeName}
                      className={`rounded-full px-3.5 py-2 text-sm font-medium transition-all active:scale-95 ${
                        on
                          ? "bg-accent text-white"
                          : "bg-card text-foreground ring-1 ring-border hover:ring-accent/40"
                      }`}
                    >
                      {englishName}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* The card itself. Deliberately plain: black on white, no
                colour fills, hierarchy carried by weight and size. Most
                people print on a grayscale printer, where white text on a
                red chip turns into low-contrast mush, and this is a document
                someone has to read across a counter in bad light. */}
            <div
              id="allergen-card-print"
              className="rounded-[20px] border border-border bg-white p-6 text-[#111] shadow-soft"
            >
              <div className="flex items-baseline justify-between gap-3 border-b border-[#111]/15 pb-3">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em]">
                  Allergen card
                </p>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#111]/45">
                  Canopy
                </p>
              </div>

              {chosen.length === 0 && (
                <p className="py-6 text-center text-sm text-[#111]/50">
                  Pick at least one language above.
                </p>
              )}

              {chosen.map(({ code, nativeName, rtl }) => {
                const copy = CARD_COPY[code];
                return (
                  <section
                    key={code}
                    dir={rtl ? "rtl" : undefined}
                    lang={code}
                    className={`card-lang-block border-b border-[#111]/10 py-4 last:border-b-0 last:pb-0 ${
                      rtl ? "text-right" : ""
                    }`}
                  >
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#111]/45">
                      {nativeName}
                    </p>

                    {severe.length > 0 && (
                      <>
                        <p className="mt-1.5 text-[13px] leading-snug">
                          {copy.severeLead}
                        </p>
                        <p className="mt-1 text-[19px] font-bold leading-tight">
                          {severe.map((a) => nameFor(a, code)).join(" · ")}
                        </p>
                      </>
                    )}

                    {mild.length > 0 && (
                      <>
                        <p className="mt-2.5 text-[13px] leading-snug text-[#111]/70">
                          {copy.mildLead}
                        </p>
                        <p className="mt-0.5 text-[15px] font-semibold leading-tight text-[#111]/80">
                          {mild.map((a) => nameFor(a, code)).join(" · ")}
                        </p>
                      </>
                    )}

                    {hasCustom && code !== "en" && (
                      <p className="mt-2 text-[11px] text-[#111]/45">
                        {copy.customNote}
                      </p>
                    )}
                  </section>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => window.print()}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-accent py-3.5 text-base font-semibold text-white shadow-soft transition active:scale-[0.99] print:hidden"
            >
              <Printer className="h-4 w-4" />
              Print or save as PDF
            </button>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
