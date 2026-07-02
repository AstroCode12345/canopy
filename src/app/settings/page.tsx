"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  Download,
  LifeBuoy,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import {
  clearScans,
  getScans,
  getSettings,
  saveSettings,
  type Settings,
} from "@/lib/storage";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({ flagMayContain: true });
  const [scanCount, setScanCount] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSettings(getSettings());
    setScanCount(getScans().length);
    setHydrated(true);
  }, []);

  const toggleMayContain = () => {
    const next = { ...settings, flagMayContain: !settings.flagMayContain };
    setSettings(next);
    saveSettings(next);
  };

  const exportHistory = () => {
    const data = JSON.stringify(getScans(), null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `canopy-scans-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearHistory = () => {
    if (scanCount === 0) return;
    const ok = window.confirm(
      `Delete all ${scanCount} saved scan${scanCount === 1 ? "" : "s"}? This can't be undone.`,
    );
    if (!ok) return;
    clearScans();
    setScanCount(0);
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto w-full max-w-md px-6 pt-12">
        <h1 className="text-[1.9rem] font-bold leading-tight tracking-tight">
          Settings
        </h1>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 space-y-7 px-6 pb-28 pt-6">
        {/* Scanning */}
        <section>
          <p className="mb-2 px-1 font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
            Scanning
          </p>
          <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning-soft text-warning">
                <ShieldAlert className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold">
                  Flag &ldquo;may contain&rdquo; warnings
                </p>
                <p className="mt-0.5 text-[13px] leading-snug text-muted">
                  Treat trace advisories like &ldquo;may contain traces of
                  nuts&rdquo; as a flag. Recommended if you&apos;re highly
                  sensitive.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.flagMayContain}
                aria-label="Flag may contain warnings"
                onClick={toggleMayContain}
                className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors ${
                  settings.flagMayContain ? "bg-accent" : "bg-border-strong"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-[left] ${
                    settings.flagMayContain ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        {/* Your data */}
        <section>
          <p className="mb-2 px-1 font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
            Your data
          </p>
          <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
            <button
              type="button"
              onClick={exportHistory}
              disabled={!hydrated || scanCount === 0}
              className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-surface-2 disabled:opacity-40"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-muted">
                <Download className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <div className="flex-1">
                <p className="text-[15px] font-medium">Export scan history</p>
                <p className="text-[13px] text-faint">
                  {hydrated
                    ? `${scanCount} scan${scanCount === 1 ? "" : "s"} as JSON`
                    : " "}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-faint" />
            </button>
            <div className="h-px bg-border" />
            <button
              type="button"
              onClick={clearHistory}
              disabled={!hydrated || scanCount === 0}
              className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-danger-soft disabled:opacity-40"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger-soft text-danger">
                <Trash2 className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <div className="flex-1">
                <p className="text-[15px] font-medium text-danger">
                  Clear scan history
                </p>
                <p className="text-[13px] text-faint">Delete all saved scans</p>
              </div>
            </button>
          </div>
          <p className="mt-2.5 px-1 text-[12px] leading-snug text-faint">
            Everything stays on this device. Canopy has no account or cloud
            storage in this version.
          </p>
        </section>

        {/* About */}
        <section>
          <p className="mb-2 px-1 font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
            About
          </p>
          <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
            <Link
              href="/disclaimer"
              className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-surface-2"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <LifeBuoy className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <div className="flex-1">
                <p className="text-[15px] font-medium">Help &amp; limitations</p>
                <p className="text-[13px] text-faint">
                  What Canopy can and can&apos;t do
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-faint" />
            </Link>
          </div>
          <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
            Canopy v1.0 · Not a medical device
          </p>
        </section>
      </main>

      <BottomNav />
    </div>
  );
}
