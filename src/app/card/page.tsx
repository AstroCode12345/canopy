"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Leaf, Printer, ShieldAlert } from "lucide-react";
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

/** Renders one allergen's chip text: the real translation for a preset
 * label, or the original English with an EN mark for anything Canopy
 * doesn't have a vetted translation for (see allergenTranslations.ts). */
function chipText(allergen: Allergen, lang: CardLanguage): string {
  if (isTranslatablePreset(allergen.label)) {
    return translateAllergenLabel(allergen.label, lang);
  }
  return lang === "en" ? allergen.label : `${allergen.label} (EN)`;
}

export default function AllergenCardPage() {
  const { supabase, user } = useProfile();
  const [allergens, setAllergens] = useState<Allergen[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [lang, setLang] = useState<CardLanguage>("en");

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

  const copy = CARD_COPY[lang];
  const severe = allergens.filter((a) => a.severity === "allergy");
  const mild = allergens.filter((a) => a.severity === "intolerance");
  const hasCustom = allergens.some((a) => !isTranslatablePreset(a.label));

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-6 pt-10 pb-2">
        <Link
          href="/profile"
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          Allergen card
        </h1>
        <p className="mt-1 text-sm text-muted">
          Hand this to a waiter, a host, or a school nurse.
        </p>
      </header>

      <main className="flex-1 px-6 pt-4 pb-32">
        {!hydrated && (
          <div
            className="h-72 animate-pulse rounded-3xl border border-border bg-card"
            aria-hidden
          />
        )}

        {hydrated && allergens.length === 0 && (
          <div className="rounded-3xl border border-border bg-card p-6 text-center shadow-soft">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
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
            <div>
              <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
                Language
              </h2>
              <div className="flex flex-wrap gap-2">
                {CARD_LANGUAGES.map(({ code, nativeName }) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setLang(code)}
                    aria-pressed={lang === code}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                      lang === code
                        ? "bg-accent text-white"
                        : "bg-card text-foreground ring-1 ring-border hover:ring-accent/40"
                    }`}
                  >
                    {nativeName}
                  </button>
                ))}
              </div>
            </div>

            {/* This element and everything inside it is the only thing
                that survives the print stylesheet (globals.css). */}
            <div
              id="allergen-card-print"
              className="rounded-3xl border border-border bg-card p-7 shadow-soft"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-2xl font-bold tracking-tight">
                    {copy.title}
                  </h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">
                    {copy.intro}
                  </p>
                </div>
                <span className="mt-1 inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1.5">
                  <Leaf className="h-3 w-3 text-accent" strokeWidth={2.25} />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-accent">
                    Canopy
                  </span>
                </span>
              </div>

              {severe.length > 0 && (
                <section className="mt-6">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-danger">
                    {copy.severeHeading}
                  </h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {severe.map((a) => (
                      <span
                        key={a.id}
                        className="rounded-full bg-danger px-4 py-2 text-base font-semibold text-white"
                      >
                        {chipText(a, lang)}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {mild.length > 0 && (
                <section className="mt-5">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-warning">
                    {copy.mildHeading}
                  </h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {mild.map((a) => (
                      <span
                        key={a.id}
                        className="rounded-full bg-warning-soft px-4 py-2 text-base font-semibold text-warning-ink ring-1 ring-warning/30"
                      >
                        {chipText(a, lang)}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {hasCustom && lang !== "en" && (
                <p className="mt-5 text-xs text-faint">{copy.customLegend}</p>
              )}

              <p className="mt-7 border-t border-border pt-4 text-center text-xs text-muted">
                {copy.disclaimer}
              </p>
            </div>

            <button
              type="button"
              onClick={() => window.print()}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-accent py-3.5 text-base font-semibold text-white shadow-soft transition active:scale-[0.99]"
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
