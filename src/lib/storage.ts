// Types shared across the app, plus the one piece of state that genuinely
// belongs to THIS device rather than the user's account: whether they've
// seen the onboarding tour. Everything else (allergens, scans, settings)
// used to live here as localStorage helpers; that data now lives in
// Supabase — see src/lib/db.ts for reads/writes and src/lib/useProfile.ts
// for the signed-in user's profile.

const ONBOARDING_KEY = "onboarding:v1";

export type Severity = "allergy" | "intolerance";

export type Allergen = {
  id: string;
  label: string;
  /** "allergy" = severe / avoid completely. "intolerance" = mild / be aware. */
  severity: Severity;
};

/**
 * A cross-contact / precautionary statement ("may contain traces of X",
 * "made on shared equipment with X") tied to one of the user's allergens.
 * Always populated by /api/scan regardless of the flagMayContain setting
 * (audit fix H1) — kept separate from flaggedAllergies/flaggedIntolerances
 * so advisories are never silently merged or silently dropped. Whether an
 * advisory ALSO appears in the flagged arrays is a deterministic decision
 * made server-side from the flagMayContain setting at scan time, not left
 * to the model.
 */
export type Advisory = {
  /** exact label from the user's profile that this advisory matches */
  allergen: string;
  /** that allergen's severity tier at scan time */
  severity: Severity;
  /** the source phrase as read from the label, e.g. "may contain traces of peanuts" */
  phrase: string;
};

/**
 * Three-state verdict (audit fix C1).
 * "clear"      = label read successfully, nothing matched
 * "flagged"    = at least one allergen/intolerance matched
 * "unreadable" = the photo couldn't be read; NOT a safety verdict
 */
export type ScanStatus = "clear" | "flagged" | "unreadable";

export type ScanResult = {
  /**
   * Derived SERVER-SIDE in /api/scan. Optional because records saved before
   * July 2026 predate it; always read via scanStatusOf()/resultVerdict(),
   * never directly, so legacy records stay tolerated without migration.
   */
  status?: ScanStatus;
  /** Derived server-side from status ("clear" => true). Kept for back-compat. */
  safe: boolean;
  /** user allergen labels (severity="allergy") that matched */
  flaggedAllergies: string[];
  /** user allergen labels (severity="intolerance") that matched */
  flaggedIntolerances: string[];
  /** Cross-contact advisories detected on the label. */
  advisories: Advisory[];
  /** all ingredients detected in the image */
  ingredients: string[];
  reasoning: string;
};

export type Scan = {
  id: string;
  createdAt: number;
  foodName?: string;
  /** snapshot — so old scans stay meaningful even if profile changes */
  allergensAtTime: Allergen[];
  result: ScanResult;
};

// ----- Result helpers -----

/**
 * Read-time status resolution, tolerant of legacy records (audit C1).
 * Precedence is safety-asymmetric — the more cautious signal always wins:
 *   1. Any flagged allergen/intolerance => "flagged", even if a stored
 *      status claims otherwise.
 *   2. An explicit stored/served "unreadable" => "unreadable".
 *   3. Otherwise "clear". Legacy records (no status field) land here by
 *      construction: with empty arrays we cannot retroactively know whether
 *      an old scan was unreadable, so we never invent "unreadable" for them.
 */
export function scanStatusOf(result: ScanResult): ScanStatus {
  if (
    result.flaggedAllergies.length > 0 ||
    result.flaggedIntolerances.length > 0
  ) {
    return "flagged";
  }
  if (result.status === "unreadable") return "unreadable";
  return "clear";
}

/**
 * Single verdict switch for UI surfaces: like scanStatusOf(), but splits
 * "flagged" into the severity tier that drives color/copy.
 */
export function resultVerdict(
  result: ScanResult,
): "unreadable" | "allergy" | "intolerance" | "clear" {
  const status = scanStatusOf(result);
  if (status === "flagged") {
    return result.flaggedAllergies.length > 0 ? "allergy" : "intolerance";
  }
  return status;
}

// ----- Onboarding flag -----

export function hasSeenOnboarding(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(ONBOARDING_KEY) === "done";
}

export function markOnboardingSeen(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ONBOARDING_KEY, "done");
}
