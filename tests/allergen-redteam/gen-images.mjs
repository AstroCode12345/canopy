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

  // Optional per-case render distortions (OCR-stress category). Every field
  // is optional and absent on all pre-existing cases, so their images
  // regenerate byte-identically:
  //   render.textColor  : override ink color (low-contrast stress)
  //   render.rotate     : degrees, rotates the whole text block
  //   render.occlude    : [{x,y,w,h,kind:"thumb"|"glare"}] drawn over text
  //   render.blurScale  : 0..1 downscale-then-upscale blur (lower = blurrier)
  const r = c.render ?? {};

  g.fillStyle = c.blank ? "#b9b3a8" : "#f7f4ec";
  g.fillRect(0, 0, canvas.width, canvas.height);

  if (!c.blank) {
    if (r.rotate) {
      g.save();
      g.translate(canvas.width / 2, canvas.height / 2);
      g.rotate((r.rotate * Math.PI) / 180);
      g.translate(-canvas.width / 2, -canvas.height / 2);
    }
    g.fillStyle = r.textColor ?? "#111111";
    g.font = "bold 40px Arial";
    g.fillText("INGREDIENTS", 48, 90);
    g.fillRect(48, 110, 804, 4);
    const hasCJK = (s) => /[　-鿿＀-￯]/.test(s);
    const hasArabic = (s) => /[؀-ۿ]/.test(s);
    lines.forEach((ln, i) => {
      // Arial has no CJK glyphs; fall back to system fonts per line.
      // Hiragino Sans covers Japanese; Hiragino Sans GB fills the
      // Simplified-Chinese-only characters it lacks (鸡, 盐, 坚 — these
      // render as tofu boxes without it); Geeza Pro covers Arabic. Keep
      // CJK at regular weight 31px: bolder/larger renders made Haiku MORE
      // likely to confuse 全粉乳 (milk powder) with 全粒粉 (whole wheat).
      g.font = hasCJK(ln)
        ? '31px "Hiragino Sans", "Hiragino Sans GB"'
        : hasArabic(ln)
          ? '31px "Geeza Pro", Arial'
          : "31px Arial";
      g.fillText(ln, 48, 170 + i * 46);
    });
    if (r.rotate) g.restore();

    for (const o of r.occlude ?? []) {
      if (o.kind === "glare") {
        // Washed-out specular highlight, like plastic film catching light.
        const grad = g.createRadialGradient(
          o.x + o.w / 2, o.y + o.h / 2, 8,
          o.x + o.w / 2, o.y + o.h / 2, Math.max(o.w, o.h) / 2,
        );
        grad.addColorStop(0, "rgba(255,255,255,0.98)");
        grad.addColorStop(1, "rgba(255,255,255,0.25)");
        g.fillStyle = grad;
        g.fillRect(o.x, o.y, o.w, o.h);
      } else {
        // Default: opaque thumb-over-the-label blob.
        g.fillStyle = "#d8c0a8";
        g.beginPath();
        g.ellipse(o.x + o.w / 2, o.y + o.h / 2, o.w / 2, o.h / 2, 0.3, 0, Math.PI * 2);
        g.fill();
      }
    }
  }

  let out = canvas;
  if (r.blurScale && !c.blank) {
    // Downscale-then-upscale blur: reliable everywhere, no filter API needed.
    const small = createCanvas(
      Math.max(1, Math.round(canvas.width * r.blurScale)),
      Math.max(1, Math.round(canvas.height * r.blurScale)),
    );
    small.getContext("2d").drawImage(canvas, 0, 0, small.width, small.height);
    out = createCanvas(canvas.width, canvas.height);
    out.getContext("2d").drawImage(small, 0, 0, canvas.width, canvas.height);
  }

  const file = join(here, "images", `${c.id}.jpg`);
  writeFileSync(file, out.toBuffer("image/jpeg", 90));
  count++;
  console.log(`rendered ${c.id}.jpg (${lines.length} lines)`);
}
console.log(`\n${count} images written to tests/allergen-redteam/images/`);
