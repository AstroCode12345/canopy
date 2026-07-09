"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Clock,
  ImageOff,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { ScanResultCard } from "@/components/ScanResultCard";
import { deleteScanDb, getScansDb } from "@/lib/db";
import { resultVerdict, type Scan } from "@/lib/storage";
import { useProfile } from "@/lib/useProfile";

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(ts).toLocaleDateString();
}

function severityRowVisuals(scan: Scan) {
  const sev = resultVerdict(scan.result);
  if (sev === "unreadable") {
    return {
      iconBg: "bg-foreground/[0.06]",
      Icon: ImageOff,
      iconColor: "text-muted",
      summary: "Couldn't read the label. Scan it again",
      fallbackTitle: "Unreadable scan",
    };
  }
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

export default function HistoryPage() {
  const { supabase, user } = useProfile();
  const [scans, setScans] = useState<Scan[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [active, setActive] = useState<Scan | null>(null);

  useEffect(() => {
    if (!user) return; // wait for auth to resolve before fetching
    let cancelled = false;
    getScansDb(supabase).then((list) => {
      if (cancelled) return;
      setScans(list);
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [supabase, user]);

  const handleDelete = async (id: string) => {
    await deleteScanDb(supabase, id);
    setScans((prev) => prev.filter((s) => s.id !== id));
    setActive(null);
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-6 pt-10 pb-2">
        <h1 className="text-2xl font-semibold tracking-tight">History</h1>
        <p className="mt-1 text-sm text-muted">
          Every label you&apos;ve scanned.
        </p>
      </header>

      <main className="flex-1 space-y-3 px-6 pt-4 pb-32">
        {hydrated && scans.length === 0 && (
          <div className="rounded-2xl border border-border bg-card p-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft">
              <Clock className="h-6 w-6 text-accent" />
            </div>
            <p className="font-medium">No scans yet</p>
            <p className="mt-1 text-sm text-muted">
              Scans show up here right after you check a label.
            </p>
            <Link
              href="/scan"
              className="mt-4 inline-block rounded-full bg-accent px-6 py-2 text-sm font-semibold text-white"
            >
              Scan something
            </Link>
          </div>
        )}

        {scans.map((scan) => {
          const v = severityRowVisuals(scan);
          const Icon = v.Icon;
          return (
            <button
              key={scan.id}
              type="button"
              onClick={() => setActive(scan)}
              className="flex w-full items-start gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-accent/40"
            >
              <div className={`shrink-0 rounded-full p-2 ${v.iconBg}`}>
                <Icon className={`h-5 w-5 ${v.iconColor}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {scan.foodName || v.fallbackTitle}
                </p>
                <p className="mt-0.5 truncate text-sm text-muted">
                  {v.summary}
                </p>
                <p className="mt-1 text-xs text-muted/80">
                  {formatRelative(scan.createdAt)}
                </p>
              </div>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted" />
            </button>
          );
        })}
      </main>

      <BottomNav />

      {active && (
        <ScanDetailModal
          scan={active}
          onClose={() => setActive(null)}
          onDelete={() => handleDelete(active.id)}
        />
      )}
    </div>
  );
}

function ScanDetailModal({
  scan,
  onClose,
  onDelete,
}: {
  scan: Scan;
  onClose: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/45 backdrop-blur-sm md:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[92dvh] w-full max-w-md flex-col rounded-t-3xl bg-card shadow-2xl md:rounded-3xl">
        <div className="flex items-start justify-between px-6 pt-6 pb-2">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold tracking-tight">
              {scan.foodName || "Scan details"}
            </h2>
            <p className="mt-0.5 text-sm text-muted">
              {formatRelative(scan.createdAt)}
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
          <ScanResultCard result={scan.result} />
        </div>

        <div className="border-t border-border px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onDelete}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-danger/30 py-3 text-sm font-medium text-danger transition-colors hover:bg-danger-soft"
          >
            <Trash2 className="h-4 w-4" />
            Delete scan
          </button>
        </div>
      </div>
    </div>
  );
}
