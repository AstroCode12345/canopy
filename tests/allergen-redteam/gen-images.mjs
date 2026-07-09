// Renders the red-team label fixtures (cases.json -> images/<id>.jpg).
// Layout intentionally mirrors the July 2026 audit's in-browser renderer so
// results stay comparable across sessions.
//
//   node tests/allergen-redteam/gen-images.mjs
//
// Requires devDependency @napi-rs/canvas. Re-run only when a case's
// labelLines change; committed JPEGs are the source of record for runs.

import { createCanvas } from "@napi-rs/canvas";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const { cases } = JSON.parse(readFileSync(join(here, "cases.json"), "utf8"));
mkdirSync(join(here, "images"), { recursive: true });

let count = 0;
for (const c of cases) {
  if (c.kind !== "live" || c.imageFrom) continue; // T10 reuses T9's image
  const lines = c.labelLines ?? [];
  const canvas = createCanvas(900, 240 + lines.length * 46);
  const g = canvas.getContext("2d");

  g.fillStyle = c.blank ? "#b9b3a8" : "#f7f4ec";
  g.fillRect(0, 0, canvas.width, canvas.height);

  if (!c.blank) {
    g.fillStyle = "#111111";
    g.font = "bold 40px Arial";
    g.fillText("INGREDIENTS", 48, 90);
    g.fillRect(48, 110, 804, 4);
    const hasCJK = (s) => /[　-鿿＀-￯]/.test(s);
    lines.forEach((ln, i) => {
      // Arial has no CJK glyphs; fall back to a system CJK font per line.
      // Keep CJK at regular weight 31px: bolder/larger renders made Haiku
      // MORE likely to confuse 全粉乳 (milk powder) with 全粒粉 (whole wheat).
      g.font = hasCJK(ln) ? '31px "Hiragino Sans"' : "31px Arial";
      g.fillText(ln, 48, 170 + i * 46);
    });
  }

  const file = join(here, "images", `${c.id}.jpg`);
  writeFileSync(file, canvas.toBuffer("image/jpeg", 90));
  count++;
  console.log(`rendered ${c.id}.jpg (${lines.length} lines)`);
}
console.log(`\n${count} images written to tests/allergen-redteam/images/`);
