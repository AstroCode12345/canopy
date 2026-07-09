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
  const visuals =
    verdict === "allergy"
      ? {
          bg: "bg-danger-soft",
          iconBg: "bg-danger text-white",
          title: "Avoid this",
          titleColor: "text-danger",
          sub: `${flaggedAllergies.length} severe${flaggedIntolerances.length ? ` + ${flaggedIntolerances.length} mild` : ""} flagged`,
          Icon: AlertTriangle,
        }
      : verdict === "intolerance"
        ? {
            bg: "bg-warning-soft",
            iconBg: "bg-warning text-white",
            title: "Be aware",
            titleColor: "text-warning",
            sub: `${flaggedIntolerances.length} mild flagged`,
            Icon: AlertCircle,
          }
        : verdict === "unreadable"
          ? {
              bg: "bg-foreground/[0.06]",
              iconBg: "bg-muted text-white",
              title: "Couldn't read this label",
              titleColor: "text-foreground",
              sub: "Not a safety check. Retake the photo",
              Icon: ImageOff,
            }
          : {
              bg: "bg-accent-soft",
              iconBg: "bg-accent text-white",
              title: "Looks safe for you",
              titleColor: "text-accent",
              sub: "No matches in your allergen list",
              Icon: ShieldCheck,
            };

  const Icon = visuals.Icon;

  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft motion-safe:[animation:var(--animate-fade-in)]">
      <div className={`px-6 py-6 ${visuals.bg}`}>
        <div className="flex items-center gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${visuals.iconBg}`}
          >
            <Icon className="h-6 w-6" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <p
              className={`text-lg font-semibold leading-tight ${visuals.titleColor}`}
            >
              {visuals.title}
            </p>
            <p className="mt-0.5 text-xs font-medium uppercase tracking-wider text-foreground/60">
              {visuals.sub}
            </p>
          </div>
        </div>

        {total > 0 && (
          <div className="mt-4 space-y-2">
            {flaggedAllergies.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-danger">
                  Severe
                </span>
                {flaggedAllergies.map((allergen) => (
                  <span
                    key={`a-${allergen}`}
                    className="inline-flex items-center gap-1 rounded-full bg-danger/15 px-3 py-1 text-sm font-medium text-danger ring-1 ring-danger/25"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-danger" />
                    {allergen}
                  </span>
                ))}
              </div>
            )}
            {flaggedIntolerances.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-warning">
                  Mild
                </span>
                {flaggedIntolerances.map((allergen) => (
                  <span
                    key={`i-${allergen}`}
                    className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-3 py-1 text-sm font-medium text-warning ring-1 ring-warning/30"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                    {allergen}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-5 p-6">
        {advisories.length > 0 && (
          <div className="rounded-2xl bg-warning-soft p-4 ring-1 ring-warning/20">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-warning">
                  Cross-contact warning{advisories.length > 1 ? "s" : ""}
                </h4>
                <ul className="mt-1.5 space-y-1.5">
                  {advisories.map((adv, i) => (
                    <li
                      key={`${adv.allergen}-${i}`}
                      className="text-sm leading-snug text-foreground"
                    >
                      <span className="font-medium">{adv.allergen}</span>
                      <span className="text-muted"> — &ldquo;{adv.phrase}&rdquo;</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
            Reasoning
          </h4>
          <p className="text-sm leading-relaxed text-foreground">{reasoning}</p>
        </div>

        {ingredients.length > 0 && (
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
              All ingredients detected
            </h4>
            <p className="text-sm leading-relaxed text-foreground">
              {ingredients.join(", ")}
            </p>
          </div>
        )}

        <p className="border-t border-border pt-4 text-xs text-muted">
          Canopy can miss things. Always double-check the label yourself before
          eating.{" "}
          <Link
            href="/disclaimer"
            className="font-medium text-accent underline-offset-2 hover:underline"
          >
            Why?
          </Link>
        </p>
      </div>
    </div>
  );
}
