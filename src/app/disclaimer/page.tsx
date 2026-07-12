import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Info,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { BottomNav } from "@/components/BottomNav";

export const metadata = {
  title: "About Canopy & safety",
  description:
    "How Canopy works, what it can and can't do, and how to scan well.",
};

export default function DisclaimerPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-6 pt-10 pb-2">
        <Link
          href="/"
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          About Canopy &amp; safety
        </h1>
        <p className="mt-1 text-sm text-muted">
          How Canopy works, what it can&apos;t do, and how to scan well.
        </p>
      </header>

      <main className="flex-1 space-y-4 px-6 pt-6 pb-32">
        {/* Important disclaimer — front and center, matches other card structure */}
        <div className="rounded-2xl border border-danger/20 bg-danger-soft p-6">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-danger/15 text-danger">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <h2 className="text-base font-semibold text-danger">
            Please read this first
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-foreground">
            Canopy is an AI tool that helps you spot allergens on food labels.{" "}
            <strong>
              It is not a medical device and should not be the only thing you
              rely on for safety.
            </strong>
          </p>
          <p className="mt-2 text-sm leading-relaxed text-foreground">
            AI can make mistakes, packaging can be misread, and ingredient lists
            change. If you have a life-threatening allergy, always verify the
            physical label yourself before eating.
          </p>
        </div>

        {/* Two-up: what Canopy is / what "safe" means */}
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h3 className="text-base font-semibold">The goal: quick filtering</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Canopy&apos;s job is to <strong>quickly rule out</strong>{" "}
            products that obviously contain your allergens. It saves you from
            squinting at tiny ingredient lists when the answer is clearly
            &ldquo;no.&rdquo;
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <h3 className="text-base font-semibold">
            What &ldquo;looks safe&rdquo; really means
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            When Canopy says &ldquo;Looks safe for you,&rdquo; it means the AI
            didn&apos;t find a direct match for the allergens you saved. It
            does <strong>not</strong> mean the product is 100% safe. It just
            means nothing obvious got flagged. Cross-contamination, hidden
            ingredients, and label changes can still happen.
          </p>
        </div>

        {/* Tips for better scans */}
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <Info className="h-5 w-5" />
          </div>
          <h3 className="text-base font-semibold">Tips for better scans</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <span>Bright, even lighting works best. Skip the shadows.</span>
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <span>Hold the camera steady and focus on the ingredients list.</span>
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <span>
                Scan the actual ingredients list, not the marketing copy on the
                front.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <span>
                Watch for &ldquo;may contain traces of&hellip;&rdquo;
                warnings. Canopy flags those too.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <span>
                When in doubt, retake the photo or check the label by hand.
              </span>
            </li>
          </ul>
        </div>

        <div className="pt-2 text-center">
          <Link
            href="/scan"
            className="inline-flex items-center rounded-full bg-accent px-6 py-3 text-base font-semibold text-white shadow-soft"
          >
            Got it, start scanning
          </Link>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
