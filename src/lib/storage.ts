// localStorage helpers for Canopy. Keep this the single source of truth for
// what we persist on the client. v1: no auth, no DB — everything lives here.

const ALLERGENS_KEY = "allergens:v1";
const SCANS_KEY = "scans:v1";
const ONBOARDING_KEY = "onboarding:v1";
const SETTINGS_KEY = "settings:v1";
const MAX_SCANS = 50;

export type Severity = "allergy" | "intolerance";

export type Allergen = {
  id: string;
  label: string;
  /** "allergy" = severe / avoid completely. "intolerance" = mild / be aware. */
  severity: Severity;
};

export type ScanResult = {
  /** true only when nothing was flagged (no allergies AND no intolerances) */
  safe: boolean;
  /** user allergen labels (severity="allergy") that matched */
  flaggedAllergies: string[];
  /** user allergen labels (severity="intolerance") that matched */
  flaggedIntolerances: string[];
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

// ----- Allergens -----

export function getAllergens(): Allergen[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ALLERGENS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (a): a is { id: string; label: string; severity?: Severity } =>
          typeof a === "object" &&
          a !== null &&
          typeof a.id === "string" &&
          typeof a.label === "string",
      )
      .map((a) => ({
        id: a.id,
        label: a.label,
        // Migration: existing entries without severity default to allergy (safer).
        severity:
          a.severity === "intolerance" ? "intolerance" : "allergy",
      }));
  } catch {
    return [];
  }
}

export function saveAllergens(list: Allergen[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ALLERGENS_KEY, JSON.stringify(list));
}

// ----- Scans -----

/** Internal: tolerate older scan shapes that used `flagged: string[]`. */
function normalizeScan(raw: unknown): Scan | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (
    typeof o.id !== "string" ||
    typeof o.createdAt !== "number" ||
    typeof o.result !== "object" ||
    o.result === null
  ) {
    return null;
  }
  const r = o.result as Record<string, unknown>;
  const ingredients = Array.isArray(r.ingredients)
    ? r.ingredients.filter((i): i is string => typeof i === "string")
    : [];
  const reasoning = typeof r.reasoning === "string" ? r.reasoning : "";
  const safe = typeof r.safe === "boolean" ? r.safe : true;

  let flaggedAllergies: string[];
  let flaggedIntolerances: string[];

  if (Array.isArray(r.flaggedAllergies) || Array.isArray(r.flaggedIntolerances)) {
    flaggedAllergies = Array.isArray(r.flaggedAllergies)
      ? r.flaggedAllergies.filter((i): i is string => typeof i === "string")
      : [];
    flaggedIntolerances = Array.isArray(r.flaggedIntolerances)
      ? r.flaggedIntolerances.filter((i): i is string => typeof i === "string")
      : [];
  } else if (Array.isArray(r.flagged)) {
    // Legacy single 'flagged' field — treat as allergies (safer default).
    flaggedAllergies = r.flagged.filter((i): i is string => typeof i === "string");
    flaggedIntolerances = [];
  } else {
    flaggedAllergies = [];
    flaggedIntolerances = [];
  }

  return {
    id: o.id,
    createdAt: o.createdAt,
    foodName: typeof o.foodName === "string" ? o.foodName : undefined,
    allergensAtTime: Array.isArray(o.allergensAtTime)
      ? (o.allergensAtTime as Allergen[]).map((a) => ({
          id: String(a.id ?? ""),
          label: String(a.label ?? ""),
          severity: a?.severity === "intolerance" ? "intolerance" : "allergy",
        }))
      : [],
    result: {
      safe,
      flaggedAllergies,
      flaggedIntolerances,
      ingredients,
      reasoning,
    },
  };
}

export function getScans(): Scan[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SCANS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeScan)
      .filter((s): s is Scan => s !== null);
  } catch {
    return [];
  }
}

export function getScan(id: string): Scan | undefined {
  return getScans().find((s) => s.id === id);
}

export function addScan(scan: Scan): Scan[] {
  const all = [scan, ...getScans()].slice(0, MAX_SCANS);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(SCANS_KEY, JSON.stringify(all));
  }
  return all;
}

export function deleteScan(id: string): Scan[] {
  const all = getScans().filter((s) => s.id !== id);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(SCANS_KEY, JSON.stringify(all));
  }
  return all;
}

export function clearScans(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(SCANS_KEY);
  }
}

// ----- Settings -----

export type Settings = {
  /** When true, "may contain traces" advisories count as a flag (conservative). */
  flagMayContain: boolean;
};

const DEFAULT_SETTINGS: Settings = { flagMayContain: true };

export function getSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const p = JSON.parse(raw) as Record<string, unknown>;
    return {
      flagMayContain:
        typeof p.flagMayContain === "boolean" ? p.flagMayContain : true,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: Settings): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

// ----- Result helpers -----

/** "allergy" if any allergy flagged; "intolerance" if only intolerances; "safe" otherwise. */
export function resultSeverity(
  result: ScanResult,
): "safe" | "intolerance" | "allergy" {
  if (result.flaggedAllergies.length > 0) return "allergy";
  if (result.flaggedIntolerances.length > 0) return "intolerance";
  return "safe";
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
