import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import type { Allergen, ScanResult } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 30;

const SYSTEM_PROMPT = `You are Canopy, an allergen scanner that helps users with food sensitivities check labels. You analyze food packaging photos and check ingredients against the user's allergen list. The user splits their sensitivities into two severity tiers: ALLERGIES (severe — they must avoid completely) and INTOLERANCES (mild — they want to be aware). Always respond with valid JSON only — no markdown fences, no commentary outside the JSON. Be conservative: when in doubt, flag it.`;

function buildUserPrompt(allergens: Allergen[], flagMayContain: boolean) {
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

Analyze this food label image. The label may be written in ANY language (English, Spanish, French, Japanese, and so on); read it regardless of language. Carefully identify every single ingredient you can read. For each user sensitivity, check whether it (or any common alias/derivative — e.g., "whey", "casein", "lactose" for dairy; "albumin" for eggs; "tahini" for sesame; "soya", "lecithin" for soy; "semolina", "spelt", "durum" for gluten/wheat) appears in the ingredients.

Return ONLY this JSON object (no other text):
{
  "ingredients": ["every ingredient you can read"],
  "flaggedAllergies": ["labels from the user's ALLERGY list that matched"],
  "flaggedIntolerances": ["labels from the user's INTOLERANCE list that matched"],
  "safe": true only if BOTH flaggedAllergies AND flaggedIntolerances are empty,
  "reasoning": "2-4 short sentences. Briefly explain what you found ingredient-by-ingredient. If both flagged lists are empty, you MUST include the phrase 'No allergens detected, but please double-check the physical label.' If anything is flagged, name which ingredient maps to which user sensitivity."
}

Rules:
${
  flagMayContain
    ? `- "May contain traces of X" or "Manufactured in a facility with X" counts as flagging X.`
    : `- "May contain traces of X" or "Manufactured in a facility with X" are precautionary advisories only. Do NOT add them to the flagged lists, but DO mention any such advisory in reasoning so the user is aware.`
}
- If the image is too blurry, partially cut off, or no ingredients are visible: set safe=false, set ingredients=[], set both flagged lists=[], and explain in reasoning that the image isn't clear enough for a reliable safety check.
- Use the EXACT allergen labels from the user's lists (matched verbatim) when populating the flagged arrays.
- Never invent ingredients that aren't clearly visible.
- If the same matched ingredient could apply to both an allergy and an intolerance, put it under the ALLERGY (severe wins).
- The label may be in any language. Match ingredients to the user's allergens by MEANING across languages (for example the French/Spanish words for peanut, milk, wheat, or soy all count as matches for the English allergens). List items in the "ingredients" array in English so the user can read them, but keep the flagged arrays using the user's exact allergen labels verbatim.`;
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

function isValidScanResult(x: unknown): x is ScanResult {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    Array.isArray(o.ingredients) &&
    o.ingredients.every((i) => typeof i === "string") &&
    Array.isArray(o.flaggedAllergies) &&
    o.flaggedAllergies.every((i) => typeof i === "string") &&
    Array.isArray(o.flaggedIntolerances) &&
    o.flaggedIntolerances.every((i) => typeof i === "string") &&
    typeof o.safe === "boolean" &&
    typeof o.reasoning === "string"
  );
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
              text: buildUserPrompt(allergens, flagMayContain),
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

    if (!isValidScanResult(parsed)) {
      console.error("[/api/scan] Invalid response shape:", parsed);
      return NextResponse.json(
        { error: "The AI response was missing fields. Try again." },
        { status: 502 },
      );
    }

    return NextResponse.json(parsed);
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
