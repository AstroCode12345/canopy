import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { requireSessionInProduction } from "@/lib/apiAuth";
import type { Advisory, Allergen, ScanResult, ScanStatus } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 30;

const SYSTEM_PROMPT = `You are Canopy, an allergen scanner that helps users with food sensitivities check labels. You analyze food packaging photos and check ingredients against the user's allergen list. The user splits their sensitivities into two severity tiers: ALLERGIES (severe — they must avoid completely) and INTOLERANCES (mild — they want to be aware). Always respond with valid JSON only — no markdown fences, no commentary outside the JSON. Be conservative: when in doubt, flag it.`;

// Reference knowledge injected into the matching prompt (audit fix C2).
// `aliases` are ingredient-level synonyms/derivatives; `dishes` are named
// foods or preparations whose STANDARD composition includes the allergen even
// though the allergen word itself is not printed. Keep this the single place
// alias knowledge lives — extend it here, not in prose.
const ALLERGEN_REFERENCE: ReadonlyArray<{
  group: string;
  aliases: string[];
  dishes: string[];
}> = [
  {
    group: "Milk / dairy",
    aliases: [
      "casein", "caseinate", "whey", "lactose", "lactalbumin", "ghee",
      "curds", "butter", "cream", "milk solids", "paneer", "kefir",
      "乳", "牛乳", "乳成分", "脱脂粉乳",
      "全粉乳 (whole MILK powder — do not confuse with 全粒粉, whole-wheat flour)",
      "奶", "牛奶", "奶粉", "全脂奶粉 (Chinese: whole milk powder — dairy, not wheat)",
      "Milch", "Molke (German: whey)", "lait", "leche", "mantequilla (Spanish: butter)",
    ],
    dishes: [
      "custard", "brioche (butter + milk)", "bechamel", "white chocolate",
      "milk chocolate", "halloumi",
    ],
  },
  {
    group: "Eggs",
    aliases: [
      "albumin", "albumen", "ovalbumin", "ovomucoid", "lysozyme",
      "meringue powder", "卵", "鶏卵", "卵白", "鸡蛋", "蛋",
      "Vollei (German: whole egg — an egg product, not whey)", "Ei", "Eier", "oeuf", "huevo",
    ],
    dishes: [
      "mayonnaise", "aioli", "meringue", "royal icing", "hollandaise",
      "custard", "brioche",
    ],
  },
  {
    group: "Fish",
    aliases: ["anchovy", "anchovies", "fish sauce", "fish gelatin"],
    dishes: [
      "Worcestershire sauce (anchovy)", "Caesar dressing (anchovy)",
      "surimi", "nam pla",
    ],
  },
  {
    group: "Shellfish",
    aliases: ["krill", "prawn", "shrimp", "langoustine", "scampi", "crab", "lobster", "えび", "かに", "虾", "蟹"],
    dishes: ["oyster sauce", "shrimp paste", "XO sauce", "bisque"],
  },
  {
    group: "Tree nuts",
    aliases: [
      "almond", "hazelnut", "cashew", "pistachio", "walnut", "pecan",
      "macadamia", "brazil nut", "nut paste", "nut flour", "nut oil",
      "アーモンド", "くるみ", "カシューナッツ", "坚果 (nuts)", "杏仁", "腰果", "核桃",
      "Haselnüsse", "Mandeln", "fruits à coque (French: tree nuts, NOT fish or shellfish)", "frutos de cáscara (Spanish: tree nuts)",
    ],
    dishes: [
      "marzipan (almond)", "frangipane (almond)", "praline (hazelnut)",
      "gianduja (hazelnut)", "nougat (nuts)", "amaretto (almond)",
      "orgeat (almond)", "baklava", "hazelnut spread", "pesto (pine nuts)",
    ],
  },
  {
    group: "Peanuts",
    aliases: ["groundnut", "arachis oil", "peanut flour", "monkey nuts", "ピーナッツ", "落花生", "花生", "Erdnüsse", "arachide", "cacahuete"],
    dishes: [
      "satay (peanut-based)", "peanut stew / mafe", "kung pao",
      "bamba",
    ],
  },
  {
    group: "Wheat / gluten",
    aliases: [
      "semolina", "spelt", "durum", "farro", "einkorn", "kamut", "bulgur",
      "couscous", "malt", "malt extract", "malt vinegar (barley)",
      "小麦", "小麦粉", "面粉", "全粒粉 (whole-wheat flour — not 全粉乳/全脂奶粉, which are milk)",
      "Weizenmehl", "farine de blé", "harina de trigo",
    ],
    dishes: [
      "seitan (pure wheat gluten)", "panko", "udon", "soy sauce (brewed with wheat)",
      "brioche", "bread, pasta, and pastry unless explicitly gluten-free",
    ],
  },
  {
    group: "Soy",
    aliases: ["soya", "soy protein", "lecithin (E322)", "textured vegetable protein", "TVP", "大豆", "黄豆", "Soja", "Sojalecithin"],
    dishes: ["tofu", "tempeh", "edamame", "miso", "natto", "soy sauce", "tamari"],
  },
  {
    group: "Sesame",
    aliases: ["benne", "sesame oil", "sesamol", "gomashio", "ごま", "胡麻", "芝麻", "Sesam", "sésamo"],
    dishes: ["tahini", "hummus (tahini)", "halva", "za'atar"],
  },
];

function renderAllergenReference(): string {
  return ALLERGEN_REFERENCE.map(
    (g) =>
      `- ${g.group} — derivatives/synonyms: ${g.aliases.join(", ")}. Named foods that contain it by standard composition: ${g.dishes.join(", ")}.`,
  ).join("\n");
}

function buildUserPrompt(allergens: Allergen[]) {
  const allergies = allergens.filter((a) => a.severity === "allergy");
  const intolerances = allergens.filter((a) => a.severity === "intolerance");

  const allergiesList = allergies.length
    ? allergies.map((a) => a.label).join(", ")
    : "(none)";
  const intolerancesList = intolerances.length
    ? intolerances.map((a) => a.label).join(", ")
    : "(none)";

  return `The user's SEVERE allergies (avoid completely): ${allergiesList}
The user's MILD intolerances (be aware): ${intolerancesList}

Analyze this food label image. The label may be written in ANY language (English, Spanish, French, Japanese, and so on); read it regardless of language. Carefully identify every single ingredient you can read. For each user sensitivity, check whether it appears in the ingredients in ANY of three forms: (1) named directly, (2) as an alias or derivative, or (3) inside a named food or dish whose standard composition includes it — see the reference below and the COMPOSITE FOODS rule.

ALLERGEN REFERENCE (examples of each pattern — not an exhaustive list; apply the same reasoning to items not listed here):
${renderAllergenReference()}

TRANSLATION TRAPS — these exact words are frequently mistranslated. This table is authoritative; if your first-instinct translation of one of these words differs, the table wins:
- German "Vollei" = whole EGG (an egg product). It is NEVER whey — whey in German is "Molke". "Vollei" on a label means the product contains egg.
- Japanese 全粉乳 = whole MILK powder (dairy). 全粒粉 = whole-WHEAT flour (gluten). One character apart, completely different allergens.
- Chinese 全脂奶粉 = whole MILK powder (dairy), never a wheat product.
- French "fruits à coque" = TREE NUTS, never fish and never shellfish.
- Spanish "frutos de cáscara" = TREE NUTS.

Return ONLY this JSON object (no other text). Note what you are NOT asked for:
there is no "flagged" or "safe-to-eat" field for you to decide — you report
raw evidence only, in two separate channels, and something outside your
response turns that evidence into a verdict.
{
  "ingredients": ["every ingredient you can read. For labels not in English, write each entry as English followed by the original printed word in parentheses, e.g. 'Wheat flour (Weizenmehl)', 'Whole milk powder (全粉乳)', 'Whole egg (Vollei)' — always preserve the original printed word"],
  "directMatches": [{ "allergen": "exact matching label from the user's list", "source": "the printed text from the ingredients enumeration that justifies the match, copied as printed, e.g. 'HAZELNUTS 13%' or 'marzipan'" }],
  "advisories": [{ "allergen": "exact matching label from the user's list", "phrase": "the source advisory text as read, e.g. may contain traces of peanuts" }],
  "readable": true only if the ingredients were clearly readable. If the image is blurry, cut off, or no ingredients are visible, this MUST be false and directMatches/advisories/ingredients MUST all be [],
  "reasoning": "1 to 2 short, plain sentences written straight to the person as 'you', never 'the user'. Do NOT walk through the ingredients one by one. If something matched, name it in a few words and why it is on their radar, e.g. 'This has almonds, which are on your avoid list.' If there is a real advisory, add a brief line, e.g. 'It also says it may contain traces of peanuts.' If nothing matched, reassure them and remind them labels change, e.g. 'Nothing on your list turned up here, but check the packaging yourself to be safe.' Sound like a careful friend, calm and human, not a clinical report."
}

directMatches vs advisories — these are TWO SEPARATE EVIDENCE CHANNELS, never combined by you. The test is WHERE on the label the word comes from, not just whether the word appears somewhere in the image:
- "directMatches": the allergen is part of the product's actual ingredients — named directly INSIDE THE INGREDIENTS LIST (or equivalent enumeration of what the product is made of), as an alias/derivative, or via composite-food inference (see COMPOSITE FOODS below). One entry per allergen that matches this way. Every entry MUST include "source": the printed words from the ingredients enumeration that justify the match — the ingredient itself ("HAZELNUTS 13%") or the printed dish name for composite inference ("marzipan"). For composite-food inference the source IS the printed dish name, copied as printed: source "satay seasoning" justifies Peanuts, source "brioche" justifies Eggs/Dairy/Gluten, source "marzipan" justifies Tree nuts — citing the dish name is a complete, valid source. If the label is in another language or hard to read and you cannot quote the print exactly, use the closest ingredient as you wrote it in the "ingredients" array. The source field must NEVER stop you from reporting a real match: it does not raise the bar for what counts as a match, it only records where the match came from, and a match you are confident in with an imperfect source is always better than a missing match. A source is never an advisory sentence and never a free-from statement: if the only text you could cite for an allergen is a free-from or absence statement, that allergen belongs in NEITHER array.
- "advisories": a SEPARATE sentence warning that the allergen MIGHT be present through cross-contact — "may contain traces of X", "manufactured in a facility that also processes X", "made on shared equipment with X" (in ANY language, e.g. French "Peut contenir..."), found anywhere on the packaging. One entry per such statement, with "phrase" as the source text. An advisory ALWAYS asserts possible presence or risk. A statement asserting ABSENCE is never an advisory (see POLARITY below).
- CRITICAL: if an allergen's name appears ONLY inside an advisory sentence like "may contain traces of X" and NOWHERE in the actual ingredients enumeration, that is advisory-only evidence — X goes ONLY in "advisories", never in "directMatches", even though the word "X" is technically printed on the packaging. The advisory sentence is not part of the ingredients list; reading the word there is not the same as the ingredient being present. Do not let the mere presence of the allergen's name anywhere in the printed text put it into directMatches — check specifically whether it is inside the ingredients enumeration itself.
  Worked example: a label's ingredients list is "Oat flakes, honey, dried cranberries, sunflower seeds, cinnamon." followed by the separate sentence "May contain traces of peanuts and sesame." Peanuts and sesame do NOT appear in the ingredients list — they appear only inside the advisory sentence. Correct output: directMatches = [] (empty — peanuts/sesame are not ingredients of this product), advisories = [{"allergen":"Peanuts","phrase":"May contain traces of peanuts and sesame"}, {"allergen":"Sesame","phrase":"..."}], and the "ingredients" array should list oat flakes/honey/dried cranberries/sunflower seeds/cinnamon only — do NOT add "peanuts" or "sesame" to the ingredients array either, since they are not actually ingredients of this product.
- If an allergen is both a real ingredient (appears in the ingredients enumeration) AND separately has an advisory sentence about it (unusual, but possible for e.g. "traces of egg" on a product that also lists egg directly), report it in BOTH arrays — each one independently, because each is independently true.
- Whether an advisory-only allergen also becomes a "flag" is a decision made entirely outside your response; your only job is to correctly locate WHERE each allergen name came from.
- POLARITY — read whether a statement asserts the allergen is PRESENT/at risk or ABSENT, do not just spot the allergen word near the word "facility". "Free from X", "does not contain X", "X-free", "made in a facility FREE FROM X", "no X", "suitable for people with X allergy" all assert the allergen is ABSENT. These are reassurances, the exact OPPOSITE of an advisory. NEVER put an absence or free-from statement into advisories or directMatches, and never surface it as a risk.
  Worked counter-example: a label reads "Made in a dedicated peanut and tree nut free facility." This tells the user the facility is FREE FROM peanuts and tree nuts. Correct output for peanuts and tree nuts: they go in NEITHER array (advisories empty for them, directMatches empty for them). Flagging "tree nuts" here just because the words "tree nut" appear is exactly the mistake to avoid: the sentence says the product is SAFE from tree nuts, not at risk of them.
- DECLARED-ALLERGEN SUMMARIES: many labels print a mandatory summary DECLARING what the product contains, separate from the ingredients list, and these are directMatch evidence, not advisories. Japanese labels: （原材料の一部に乳成分・小麦を含む） means "part of the ingredients CONTAINS milk components and wheat" — 〜を含む asserts PRESENCE. Every allergen such a summary declares is a directMatch with that summary as its source; do NOT soften 含む into "may contain" and do NOT leave a declared allergen out of directMatches just because you could not spot it inside the ingredient enumeration itself (the summary exists precisely to declare it authoritatively). The same applies to English "Contains: milk, wheat" lines, Chinese 过敏原信息：含有小麦、乳制品 summaries, and EU labels that bold allergens. Cross-contact statements are different and stay advisories: Japanese cross-contact reads like 同じ製造ラインで／同じ工場で〜を含む製品を製造 ("made on a line / in a factory that also handles X").

COMPOSITE FOODS — distinguish these three cases precisely when deciding directMatches:
  1. REQUIRED inference: when the label prints the name of a food, dish, or preparation whose standard recipe ALWAYS contains an allergen, that allergen IS a directMatch even though the allergen word itself is not printed (with the printed dish name as its "source" — needing to fill in source is never a reason to skip the inference). "Marzipan" IS almonds (tree nuts). "Satay" is peanut-based. "Mayonnaise" contains egg. "Seitan" IS wheat gluten. "Brioche" contains wheat, butter (dairy), and egg. "Worcestershire sauce" contains anchovies (fish). Recognizing the known composition of a printed name is reading the label, not inventing.
  2. FORBIDDEN invention: never report a directMatch for an ingredient that is neither printed on the label nor entailed by a printed name. Do not report dairy on a dark chocolate just because chocolate products often contain milk. Never guess at text you cannot actually read in the image.
  3. UNCERTAIN composition: if a printed name only SOMETIMES contains an allergen (for example "nougat" may contain egg white, "curry paste" may contain shellfish), do not silently clear it: if the allergen is on the user's SEVERE list and the food usually contains it, report it as a directMatch; otherwise state the possibility explicitly in reasoning (do not fabricate an advisory statement that wasn't actually printed).

Other rules:
- Use the EXACT allergen labels from the user's lists (matched verbatim) in both directMatches and advisories.
- The label may be in any language. Match ingredients to the user's allergens by MEANING across languages (for example the French/Spanish words for peanut, milk, wheat, or soy all count as matches for the English allergens). List items in the "ingredients" array in English so the user can read them, but keep directMatches/advisories using the user's exact allergen labels verbatim.`;
}

type SupportedMediaType =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "image/gif";

interface RequestBody {
  imageDataUrl: string;
  allergens: Allergen[];
  flagMayContain?: boolean;
}

/**
 * Shape of the model's raw JSON. Note there is deliberately no "flagged" or
 * "safe" field here — the model reports two independent evidence channels
 * (directMatches, advisories) and whether the image was readable; the
 * server alone turns that into flaggedAllergies/flaggedIntolerances/status
 * (audit fix H1). This is what makes the flagMayContain toggle actually
 * deterministic: the model cannot route around it by putting an
 * advisory-only allergen straight into a "flagged" field, because no such
 * field exists in what it's asked to produce.
 */
type ModelScanJson = {
  ingredients: string[];
  directMatches: unknown[];
  advisories: unknown[];
  readable: boolean;
  reasoning: string;
};

function isValidModelJson(x: unknown): x is ModelScanJson {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    Array.isArray(o.ingredients) &&
    o.ingredients.every((i) => typeof i === "string") &&
    Array.isArray(o.directMatches) &&
    Array.isArray(o.advisories) &&
    typeof o.readable === "boolean" &&
    typeof o.reasoning === "string"
  );
}

/**
 * Matches a model-reported allergen name (from directMatches or advisories)
 * back onto the user's submitted profile (case-insensitive, then token-set
 * fallback for wording drift like "Wheat / Gluten" vs "Gluten / Wheat").
 * Entries that don't map onto the profile are dropped — we only ever
 * surface matches for allergens the user actually asked to be watched, and
 * severity/tier always comes from OUR profile lookup, never from the model.
 */
function matchAllergenLabel(
  raw: string,
  allergens: Allergen[],
): Allergen | undefined {
  const ci = raw.trim().toLowerCase();
  const exact = allergens.find((a) => a.label.toLowerCase() === ci);
  if (exact) return exact;
  const tokens = (s: string) =>
    s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).sort().join("|");
  const rawTokens = tokens(raw);
  return allergens.find((a) => tokens(a.label) === rawTokens);
}

/**
 * Known mistranslation traps: foreign label terms Haiku reliably translates
 * to the WRONG allergen even when the prompt corrects it ("Vollei" became
 * "Whey" in 16 of 17 observed runs despite an explicit trap-table
 * instruction, 2026-07-14). The ingredients array preserves original printed
 * words in parentheses, so this deterministic sweep catches what the
 * model's translation habit drops. Additive only: it can add a missed
 * directMatch, never remove or downgrade one, so its worst failure mode is
 * an extra warning, never a false "clear".
 */
const TRANSLATION_TRAPS: ReadonlyArray<{ term: string; allergenLabel: string }> = [
  { term: "vollei", allergenLabel: "Eggs" },
  // Dairy: compound/callout forms only. Deliberately NOT bare 乳 or 奶粉:
  // 豆乳 (soy milk) and 豆奶粉 (soy milk powder) contain them and are
  // dairy-free, so those would false-positive.
  { term: "全粉乳", allergenLabel: "Dairy" },
  { term: "乳成分", allergenLabel: "Dairy" },
  { term: "全脂奶粉", allergenLabel: "Dairy" },
  { term: "牛乳", allergenLabel: "Dairy" },
  { term: "牛奶", allergenLabel: "Dairy" },
  { term: "小麦", allergenLabel: "Gluten / Wheat" },
  { term: "卵", allergenLabel: "Eggs" },
  { term: "鸡蛋", allergenLabel: "Eggs" },
  { term: "ピーナッツ", allergenLabel: "Peanuts" },
  { term: "落花生", allergenLabel: "Peanuts" },
  { term: "花生", allergenLabel: "Peanuts" },
  { term: "大豆", allergenLabel: "Soy" },
  { term: "黄豆", allergenLabel: "Soy" },
  { term: "ごま", allergenLabel: "Sesame" },
  { term: "胡麻", allergenLabel: "Sesame" },
  { term: "芝麻", allergenLabel: "Sesame" },
  { term: "fruits a coque", allergenLabel: "Tree nuts" },
  { term: "frutos de cascara", allergenLabel: "Tree nuts" },
];

/** Lowercase + strip accents so "à coque"/"cáscara" compare predictably. */
function normalizeForTrap(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/** Loose word tokens for the evidence checks below. */
function tokensOf(s: string): string[] {
  return s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

/** Singular/plural-tolerant token comparison ("nut" matches "nuts"). */
function tokenMatches(a: string, b: string): boolean {
  return a.startsWith(b) || b.startsWith(a);
}

/**
 * Extracts directMatches entries, matched against the profile, with two
 * deterministic vetoes on the model's own cited evidence (audit fix
 * 2026-07-13). Both vetoes only ever REMOVE a flag the model claimed; they
 * can never add one, and an entry with no source at all is KEPT — when the
 * evidence can't be inspected we stay on the cautious side.
 *
 * Why this exists: after the advisories channel got its free-from backstop,
 * the same live false positive came back through THIS channel — the model
 * put the "tree nut free facility" allergen straight into directMatches,
 * which carried no evidence text to check. So now it must cite its source,
 * and the server vetoes:
 *   1. a source that is itself a free-from/absence statement;
 *   2. a bare echo — the source is just the allergen's own name and no
 *      detected ingredient supports it, the signature of the model quoting
 *      the allergen word from somewhere outside the ingredients list.
 */
function matchedDirectEntries(
  raw: unknown[],
  allergens: Allergen[],
  ingredients: string[],
): { direct: Allergen[]; rechanneled: Advisory[] } {
  const ingredientTokens = ingredients.flatMap(tokensOf);
  const direct: Allergen[] = [];
  const rechanneled: Advisory[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const r = item as Record<string, unknown>;
    if (typeof r.allergen !== "string") continue;
    const matched = matchAllergenLabel(r.allergen, allergens);
    if (!matched) continue;

    const source = typeof r.source === "string" ? r.source.trim() : "";
    if (source) {
      if (isFreeFromReassurance(source)) {
        console.warn(
          `[/api/scan] dropped directMatch citing a free-from statement: "${source}" (${matched.label})`,
        );
        continue;
      }
      // A risk sentence cited as a direct source means the model misfiled a
      // cross-contact advisory into the ingredients channel. Reroute instead
      // of trusting or dropping: as an advisory it still warns, but the
      // flagMayContain setting governs it the way the user chose (the T10
      // leak: with the toggle OFF, a misfiled "may contain sesame" was
      // flagging unconditionally because directs always flag).
      if (looksLikeRiskStatement(source)) {
        console.warn(
          `[/api/scan] rechanneled directMatch citing a risk statement into advisories: "${source}" (${matched.label})`,
        );
        rechanneled.push({
          allergen: matched.label,
          severity: matched.severity,
          phrase: source,
        });
        continue;
      }
      const srcTokens = tokensOf(source);
      const labelTokens = tokensOf(matched.label);
      const isBareEcho =
        srcTokens.length > 0 &&
        srcTokens.every((t) => labelTokens.some((lt) => tokenMatches(t, lt))) &&
        !srcTokens.some((t) =>
          ingredientTokens.some((ing) => tokenMatches(t, ing)),
        );
      if (isBareEcho) {
        console.warn(
          `[/api/scan] dropped directMatch with no ingredient support: "${source}" (${matched.label})`,
        );
        continue;
      }
    }
    direct.push(matched);
  }
  return { direct, rechanneled };
}

/**
 * Deterministic backstop for the free-from false positive (task 2026-07-08).
 * The prompt tells the model that "free from X" / "X-free facility" statements
 * are reassurances, not advisories — but the model still slips ~1 in 8, and a
 * false cross-contact flag on a product a label calls SAFE is exactly the kind
 * of thing that erodes trust. So we also enforce it in code.
 *
 * An advisory's `phrase` is kept only if it reads like a RISK statement. We
 * drop it when it asserts ABSENCE and carries no risk language. The
 * risk-marker check is deliberately first and permissive: a genuine advisory
 * that happens to also say something is "X-free" (e.g. "may contain nuts;
 * gluten free") keeps its risk marker and is never dropped. We only drop the
 * pure-reassurance case, so this can never hide a real "may contain".
 */
/**
 * True when a phrase reads like a cross-contact RISK statement ("may
 * contain", "traces of", "shared equipment", in several languages). Shared
 * by isFreeFromReassurance (risk language means it's a genuine advisory,
 * never a reassurance) and by matchedDirectEntries (risk language cited as
 * a directMatch source means the match belongs in the advisories channel).
 */
function looksLikeRiskStatement(phrase: string): boolean {
  return /may\s+contain|trace|shared|also\s+(process|handle|manufactur)|\bprocess(es|ed)?\b|\bhandles?\b|peut\s+contenir|puede\s+contener|kann\s+spuren|可能含有|混入/.test(
    phrase.toLowerCase(),
  );
}

function isFreeFromReassurance(phrase: string): boolean {
  if (looksLikeRiskStatement(phrase)) return false;
  const assertsAbsence =
    /free[-\s]?(from|of)\b|[a-z]+[-\s]free\b|free\s+facilit|does\s+not\s+contain|contains?\s+no\b|dedicated.*\bfree\b/.test(
      phrase.toLowerCase(),
    );
  return assertsAbsence;
}

function extractJsonObject(rawText: string): unknown {
  const full = "{" + rawText;
  const start = full.indexOf("{");
  const end = full.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("No JSON object found in AI response");
  }
  return JSON.parse(full.slice(start, end + 1));
}

export async function POST(request: Request) {
  const blocked = await requireSessionInProduction();
  if (blocked) return blocked;

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          "Server missing ANTHROPIC_API_KEY. Add it to .env.local and restart the dev server.",
      },
      { status: 500 },
    );
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { imageDataUrl, allergens, flagMayContain = true } = body;
  if (!imageDataUrl?.startsWith("data:image/")) {
    return NextResponse.json(
      { error: "imageDataUrl must be a base64 image data URL" },
      { status: 400 },
    );
  }
  if (!Array.isArray(allergens) || allergens.length === 0) {
    return NextResponse.json(
      { error: "No allergens provided. Set up your profile first." },
      { status: 400 },
    );
  }

  const match = imageDataUrl.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
  if (!match) {
    return NextResponse.json(
      { error: "Could not parse image data URL" },
      { status: 400 },
    );
  }
  const mediaType = match[1] as SupportedMediaType;
  const base64Data = match[2];

  const client = new Anthropic();

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64Data,
              },
            },
            {
              type: "text",
              text: buildUserPrompt(allergens),
            },
          ],
        },
        { role: "assistant", content: "{" },
      ],
    });

    const { input_tokens, output_tokens } = message.usage;
    const inputCost = (input_tokens / 1_000_000) * 1.0;
    const outputCost = (output_tokens / 1_000_000) * 5.0;
    console.log(
      `[/api/scan] usage: ${input_tokens} in + ${output_tokens} out = $${(inputCost + outputCost).toFixed(5)}`,
    );

    const firstBlock = message.content[0];
    const rawText =
      firstBlock && firstBlock.type === "text" ? firstBlock.text : "";

    let parsed: unknown;
    try {
      parsed = extractJsonObject(rawText);
    } catch (e) {
      console.error("[/api/scan] JSON parse failed:", rawText, e);
      return NextResponse.json(
        { error: "Couldn't parse the AI response. Try again." },
        { status: 502 },
      );
    }

    if (!isValidModelJson(parsed)) {
      console.error("[/api/scan] Invalid response shape:", parsed);
      return NextResponse.json(
        { error: "The AI response was missing fields. Try again." },
        { status: 502 },
      );
    }

    // Derive flaggedAllergies/flaggedIntolerances/advisories entirely
    // server-side from the model's two raw evidence channels (audit fix
    // H1). The model never sees a "flagged" field to populate, so it
    // cannot route an advisory-only allergen into the flagged arrays no
    // matter how it interprets "be conservative" — that decision, and the
    // severity tier itself, come only from OUR profile lookup here.
    const { direct: directAllergens, rechanneled } = matchedDirectEntries(
      parsed.directMatches,
      allergens,
      parsed.ingredients,
    );

    // Deterministic reconciliation for known mistranslation traps (see
    // TRANSLATION_TRAPS): the ingredients array preserves original printed
    // words, so a trap term appearing in a genuine ingredient entry adds
    // its allergen to the direct channel if the model's translation dropped
    // it. Entries that read like advisories or free-from statements are
    // skipped: a trap word inside "may contain..." belongs to the advisory
    // channel and one inside "free from..." belongs nowhere.
    for (const entry of parsed.ingredients) {
      if (looksLikeRiskStatement(entry) || isFreeFromReassurance(entry)) continue;
      const entryNorm = normalizeForTrap(entry);
      for (const trap of TRANSLATION_TRAPS) {
        if (!entryNorm.includes(normalizeForTrap(trap.term))) continue;
        const onProfile = matchAllergenLabel(trap.allergenLabel, allergens);
        if (!onProfile) continue;
        if (directAllergens.some((a) => a.label === onProfile.label)) continue;
        console.warn(
          `[/api/scan] reconciliation: added ${onProfile.label} from trap term "${trap.term}" in ingredient "${entry}"`,
        );
        directAllergens.push(onProfile);
      }
    }

    const advisories: Advisory[] = [];
    for (const raw of parsed.advisories) {
      if (typeof raw !== "object" || raw === null) continue;
      const r = raw as Record<string, unknown>;
      if (typeof r.allergen !== "string" || typeof r.phrase !== "string")
        continue;
      const matched = matchAllergenLabel(r.allergen, allergens);
      if (!matched) continue; // not one of the user's own allergens — drop
      if (isFreeFromReassurance(r.phrase)) {
        // Label says this allergen is ABSENT (free-from); not a risk.
        console.warn(
          `[/api/scan] dropped free-from reassurance mis-reported as advisory: "${r.phrase.trim()}"`,
        );
        continue;
      }
      advisories.push({
        allergen: matched.label,
        severity: matched.severity,
        phrase: r.phrase.trim(),
      });
    }

    // Advisories the model misfiled as direct matches (risk sentence cited
    // as source) rejoin the advisory channel here, deduped against ones the
    // model also reported normally.
    for (const adv of rechanneled) {
      if (!advisories.some((a) => a.allergen === adv.allergen)) {
        advisories.push(adv);
      }
    }

    const flaggedAllergies = [
      ...new Set(
        directAllergens
          .filter((a) => a.severity === "allergy")
          .map((a) => a.label),
      ),
    ];
    const flaggedIntolerances = [
      ...new Set(
        directAllergens
          .filter((a) => a.severity === "intolerance")
          .map((a) => a.label),
      ),
    ];

    if (flagMayContain) {
      for (const adv of advisories) {
        if (adv.severity === "allergy") {
          if (!flaggedAllergies.includes(adv.allergen))
            flaggedAllergies.push(adv.allergen);
        } else if (!flaggedIntolerances.includes(adv.allergen)) {
          flaggedIntolerances.push(adv.allergen);
        }
      }
    }

    // Derive the verdict server-side (audit C1); never trust the model's
    // own safety judgment directly (audit M2). Safety-asymmetric: when
    // signals conflict, the more cautious one wins.
    //   any flags                  -> "flagged" (even if the model said readable)
    //   no flags + readable=false  -> "unreadable" (model couldn't verify)
    //   no flags + readable=true   -> "clear"
    const status: ScanStatus =
      flaggedAllergies.length > 0 || flaggedIntolerances.length > 0
        ? "flagged"
        : parsed.readable === false
          ? "unreadable"
          : "clear";

    const result: ScanResult = {
      ingredients: parsed.ingredients,
      flaggedAllergies,
      flaggedIntolerances,
      advisories,
      reasoning: parsed.reasoning,
      status,
      safe: status === "clear",
    };
    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/scan] Anthropic error:", err);
    const errorMessage =
      err instanceof Error ? err.message : "Unknown AI service error";
    return NextResponse.json(
      { error: `AI service error: ${errorMessage}` },
      { status: 502 },
    );
  }
}
