"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Camera,
  ChevronRight,
  Leaf,
  ShieldCheck,
} from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { EmptyState } from "@/components/EmptyState";
import { OnboardingTour } from "@/components/OnboardingTour";
import {
  getAllergens,
  getScans,
  hasSeenOnboarding,
  markOnboardingSeen,
  resultSeverity,
  type Allergen,
  type Scan,
} from "@/lib/storage";

function recentVisuals(scan: Scan) {
  const sev = resultSeverity(scan.result);
  if (sev === "allergy") {
    return {
      iconBg: "bg-danger-soft",
      Icon: AlertTriangle,
      iconColor: "text-danger",
      summary:
        scan.result.flaggedAllergies.length > 0
          ? `Avoid — ${scan.result.flaggedAllergies.join(", ")}`
          : "Flagged",
      fallbackTitle: "Flagged scan",
    };
  }
  if (sev === "intolerance") {
    return {
      iconBg: "bg-warning-soft",
      Icon: AlertCircle,
      iconColor: "text-warning",
      summary: `Be aware — ${scan.result.flaggedIntolerances.join(", ")}`,
      fallbackTitle: "Mild flag",
    };
  }
  return {
    iconBg: "bg-accent-soft",
    Icon: ShieldCheck,
    iconColor: "text-accent",
    summary: "No allergens detected",
    fallbackTitle: "Safe scan",
  };
}

export default function HomePage() {
  const [recent, setRecent] = useState<Scan[]>([]);
  const [allergens, setAllergens] = useState<Allergen[]>([]);
  const [stats, setStats] = useState({ scanned: 0, flagged: 0 });
  const [meta, setMeta] = useState({ greet: "", date: "" });
  const [hydrated, setHydrated] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const scans = getScans();
    const list = getAllergens();
    setRecent(scans.slice(0, 3));
    setAllergens(list);
    setStats({
      scanned: scans.length,
      flagged: scans.filter((s) => resultSeverity(s.result) !== "safe").length,
    });

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

    // Show onboarding only on truly first-ever visit (no flag + no data)
    if (!hasSeenOnboarding() && list.length === 0 && scans.length === 0) {
      setShowOnboarding(true);
    }
    setHydrated(true);
  }, []);

  const dismissOnboarding = () => {
    markOnboardingSeen();
    setShowOnboarding(false);
  };

  return (
    <div className="hero-bg flex min-h-dvh flex-col">
      <header className="mx-auto w-full max-w-md px-6 pt-12">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
              {meta.date || " "}
            </p>
            <h1 className="mt-1.5 text-[1.9rem] font-bold leading-tight tracking-tight">
              {meta.greet || "Welcome"}
            </h1>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5">
            <Leaf className="h-3.5 w-3.5 text-accent" strokeWidth={2.25} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
              Canopy
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 space-y-4 px-6 pb-28 pt-6">
        {/* Primary scan CTA */}
        <Link
          href="/scan"
          className="group flex items-center gap-4 rounded-3xl bg-accent p-5 text-white shadow-[0_16px_30px_-14px_rgb(28_122_83/0.55)] transition-transform active:scale-[0.99]"
        >
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-black/15">
            <Camera className="h-7 w-7" strokeWidth={1.75} />
          </span>
          <span className="flex-1">
            <span className="block text-lg font-bold tracking-tight">
              Scan a label
            </span>
            <span className="mt-0.5 block text-sm text-white/85">
              Point at the ingredients panel
            </span>
          </span>
          <ChevronRight className="h-5 w-5 text-white/80 transition-transform group-hover:translate-x-0.5" />
        </Link>

        {/* Watching for */}
        <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
              Watching for
              {hydrated && allergens.length > 0 ? ` · ${allergens.length}` : ""}
            </p>
            <Link
              href="/profile"
              className="text-xs font-semibold text-accent hover:underline"
            >
              Manage
            </Link>
          </div>

          {!hydrated && (
            <div className="flex gap-2" aria-hidden>
              <span className="h-8 w-20 animate-pulse rounded-full bg-background" />
              <span className="h-8 w-16 animate-pulse rounded-full bg-background" />
              <span className="h-8 w-24 animate-pulse rounded-full bg-background" />
            </div>
          )}

          {hydrated && allergens.length === 0 && (
            <Link
              href="/profile"
              className="flex items-center justify-between rounded-2xl bg-accent-soft px-4 py-3 text-sm font-semibold text-accent"
            >
              Set up your allergens
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}

          {hydrated && allergens.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {allergens.slice(0, 6).map((a) => (
                <span
                  key={a.id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-background px-3 py-1.5 text-[13px] font-medium ring-1 ring-border"
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
                <span className="inline-flex items-center rounded-full bg-background px-3 py-1.5 text-[13px] font-medium text-muted ring-1 ring-border">
                  +{allergens.length - 6}
                </span>
              )}
            </div>
          )}
        </section>

        {/* Stats */}
        <section className="grid grid-cols-3 rounded-3xl border border-border bg-card shadow-soft">
          <div className="flex flex-col items-center gap-1 py-4">
            <span className="font-mono text-2xl font-semibold tabular-nums">
              {hydrated ? stats.scanned : "—"}
            </span>
            <span className="text-[11px] font-medium text-muted">Scanned</span>
          </div>
          <div className="flex flex-col items-center gap-1 border-l border-border py-4">
            <span className="font-mono text-2xl font-semibold tabular-nums text-danger">
              {hydrated ? stats.flagged : "—"}
            </span>
            <span className="text-[11px] font-medium text-muted">Flagged</span>
          </div>
          <div className="flex flex-col items-center gap-1 border-l border-border py-4">
            <span className="font-mono text-2xl font-semibold tabular-nums text-accent">
              {hydrated ? allergens.length : "—"}
            </span>
            <span className="text-[11px] font-medium text-muted">Watching</span>
          </div>
        </section>

        {/* Recent scans */}
        <section>
          <div className="mb-3 flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold text-foreground">
              Recent scans
            </h2>
            {recent.length > 0 && (
              <Link
                href="/history"
                className="text-xs font-semibold text-accent hover:underline"
              >
                See all
              </Link>
            )}
          </div>

          {!hydrated && (
            <ul className="space-y-2" aria-hidden>
              <li className="h-[60px] animate-pulse rounded-2xl border border-border bg-card" />
              <li className="h-[60px] animate-pulse rounded-2xl border border-border bg-card/60" />
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
                      className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition-colors hover:border-accent/40"
                    >
                      <div className={`shrink-0 rounded-full p-2 ${v.iconBg}`}>
                        <Icon className={`h-4 w-4 ${v.iconColor}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {scan.foodName || v.fallbackTitle}
                        </p>
                        <p className="truncate text-xs text-muted">
                          {v.summary}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="pt-2 text-center">
          <Link
            href="/disclaimer"
            className="text-xs font-medium text-muted underline-offset-2 hover:text-foreground hover:underline"
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
