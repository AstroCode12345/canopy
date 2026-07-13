// Barcode lookup: shared types + the pure logic that turns an Open Food
// Facts (OFF) product record into a verdict against the user's profile.
//
// The safety rule this whole file is built around: OFF is community-filled,
// so a declared allergen tag is trustworthy evidence something IS present,
// but the ABSENCE of tags is never evidence it's absent. Tag hits produce
// confident flags; no hits produces "nothing declared, verify with a label
// scan" and never a green "safe". That's why the verdict union below has no
// "clear" member on purpose.
//
// Kept free of fetch/Next imports so it can be exercised directly in a
// plain node script with recorded OFF responses.

import type { Advisory, Allergen } from "./storage";

/**
 * Canopy's preset allergen labels mapped to OFF's allergen taxonomy tags
 * (the EU-14 vocabulary OFF uses in allergens_tags / traces_tags). One
 * Canopy label can cover several tags: OFF splits shellfish into
 * crustaceans and molluscs, and both mean "Shellfish" to our users.
 */
const OFF_TAG_MAP: ReadonlyArray<{ label: string; tags: string[] }> = [
  { label: "Peanuts", tags: ["en:peanuts"] },
  { label: "Tree nuts", tags: ["en:nuts"] },
  { label: "Dairy", tags: ["en:milk"] },
  { label: "Eggs", tags: ["en:eggs"] },
  { label: "Gluten / Wheat", tags: ["en:gluten"] },
  { label: "Soy", tags: ["en:soybeans"] },
  { label: "Shellfish", tags: ["en:crustaceans", "en:molluscs"] },
  { label: "Fish", tags: ["en:fish"] },
  { label: "Sesame", tags: ["en:sesame-seeds"] },
];

const norm = (s: string) => s.trim().toLowerCase();

/** "en:sesame-seeds" -> "sesame seeds" */
const tagToWords = (tag: string) => tag.replace(/^[a-z]{2}:/, "").replace(/-/g, " ");

/**
 * Does this OFF tag speak about this profile allergen?
 * Preset labels go through the explicit map. Custom allergens (user-typed,
 * e.g. "Mustard") are matched by name against the tag's own words, loosely
 * in both directions ("sulphites" matches "sulphur dioxide and sulphites").
 * Loose is acceptable here because tags only ever create WARNINGS: a false
 * match over-warns, it can never wrongly clear something.
 */
function tagMatchesAllergen(tag: string, allergen: Allergen): boolean {
  const mapped = OFF_TAG_MAP.find((m) => norm(m.label) === norm(allergen.label));
  if (mapped) return mapped.tags.includes(tag);
  const words = tagToWords(tag);
  const label = norm(allergen.label);
  if (label.length < 4) return words === label;
  return words === label || words.includes(label) || label.includes(words);
}

/** The subset of an OFF product record this feature reads. */
export type OffProduct = {
  product_name?: string;
  brands?: string;
  image_front_small_url?: string;
  ingredients_text_en?: string;
  ingredients_text?: string;
  allergens_tags?: string[];
  traces_tags?: string[];
};

/**
 * What the client renders. "verdict" is deliberately NOT ScanStatus:
 * a barcode lookup can prove presence but never absence, so there is no
 * "clear" here — the closest it gets is "no_hits", which the UI must
 * present as "nothing declared, double-check with a label scan".
 */
export type BarcodeLookupResult = {
  barcode: string;
  verdict: "flagged" | "no_hits" | "no_data" | "not_found";
  productName?: string;
  brand?: string;
  imageUrl?: string;
  ingredients: string[];
  flaggedAllergies: string[];
  flaggedIntolerances: string[];
  advisories: Advisory[];
};

/**
 * Pure verdict derivation, mirroring the /api/scan architecture: evidence
 * channels in (declared tags = direct, traces tags = advisory), flags out,
 * severity always from OUR profile, flagMayContain applied deterministically
 * server-side.
 */
export function deriveBarcodeResult(
  barcode: string,
  product: OffProduct | null,
  allergens: Allergen[],
  flagMayContain: boolean,
): BarcodeLookupResult {
  const base = {
    barcode,
    ingredients: [] as string[],
    flaggedAllergies: [] as string[],
    flaggedIntolerances: [] as string[],
    advisories: [] as Advisory[],
  };

  if (!product) return { ...base, verdict: "not_found" };

  const allergenTags = product.allergens_tags ?? [];
  const tracesTags = product.traces_tags ?? [];
  const ingredientsText =
    product.ingredients_text_en || product.ingredients_text || "";

  // Split OFF's free-text ingredients into displayable items. Commas are the
  // list separator; parenthesized sub-ingredients stay attached to their item.
  const ingredients = ingredientsText
    .split(/[,;]+(?![^(]*\))/)
    .map((s) => s.replace(/\.\s*$/, "").trim())
    .filter(Boolean);

  const meta = {
    productName: product.product_name || undefined,
    brand: product.brands?.split(",")[0]?.trim() || undefined,
    imageUrl: product.image_front_small_url || undefined,
  };

  // A found product with no ingredient info AND no declared allergens tells
  // us nothing at all — treat it like an unreadable label, not like a pass.
  if (ingredients.length === 0 && allergenTags.length === 0 && tracesTags.length === 0) {
    return { ...base, ...meta, verdict: "no_data" };
  }

  const direct = allergens.filter((a) =>
    allergenTags.some((t) => tagMatchesAllergen(t, a)),
  );
  const advisories: Advisory[] = allergens
    .filter((a) => tracesTags.some((t) => tagMatchesAllergen(t, a)))
    .map((a) => ({
      allergen: a.label,
      severity: a.severity,
      phrase: `product database lists possible traces of ${a.label.toLowerCase()}`,
    }));

  const flaggedAllergies = [
    ...new Set(direct.filter((a) => a.severity === "allergy").map((a) => a.label)),
  ];
  const flaggedIntolerances = [
    ...new Set(
      direct.filter((a) => a.severity === "intolerance").map((a) => a.label),
    ),
  ];

  if (flagMayContain) {
    for (const adv of advisories) {
      const list =
        adv.severity === "allergy" ? flaggedAllergies : flaggedIntolerances;
      if (!list.includes(adv.allergen)) list.push(adv.allergen);
    }
  }

  const verdict =
    flaggedAllergies.length > 0 || flaggedIntolerances.length > 0
      ? "flagged"
      : "no_hits";

  return {
    ...base,
    ...meta,
    ingredients,
    flaggedAllergies,
    flaggedIntolerances,
    advisories,
    verdict,
  };
}
