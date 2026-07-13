import { NextResponse } from "next/server";
import {
  deriveBarcodeResult,
  type BarcodeLookupResult,
  type OffProduct,
} from "@/lib/barcode";
import type { Allergen } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 15;

// Open Food Facts asks API users to identify themselves. Their docs request
// an app name + a way to reach you, which matters because this is a free,
// volunteer-run database and they need to be able to contact misbehaving
// clients instead of banning them.
const OFF_USER_AGENT = "Canopy/0.1 (allergen scanner; taymourwkhan@gmail.com)";

// Only request the fields we read — smaller responses, and the lookup
// contract is explicit in one place.
const OFF_FIELDS = [
  "product_name",
  "brands",
  "image_front_small_url",
  "ingredients_text_en",
  "ingredients_text",
  "allergens_tags",
  "traces_tags",
].join(",");

interface RequestBody {
  barcode: string;
  allergens: Allergen[];
  flagMayContain?: boolean;
}

export async function POST(request: Request) {
  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { barcode, allergens, flagMayContain = true } = body;

  // Retail barcodes (EAN-8/13, UPC-A/E) are 8 to 14 digits. Validating here
  // also means the OFF URL below can only ever contain digits.
  if (typeof barcode !== "string" || !/^\d{8,14}$/.test(barcode)) {
    return NextResponse.json(
      { error: "barcode must be 8 to 14 digits" },
      { status: 400 },
    );
  }
  if (!Array.isArray(allergens) || allergens.length === 0) {
    return NextResponse.json(
      { error: "No allergens provided. Set up your profile first." },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=${OFF_FIELDS}`,
      {
        headers: { "User-Agent": OFF_USER_AGENT },
        // Product data changes rarely; let Vercel's fetch cache absorb
        // repeat lookups of the same product for a day.
        next: { revalidate: 86400 },
      },
    );

    // OFF returns 404 with status:0 in the body for unknown barcodes;
    // treat any non-OK response without a product as "not found" rather
    // than an error, since that's the common case for niche products.
    const data = (await res.json().catch(() => null)) as {
      status?: number;
      product?: OffProduct;
    } | null;

    const product =
      res.ok && data?.status === 1 && data.product ? data.product : null;

    const result: BarcodeLookupResult = deriveBarcodeResult(
      barcode,
      product,
      allergens,
      flagMayContain,
    );
    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/barcode] lookup failed:", err);
    return NextResponse.json(
      { error: "Couldn't reach the product database. Try again." },
      { status: 502 },
    );
  }
}
