"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Camera, Leaf, ShieldCheck } from "lucide-react";

interface Props {
  onDone: () => void;
}

interface Step {
  Hero: React.FC;
  title: string;
  body: React.ReactNode;
  cta: string;
  finalCta?: boolean; // last step navigates to /profile
}

const HeroLeaf = () => (
  <div className="relative flex h-32 w-32 items-center justify-center">
    <span
      aria-hidden
      className="absolute inset-0 -z-10 rounded-full bg-accent/35 blur-2xl motion-safe:[animation:var(--animate-halo)]"
    />
    <div className="flex h-28 w-28 items-center justify-center rounded-full bg-accent shadow-[0_25px_60px_-20px_rgb(28_122_83/0.5)]">
      <Leaf className="h-12 w-12 text-white" strokeWidth={2} />
    </div>
  </div>
);

const HeroChips = () => (
  <div className="flex h-32 w-full items-center justify-center px-8">
    <div className="flex flex-wrap items-center justify-center gap-2">
      <span className="rounded-full bg-danger px-4 py-2 text-sm font-medium text-white shadow-sm shadow-danger/30">
        Peanuts
      </span>
      <span className="rounded-full bg-warning-soft px-4 py-2 text-sm font-medium text-warning ring-1 ring-warning/30">
        Dairy
      </span>
      <span className="rounded-full bg-card px-4 py-2 text-sm font-medium text-foreground ring-1 ring-border">
        Eggs
      </span>
      <span className="rounded-full bg-danger px-4 py-2 text-sm font-medium text-white shadow-sm shadow-danger/30">
        Shellfish
      </span>
    </div>
  </div>
);

const HeroCamera = () => (
  <div className="relative flex h-32 w-32 items-center justify-center">
    <span
      aria-hidden
      className="absolute inset-0 -z-10 rounded-full bg-accent/35 blur-2xl motion-safe:[animation:var(--animate-halo)]"
    />
    <div className="flex h-28 w-28 items-center justify-center rounded-full bg-accent shadow-[0_25px_60px_-20px_rgb(28_122_83/0.5)]">
      <Camera className="h-12 w-12 text-white" strokeWidth={1.75} />
    </div>
  </div>
);

const STEPS: Step[] = [
  {
    Hero: HeroLeaf,
    title: "Hi, I’m Canopy",
    body: (
      <>
        Snap any food label and I’ll read the ingredients,
        <br className="hidden sm:inline" /> then flag anything that doesn’t
        agree with you.
      </>
    ),
    cta: "Next",
  },
  {
    Hero: HeroChips,
    title: "Tell me what to flag",
    body: (
      <>
        Pick your allergens or intolerances. Tag each one as{" "}
        <span className="font-semibold text-danger">severe</span> or{" "}
        <span className="font-semibold text-warning">mild</span> — I’ll watch
        for both in every scan.
      </>
    ),
    cta: "Next",
  },
  {
    Hero: HeroCamera,
    title: "One tap to scan",
    body: (
      <>
        Hit the big green button anytime. Point at the ingredients list and
        Canopy tells you in seconds whether it’s safe.
      </>
    ),
    cta: "Set up my allergens",
    finalCta: true,
  },
];

export function OnboardingTour({ onDone }: Props) {
  const [step, setStep] = useState(0);
  const router = useRouter();
  const current = STEPS[step];
  const Hero = current.Hero;

  const handleNext = () => {
    if (current.finalCta) {
      onDone();
      router.push("/profile");
      return;
    }
    setStep(step + 1);
  };

  const handleSkip = () => {
    onDone();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Canopy"
      className="hero-bg fixed inset-0 z-50 flex flex-col bg-background motion-safe:[animation:var(--animate-fade-in)]"
    >
      {/* Top: progress dots + skip */}
      <div className="flex items-center justify-between px-6 pt-12">
        <div className="flex items-center gap-1.5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? "w-6 bg-accent" : "w-1.5 bg-muted/30"
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={handleSkip}
          className="text-sm font-medium text-muted transition-colors hover:text-foreground"
        >
          Skip
        </button>
      </div>

      {/* Content */}
      <main
        className="flex flex-1 flex-col items-center justify-center px-8 text-center"
        key={step}
      >
        <div className="motion-safe:[animation:var(--animate-fade-in)]">
          <Hero />
        </div>
        <h2 className="mt-8 text-3xl font-semibold leading-tight tracking-tight motion-safe:[animation:var(--animate-fade-in)]">
          {current.title}
        </h2>
        <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-muted motion-safe:[animation:var(--animate-fade-in)]">
          {current.body}
        </p>
      </main>

      {/* Bottom CTA */}
      <div className="px-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={handleNext}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-accent py-3.5 text-base font-semibold text-white shadow-soft transition-transform active:scale-[0.99]"
        >
          {current.cta}
          <ArrowRight className="h-4 w-4" strokeWidth={2.25} />
        </button>
        {!current.finalCta && (
          <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted">
            <ShieldCheck className="h-3.5 w-3.5 text-accent" />
            <span>No account needed. Everything stays on your phone.</span>
          </div>
        )}
      </div>
    </div>
  );
}
