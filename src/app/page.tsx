"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Camera,
  ChevronRight,
  ImageOff,
  Leaf,
  ShieldCheck,
} from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { EmptyState } from "@/components/EmptyState";
import { OnboardingTour } from "@/components/OnboardingTour";
import { getAllergensDb, getScansDb } from "@/lib/db";
import {
  hasSeenOnboarding,
  markOnboardingSeen,
  resultVerdict,
  type Allergen,
  type Scan,
} from "@/lib/storage";
import { useProfile } from "@/lib/useProfile";

// Status colour now drives a 3px left border on the row plus the bare outline
// icon, rather than a tinted circular icon badge (2a refresh).
function recentVisuals(scan: Scan) {
  const sev = resultVerdict(scan.result);
  if (sev === "unreadable") {
    return {
      edge: "border-l-border-strong",
      Icon: ImageOff,
      iconColor: "text-muted",
      summary: "Couldn't read the label. Scan it again",
      fallbackTitle: "Unreadable scan",
    };
  }
  if (sev === "allergy") {
    return {
      edge: "border-l-danger",
      Icon: AlertTriangle,
      iconColor: "text-danger",
      summary:
        scan.result.flaggedAllergies.length > 0
          ? `Avoid: ${scan.result.flaggedAllergies.join(", ")}`
          : "Flagged",
      fallbackTitle: "Flagged scan",
    };
  }
  if (sev === "intolerance") {
    return {
      edge: "border-l-warning",
      Icon: AlertCircle,
      iconColor: "text-warning",
      summary: `Be aware: ${scan.result.flaggedIntolerances.join(", ")}`,
      fallbackTitle: "Mild flag",
    };
  }
  return {
    edge: "border-l-accent",
    Icon: ShieldCheck,
    iconColor: "text-accent",
    summary: "No allergens detected",
    fallbackTitle: "Safe scan",
  };
}

export default function HomePage() {
  // Real account profile from Supabase (name lives in the profiles table now).
  const { supabase, user, profile } = useProfile();
  const [recent, setRecent] = useState<Scan[]>([]);
  const [allergens, setAllergens] = useState<Allergen[]>([]);
  const [stats, setStats] = useState({ scanned: 0, flagged: 0 });
  const [meta, setMeta] = useState({ greet: "", date: "" });
  const [hydrated, setHydrated] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const now = new Date();
    const h = now.getHours();
    setMeta({
      greet:
        h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening",
      date: now.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
    });
  }, []);

  useEffect(() => {
    if (!user) return; // wait for auth to resolve before fetching
    let cancelled = false;

    Promise.all([getScansDb(supabase), getAllergensDb(supabase)]).then(
      ([scans, list]) => {
        if (cancelled) return;
        setRecent(scans.slice(0, 3));
        setAllergens(list);
        setStats({
          scanned: scans.length,
          flagged: scans.filter((s) => {
            const v = resultVerdict(s.result);
            return v === "allergy" || v === "intolerance";
          }).length,
        });

        // Show onboarding only on truly first-ever visit (no flag + no data)
        if (!hasSeenOnboarding() && list.length === 0 && scans.length === 0) {
          setShowOnboarding(true);
        }
        setHydrated(true);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [supabase, user]);

  const dismissOnboarding = () => {
    markOnboardingSeen();
    setShowOnboarding(false);
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto w-full max-w-md px-5 pt-12">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.1em] text-faint">
              {meta.date || " "}
            </p>
            <h1 className="mt-2 text-[27px] font-extrabold leading-[1.15]">
              {meta.greet || "Welcome"}
              {profile?.display_name
                ? `, ${profile.display_name.trim().split(/\s+/)[0]}`
                : ""}
            </h1>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft py-[7px] pl-2 pr-3">
            <Leaf className="h-[13px] w-[13px] text-accent-ink" strokeWidth={2.2} />
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-accent-ink">
              Canopy
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 space-y-[18px] px-5 pb-28 pt-5">
        {/* Primary scan CTA */}
        <Link
          href="/scan"
          className="group flex items-center gap-[13px] rounded-[20px] bg-accent p-[17px] text-white shadow-cta transition-transform active:scale-[0.99]"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/[0.18]">
            <Camera className="h-[21px] w-[21px]" strokeWidth={1.8} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-[15.5px] font-bold leading-tight">
              Scan a label
            </span>
            <span className="mt-0.5 block text-xs font-medium text-white/[0.82]">
              Point at the ingredients panel
            </span>
          </span>
          <ChevronRight className="h-[15px] w-[15px] shrink-0 text-white/75 transition-transform group-hover:translate-x-0.5" />
        </Link>

        {/* Stats. The first cell sits on an inset surface-2 tile. */}
        <section className="flex rounded-[18px] border border-border bg-card p-1">
          <div className="m-0.5 flex flex-1 flex-col items-center gap-0.5 rounded-[14px] bg-surface-2 px-2 py-[13px]">
            <span className="font-mono text-xl font-semibold tabular-nums">
              {hydrated ? stats.scanned : "—"}
            </span>
            <span className="text-[9px] font-semibold uppercase tracking-[0.06em] text-faint">
              Scanned
            </span>
          </div>
          <div className="m-0.5 flex flex-1 flex-col items-center gap-0.5 px-2 py-[13px]">
            <span className="font-mono text-xl font-semibold tabular-nums text-danger">
              {hydrated ? stats.flagged : "—"}
            </span>
            <span className="text-[9px] font-semibold uppercase tracking-[0.06em] text-faint">
              Flagged
            </span>
          </div>
          <div className="m-0.5 flex flex-1 flex-col items-center gap-0.5 px-2 py-[13px]">
            <span className="font-mono text-xl font-semibold tabular-nums text-accent-ink">
              {hydrated ? allergens.length : "—"}
            </span>
            <span className="text-[9px] font-semibold uppercase tracking-[0.06em] text-faint">
              Watching
            </span>
          </div>
        </section>

        {/* Watching for */}
        <section>
          <div className="mb-[9px] flex items-center justify-between">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-faint">
              Watching for
              {hydrated && allergens.length > 0 ? ` · ${allergens.length}` : ""}
            </p>
            <Link
              href="/profile"
              className="text-[11.5px] font-bold text-accent-ink hover:underline"
            >
              Manage
            </Link>
          </div>

          {!hydrated && (
            <div className="flex gap-2" aria-hidden>
              <span className="h-8 w-20 animate-pulse rounded-full bg-surface-2" />
              <span className="h-8 w-16 animate-pulse rounded-full bg-surface-2" />
              <span className="h-8 w-24 animate-pulse rounded-full bg-surface-2" />
            </div>
          )}

          {hydrated && allergens.length === 0 && (
            <Link
              href="/profile"
              className="flex items-center justify-between rounded-[14px] bg-accent-soft px-4 py-3 text-sm font-bold text-accent-ink"
            >
              Set up your allergens
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}

          {hydrated && allergens.length > 0 && (
            <div className="flex flex-wrap gap-[7px]">
              {allergens.slice(0, 6).map((a) => (
                <span
                  key={a.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-card px-3 py-[7px] text-xs font-semibold"
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      a.severity === "allergy" ? "bg-danger" : "bg-warning"
                    }`}
                  />
                  {a.label}
                </span>
              ))}
              {allergens.length > 6 && (
                <span className="inline-flex items-center rounded-full border border-border-strong bg-card px-3 py-[7px] text-xs font-semibold text-faint">
                  +{allergens.length - 6}
                </span>
              )}
            </div>
          )}
        </section>

        {/* Recent scans */}
        <section>
          <div className="mb-[9px] flex items-center justify-between">
            <h2 className="font-display text-[13px] font-bold">Recent scans</h2>
            {recent.length > 0 && (
              <Link
                href="/history"
                className="text-[11.5px] font-bold text-accent-ink hover:underline"
              >
                See all
              </Link>
            )}
          </div>

          {!hydrated && (
            <ul className="space-y-2" aria-hidden>
              <li className="h-[60px] animate-pulse rounded-[16px] border border-border bg-card" />
              <li className="h-[60px] animate-pulse rounded-[16px] border border-border bg-card/60" />
            </ul>
          )}

          {hydrated && recent.length === 0 && <EmptyState />}

          {hydrated && recent.length > 0 && (
            <ul className="space-y-2">
              {recent.map((scan) => {
                const v = recentVisuals(scan);
                const Icon = v.Icon;
                return (
                  <li key={scan.id}>
                    <Link
                      href="/history"
                      className={`flex items-center gap-[11px] rounded-[16px] border border-l-[3px] border-border bg-card px-[13px] py-[11px] transition-colors hover:border-accent/40 ${v.edge}`}
                    >
                      <Icon
                        className={`h-4 w-4 shrink-0 ${v.iconColor}`}
                        strokeWidth={1.8}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-semibold">
                          {scan.foodName || v.fallbackTitle}
                        </p>
                        <p className="truncate text-[11.5px] text-muted">
                          {v.summary}
                        </p>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-faint" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="pt-0.5 text-center">
          <Link
            href="/disclaimer"
            className="text-[11.5px] font-semibold text-faint underline underline-offset-2 hover:text-foreground"
          >
            About Canopy &amp; safety
          </Link>
        </div>
      </main>

      <BottomNav />

      {showOnboarding && <OnboardingTour onDone={dismissOnboarding} />}
    </div>
  );
}
