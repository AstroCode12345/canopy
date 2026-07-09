import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
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
      "meringue powder",
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
    aliases: ["krill", "prawn", "shrimp", "langoustine", "scampi", "crab", "lobster"],
    dishes: ["oyster sauce", "shrimp paste", "XO sauce", "bisque"],
  },
  {
    group: "Tree nuts",
    aliases: [
      "almond", "hazelnut", "cashew", "pistachio", "walnut", "pecan",
      "macadamia", "brazil nut", "nut paste", "nut flour", "nut oil",
    ],
    dishes: [
      "marzipan (almond)", "frangipane (almond)", "praline (hazelnut)",
      "gianduja (hazelnut)", "nougat (nuts)", "amaretto (almond)",
      "orgeat (almond)", "baklava", "hazelnut spread", "pesto (pine nuts)",
    ],
  },
  {
    group: "Peanuts",
    aliases: ["groundnut", "arachis oil", "peanut flour", "monkey nuts"],
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
    ],
    dishes: [
      "seitan (pure wheat gluten)", "panko", "udon", "soy sauce (brewed with wheat)",
      "brioche", "bread, pasta, and pastry unless explicitly gluten-free",
    ],
  },
  {
    group: "Soy",
    aliases: ["soya", "soy protein", "lecithin (E322)", "textured vegetable protein", "TVP"],
    dishes: ["tofu", "tempeh", "edamame", "miso", "natto", "soy sauce", "tamari"],
  },
  {
    group: "Sesame",
    aliases: ["benne", "sesame oil", "sesamol", "gomashio"],
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

Return ONLY this JSON object (no other text). Note what you are NOT asked for:
there is no "flagged" or "safe-to-eat" field for you to decide — you report
raw evidence only, in two separate channels, and something outside your
response turns that evidence into a verdict.
{
  "ingredients": ["every ingredient you can read"],
  "directMatches": [{ "allergen": "exact matching label from the user's list" }],
  "advisories": [{ "allergen": "exact matching label from the user's list", "phrase": "the source advisory text as read, e.g. may contain traces of peanuts" }],
  "readable": true only if the ingredients were clearly readable. If the image is blurry, cut off, or no ingredients are visible, this MUST be false and directMatches/advisories/ingredients MUST all be [],
  "reasoning": "2-4 short sentences. Briefly explain what you found ingredient-by-ingredient. If nothing matched, you MUST include the phrase 'No allergens detected, but please double-check the physical label.' If anything matched, name which ingredient maps to which user sensitivity. If there are advisories, mention them too."
}

directMatches vs advisories — these are TWO SEPARATE EVIDENCE CHANNELS, never combined by you. The test is WHERE on the label the word comes from, not just whether the word appears somewhere in the image:
- "directMatches": the allergen is part of the product's actual ingredients — named directly INSIDE THE INGREDIENTS LIST (or equivalent enumeration of what the product is made of), as an alias/derivative, or via composite-food inference (see COMPOSITE FOODS below). One entry per allergen that matches this way.
- "advisories": a SEPARATE cross-contact or precautionary SENTENCE about the allergen — "may contain traces of X", "manufactured in a facility that also processes X", "made on shared equipment with X" (in ANY language, e.g. French "Peut contenir..."), found anywhere on the packaging. One entry per such statement, with "phrase" as the source text.
- CRITICAL: if an allergen's name appears ONLY inside an advisory sentence like "may contain traces of X" and NOWHERE in the actual ingredients enumeration, that is advisory-only evidence — X goes ONLY in "advisories", never in "directMatches", even though the word "X" is technically printed on the packaging. The advisory sentence is not part of the ingredients list; reading the word there is not the same as the ingredient being present. Do not let the mere presence of the allergen's name anywhere in the printed text put it into directMatches — check specifically whether it is inside the ingredients enumeration itself.
  Worked example: a label's ingredients list is "Oat flakes, honey, dried cranberries, sunflower seeds, cinnamon." followed by the separate sentence "May contain traces of peanuts and sesame." Peanuts and sesame do NOT appear in the ingredients list — they appear only inside the advisory sentence. Correct output: directMatches = [] (empty — peanuts/sesame are not ingredients of this product), advisories = [{"allergen":"Peanuts","phrase":"May contain traces of peanuts and sesame"}, {"allergen":"Sesame","phrase":"..."}], and the "ingredients" array should list oat flakes/honey/dried cranberries/sunflower seeds/cinnamon only — do NOT add "peanuts" or "sesame" to the ingredients array either, since they are not actually ingredients of this product.
- If an allergen is both a real ingredient (appears in the ingredients enumeration) AND separately has an advisory sentence about it (unusual, but possible for e.g. "traces of egg" on a product that also lists egg directly), report it in BOTH arrays — each one independently, because each is independently true.
- Whether an advisory-only allergen also becomes a "flag" is a decision made entirely outside your response; your only job is to correctly locate WHERE each allergen name came from.

COMPOSITE FOODS — distinguish these three cases precisely when deciding directMatches:
  1. REQUIRED inference: when the label prints the name of a food, dish, or preparation whose standard recipe ALWAYS contains an allergen, that allergen IS a directMatch even though the allergen word itself is not printed. "Marzipan" IS almonds (tree nuts). "Satay" is peanut-based. "Mayonnaise" contains egg. "Seitan" IS wheat gluten. "Brioche" contains wheat, butter (dairy), and egg. "Worcestershire sauce" contains anchovies (fish). Recognizing the known composition of a printed name is reading the label, not inventing.
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

/** Extracts { allergen: string } entries from a raw model array, matched
 * against the profile. Shared by directMatches and advisories parsing. */
function matchedAllergenEntries(
  raw: unknown[],
  allergens: Allergen[],
): Allergen[] {
  const out: Allergen[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const r = item as Record<string, unknown>;
    if (typeof r.allergen !== "string") continue;
    const matched = matchAllergenLabel(r.allergen, allergens);
    if (matched) out.push(matched);
  }
  return out;
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
    const directAllergens = matchedAllergenEntries(
      parsed.directMatches,
      allergens,
    );

    const advisories: Advisory[] = [];
    for (const raw of parsed.advisories) {
      if (typeof raw !== "object" || raw === null) continue;
      const r = raw as Record<string, unknown>;
      if (typeof r.allergen !== "string" || typeof r.phrase !== "string")
        continue;
      const matched = matchAllergenLabel(r.allergen, allergens);
      if (!matched) continue; // not one of the user's own allergens — drop
      advisories.push({
        allergen: matched.label,
        severity: matched.severity,
        phrase: r.phrase.trim(),
      });
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
