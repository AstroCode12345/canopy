"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  Download,
  LifeBuoy,
  LogOut,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { clearScansDb, getScansDb, setFlagMayContainDb } from "@/lib/db";
import { useProfile } from "@/lib/useProfile";

export default function SettingsPage() {
  const router = useRouter();
  // Real account (middleware guarantees someone is signed in here).
  const { supabase, user, profile } = useProfile();
  // flag_may_contain lives on the profile row itself; mirror it into local
  // state so the toggle can update instantly (optimistic) while the write
  // happens in the background.
  const [flagMayContain, setFlagMayContain] = useState(true);
  const [scanCount, setScanCount] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (profile) setFlagMayContain(profile.flag_may_contain);
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getScansDb(supabase).then((scans) => {
      if (cancelled) return;
      setScanCount(scans.length);
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [supabase, user]);

  const handleSignOut = async () => {
    const ok = window.confirm("Sign out of Canopy on this device?");
    if (!ok) return;
    // Ends the Supabase session (clears the auth cookies). The middleware
    // will then treat us as signed out and route to /welcome.
    await supabase.auth.signOut();
    router.push("/welcome");
    router.refresh();
  };

  const toggleMayContain = () => {
    if (!user) return;
    const next = !flagMayContain;
    setFlagMayContain(next); // optimistic — flips instantly, no spinner
    setFlagMayContainDb(supabase, user.id, next);
  };

  const exportHistory = async () => {
    const scans = await getScansDb(supabase, 1000);
    const data = JSON.stringify(scans, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `canopy-scans-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearHistory = async () => {
    if (!user || scanCount === 0) return;
    const ok = window.confirm(
      `Delete all ${scanCount} saved scan${scanCount === 1 ? "" : "s"}? This can't be undone.`,
    );
    if (!ok) return;
    const success = await clearScansDb(supabase, user.id);
    if (success) setScanCount(0);
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto w-full max-w-md px-6 pt-12">
        <h1 className="text-[1.9rem] font-bold leading-tight tracking-tight">
          Settings
        </h1>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 space-y-7 px-6 pb-28 pt-6">
        {/* Account */}
        <section>
          <p className="mb-2 px-1 font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
            Account
          </p>
          <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
            <div className="flex items-center gap-3.5 px-5 py-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-base font-bold text-white">
                {(profile?.display_name ?? user?.email ?? "?")
                  .trim()
                  .charAt(0)
                  .toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold">
                  {profile?.display_name ?? "Your account"}
                </p>
                <p className="truncate text-[13px] text-faint">
                  {user?.email ?? " "}
                </p>
              </div>
            </div>
            <div className="h-px bg-border" />
            <button
              type="button"
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-danger-soft"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger-soft text-danger">
                <LogOut className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <p className="text-[15px] font-medium text-danger">Sign out</p>
            </button>
          </div>
        </section>

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
                aria-checked={flagMayContain}
                aria-label="Flag may contain warnings"
                onClick={toggleMayContain}
                className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors ${
                  flagMayContain ? "bg-accent" : "bg-border-strong"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-[left] ${
                    flagMayContain ? "left-[22px]" : "left-0.5"
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
            Your allergens and scan history are saved to your account and
            protected by database-level access rules — only you can ever
            read or write your own data.
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
