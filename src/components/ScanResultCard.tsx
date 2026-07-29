import Link from "next/link";
import {
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  ImageOff,
} from "lucide-react";
import {
  resultVerdict,
  type ScanResult,
} from "@/lib/storage";

interface Props {
  result: ScanResult;
}

export function ScanResultCard({ result }: Props) {
  const verdict = resultVerdict(result);
  const {
    flaggedAllergies,
    flaggedIntolerances,
    advisories,
    ingredients,
    reasoning,
  } = result;

  const total = flaggedAllergies.length + flaggedIntolerances.length;

  // Per-verdict visual tokens. "unreadable" is deliberately neutral: it is
  // not a safety verdict, so it must not borrow green (clear), red (avoid),
  // or amber (be aware).
  // 2a refresh: the band is a SOLID status colour with white content, not a
  // soft tint with coloured text. "unreadable" stays deliberately neutral —
  // it is not a safety verdict, so it must not borrow green, red or amber.
  const visuals =
    verdict === "allergy"
      ? {
          band: "bg-danger",
          title: "Avoid this",
          sub: `${flaggedAllergies.length} severe${flaggedIntolerances.length ? ` · ${flaggedIntolerances.length} mild` : ""} flagged`,
          Icon: AlertTriangle,
        }
      : verdict === "intolerance"
        ? {
            band: "bg-warning",
            title: "Be aware",
            sub: `${flaggedIntolerances.length} mild flagged`,
            Icon: AlertCircle,
          }
        : verdict === "unreadable"
          ? {
              band: "bg-muted",
              title: "Couldn't read this label",
              sub: "Not a safety check · retake the photo",
              Icon: ImageOff,
            }
          : {
              band: "bg-accent",
              title: "Looks safe for you",
              sub: "No matches in your allergen list",
              Icon: ShieldCheck,
            };

  const Icon = visuals.Icon;

  return (
    <div className="overflow-hidden rounded-[20px] border border-border bg-card motion-safe:[animation:var(--animate-fade-in)]">
      <div className={`p-[19px] text-white ${visuals.band}`}>
        <div className="flex items-center gap-[11px]">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.18]">
            <Icon className="h-[21px] w-[21px]" strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            <p className="font-display text-[17px] font-extrabold leading-tight">
              {visuals.title}
            </p>
            <p className="mt-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-white/70">
              {visuals.sub}
            </p>
          </div>
        </div>

        {total > 0 && (
          <div className="mt-[15px] space-y-2">
            {flaggedAllergies.length > 0 && (
              <div className="flex flex-wrap items-center gap-[7px]">
                <span className="font-mono text-[9.5px] font-bold uppercase tracking-[0.08em] text-white/70">
                  Severe
                </span>
                {flaggedAllergies.map((allergen) => (
                  <span
                    key={`a-${allergen}`}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.16] px-3 py-1.5 text-[11.5px] font-semibold text-white"
                  >
                    <span className="h-[5px] w-[5px] rounded-full bg-white" />
                    {allergen}
                  </span>
                ))}
              </div>
            )}
            {flaggedIntolerances.length > 0 && (
              <div className="flex flex-wrap items-center gap-[7px]">
                <span className="font-mono text-[9.5px] font-bold uppercase tracking-[0.08em] text-white/70">
                  Mild
                </span>
                {flaggedIntolerances.map((allergen) => (
                  <span
                    key={`i-${allergen}`}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.16] px-3 py-1.5 text-[11.5px] font-semibold text-white"
                  >
                    <span className="h-[5px] w-[5px] rounded-full bg-white/60 ring-1 ring-white/70" />
                    {allergen}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 bg-card p-[19px]">
        {advisories.length > 0 && (
          <div className="rounded-[14px] bg-warning-soft px-3.5 py-3">
            <h4 className="mb-1.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.08em] text-warning-ink">
              Cross-contact warning{advisories.length > 1 ? "s" : ""}
            </h4>
            <ul className="space-y-1.5">
              {advisories.map((adv, i) => (
                <li
                  key={`${adv.allergen}-${i}`}
                  className="text-[12.5px] leading-snug"
                >
                  <span className="font-bold">{adv.allergen}</span>
                  <span className="text-muted">
                    {" "}
                    &mdash; &ldquo;{adv.phrase}&rdquo;
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <h4 className="mb-1.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.08em] text-faint">
            What we found
          </h4>
          <p className="text-[12.5px] font-medium leading-[1.55]">{reasoning}</p>
        </div>

        {ingredients.length > 0 && (
          <div>
            <h4 className="mb-1.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.08em] text-faint">
              All ingredients detected
            </h4>
            {/* Mono here on purpose: it reads as transcribed-from-the-label
                rather than as prose Canopy wrote. */}
            <p className="font-mono text-[11.5px] leading-[1.6] text-muted">
              {ingredients.join(", ")}
            </p>
          </div>
        )}

        <p className="border-t border-border pt-3.5 text-[11.5px] leading-relaxed text-faint">
          Canopy can miss things. Always double-check the label yourself before
          eating.{" "}
          <Link
            href="/disclaimer"
            className="font-bold text-accent underline-offset-2 hover:underline"
          >
            Why?
          </Link>
        </p>
      </div>
    </div>
  );
}
