"use client";

import Link from "next/link";
import { Leaf, ShieldCheck } from "lucide-react";

export default function WelcomePage() {
  return (
    <div className="hero-bg flex min-h-dvh flex-col bg-background">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(3rem,env(safe-area-inset-top))]">
        <div className="flex flex-1 flex-col items-start justify-center gap-6">
          <span className="relative flex h-16 w-16 items-center justify-center">
            <span
              aria-hidden
              className="absolute inset-0 -z-10 rounded-full bg-accent/35 blur-xl motion-safe:[animation:var(--animate-halo)]"
            />
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent shadow-[0_16px_32px_-10px_rgb(28_122_83/0.55)]">
              <Leaf className="h-7 w-7 text-white" strokeWidth={2} />
            </span>
          </span>

          <div>
            <h1 className="text-[2.1rem] font-bold leading-[1.08] tracking-tight text-balance">
              Know what&apos;s
              <br />
              in the box.
            </h1>
            <p className="mt-3.5 max-w-[280px] text-[15px] leading-relaxed text-muted">
              Point Canopy at an ingredient list. It reads the label and
              flags the allergens you&apos;ve told it to watch for.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            href="/sign-in?mode=create"
            className="flex w-full items-center justify-center rounded-full bg-accent py-3.5 text-base font-semibold text-white shadow-soft transition active:scale-[0.99]"
          >
            Set up my profile
          </Link>
          <Link
            href="/sign-in?mode=in"
            className="flex w-full items-center justify-center rounded-full border border-border-strong bg-card py-3.5 text-base font-semibold text-foreground transition active:scale-[0.99]"
          >
            I already have an account
          </Link>
          <p className="mt-1.5 flex items-start gap-1.5 text-center font-mono text-[11px] leading-relaxed text-faint">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-faint" />
            <span>
              Canopy flags allergens it finds on a label. It can&apos;t
              promise what isn&apos;t listed, so always check the pack.
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
