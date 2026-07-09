// Allergen red-team regression runner.
//
//   npm run redteam            (dev server must be running on port 3002)
//   SCAN_URL=... npm run redteam   to point at another deployment
//
// Sends every live fixture through POST /api/scan (the exact production
// path: prompt build -> Haiku vision -> parse -> validate) and compares the
// response against each fixture's expectations. Exit code 1 if any case
// FAILs. Model calls are Haiku-priced; a full run costs a few cents.
//
// Verdict semantics (safety-asymmetric by design):
//   FAIL = a required allergen was NOT flagged (false-negative direction),
//          a forbidden allergen WAS flagged (T11 canary / T10 advisory
//          merge), an expectSafe/expectEmptyArrays/expectStatus/
//          expectAdvisories contract broke, an error-path case returned 200,
//          OR a label landed in the wrong severity array / both arrays
//          (H2 — fixed 2026-07-02, now a hard regression guard, not a WARN).
//   WARN = known out-of-scope defects we track but do not fail on:
//          warnIfFlagged hits (M1, e.g. sunflower lecithin -> Soy on T3).
//   SKIP = kind:"manual" cases traced in the audit but not automatable here.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SCAN_URL = process.env.SCAN_URL ?? "http://localhost:3002/api/scan";
const parsed = JSON.parse(readFileSync(join(here, "cases.json"), "utf8"));
const profile = parsed.profile;
// Optional case filter: `npm run redteam -- T7 T12` runs only those ids.
const only = process.argv.slice(2).filter((a) => /^T\d+$/i.test(a));
const cases = only.length
  ? parsed.cases.filter((c) => only.includes(c.id))
  : parsed.cases;

const tierOf = new Map(
  profile.map((a) => [a.label.toLowerCase(), a.severity]),
);
const norm = (s) => s.trim().toLowerCase();

async function post(body) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 90_000);
  try {
    const res = await fetch(SCAN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    return { status: res.status, json: await res.json().catch(() => ({})) };
  } finally {
    clearTimeout(t);
  }
}

function evaluate(c, status, json) {
  const problems = [];
  const warns = [];

  if (c.kind === "error-path") {
    if (status === 200)
      problems.push(`expected an error response, got 200 with a verdict`);
    return { problems, warns };
  }

  if (status !== 200) {
    problems.push(`HTTP ${status}: ${json.error ?? "unknown error"}`);
    return { problems, warns };
  }

  const A = (json.flaggedAllergies ?? []).map(norm);
  const I = (json.flaggedIntolerances ?? []).map(norm);
  const union = new Set([...A, ...I]);

  // Token-set fallback so "Wheat / Gluten" would still count as detecting
  // the profile label "Gluten / Wheat" if label wording ever drifted again
  // (T19). As of 2026-07-02 this SHOULD be structurally impossible: server
  // output always uses the profile's own canonical label string (see
  // matchAllergenLabel() in route.ts), never the model's wording, so this
  // path is now a defensive net, not an expected condition. If it ever
  // fires, treat the WARN as a real signal worth investigating, not noise.
  const tokens = (s) =>
    norm(s).split(/[^a-z0-9]+/).filter(Boolean).sort().join("|");
  const unionTokens = new Set([...union].map(tokens));

  for (const req of c.required ?? []) {
    if (union.has(norm(req))) continue;
    if (unionTokens.has(tokens(req))) {
      warns.push(
        `UNEXPECTED label drift (T19, should be structurally impossible since 2026-07-02): "${req}" detected but returned with different wording`,
      );
      continue;
    }
    problems.push(`missing required flag: ${req}`);
  }
  for (const bad of c.forbidden ?? []) {
    if (union.has(norm(bad))) problems.push(`forbidden allergen flagged: ${bad}`);
  }
  for (const w of c.warnIfFlagged ?? []) {
    if (union.has(norm(w)))
      warns.push(`known over-flag (tracked, out of scope): ${w}`);
  }

  if (c.expectSafe === true && json.safe !== true)
    problems.push(`expected safe=true, got ${json.safe}`);
  if (c.expectSafe === false && json.safe !== false)
    problems.push(`expected safe=false, got ${json.safe}`);
  if (c.expectEmptyArrays && union.size > 0)
    problems.push(`expected empty flag arrays, got [${[...union].join(", ")}]`);
  if (c.expectStatus && json.status !== c.expectStatus)
    problems.push(
      `expected status="${c.expectStatus}", got ${JSON.stringify(json.status)}` +
        (c.expectStatus === "unreadable" && json.status === "clear"
          ? " (C1 REGRESSION: unreadable photo reported as clear)"
          : ""),
    );

  if (c.expectAdvisories) {
    const advisoryAllergens = new Set(
      (Array.isArray(json.advisories) ? json.advisories : [])
        .map((a) => (a && typeof a.allergen === "string" ? norm(a.allergen) : null))
        .filter(Boolean),
    );
    for (const a of c.expectAdvisories) {
      if (!advisoryAllergens.has(norm(a)))
        problems.push(
          `expected "${a}" in advisories[] (H1 channel), got [${[...advisoryAllergens].join(", ")}]`,
        );
    }
  }

  // Tier drift / duplicate placement (H2, FIXED 2026-07-02): severity now
  // comes exclusively from a server-side profile lookup (matchAllergenLabel
  // in route.ts), so a label landing in the wrong array or in both arrays
  // is architecturally impossible, not just unlikely. These are hard FAILs
  // now — a real regression, not a tracked/known issue.
  for (const l of A)
    if (tierOf.get(l) === "intolerance")
      problems.push(`H2 REGRESSION: "${l}" is a mild intolerance but returned as severe`);
  for (const l of I)
    if (tierOf.get(l) === "allergy")
      problems.push(`H2 REGRESSION: "${l}" is a severe allergy but returned as mild`);
  for (const l of A)
    if (I.includes(l)) problems.push(`H2 REGRESSION: "${l}" returned in BOTH arrays`);

  return { problems, warns };
}

// ---------- main ----------
const results = [];
console.log(`\nAllergen red-team regression  ->  ${SCAN_URL}\n`);

// Preflight: server up + API key present (invalid body must yield 400, not 500).
try {
  const pre = await fetch(SCAN_URL, { method: "POST", body: "nope" });
  if (pre.status === 500) {
    console.error("Preflight: server responded 500 - is ANTHROPIC_API_KEY set?");
    process.exit(1);
  }
} catch {
  console.error(`Preflight: cannot reach ${SCAN_URL}. Start the dev server first (port 3002).`);
  process.exit(1);
}

for (const c of cases) {
  if (c.kind === "manual") {
    results.push({ c, verdict: "SKIP", detail: c.notes ?? "" });
    continue;
  }

  let body;
  if (c.kind === "error-path") {
    body = {
      imageDataUrl: "data:image/heic;base64,AAAAGGZ0eXBoZWljAAAAAA==",
      allergens: profile,
      flagMayContain: true,
    };
  } else {
    const imgId = c.imageFrom ?? c.id;
    const b64 = readFileSync(join(here, "images", `${imgId}.jpg`)).toString("base64");
    body = {
      imageDataUrl: `data:image/jpeg;base64,${b64}`,
      allergens: profile,
      flagMayContain: c.mayContain !== false,
    };
  }

  process.stdout.write(`${c.id}  ${c.title.slice(0, 58).padEnd(58)} `);
  try {
    const { status, json } = await post(body);
    const { problems, warns } = evaluate(c, status, json);
    const verdict = problems.length ? "FAIL" : "PASS";
    console.log(verdict + (warns.length ? `  (${warns.length} warn)` : ""));
    for (const p of problems) console.log(`      x ${p}`);
    for (const w of warns) console.log(`      ~ ${w}`);
    results.push({
      c,
      verdict,
      detail: problems.join("; "),
      flagged: status === 200
        ? { A: json.flaggedAllergies, I: json.flaggedIntolerances, safe: json.safe }
        : { httpStatus: status },
    });
  } catch (e) {
    console.log("FAIL");
    console.log(`      x request error: ${e.message}`);
    results.push({ c, verdict: "FAIL", detail: `request error: ${e.message}` });
  }
}

// ---------- summary ----------
const count = (v) => results.filter((r) => r.verdict === v).length;
const fails = results.filter((r) => r.verdict === "FAIL");
console.log(`\n${"-".repeat(72)}`);
console.log(
  `PASS ${count("PASS")}   FAIL ${count("FAIL")}   SKIP ${count("SKIP")}   (of ${results.length} cases)`,
);
if (fails.length) {
  console.log(`\nFailing cases:`);
  for (const r of fails) console.log(`  ${r.c.id}  ${r.c.title}\n      ${r.detail}`);
}
const regressions = fails.filter((r) => r.c.auditBaseline === "PASS");
if (regressions.length) {
  console.log(`\n!! ${regressions.length} case(s) passed the original audit but fail now (regression):`);
  for (const r of regressions) console.log(`   ${r.c.id}  ${r.c.title}`);
}
console.log("");
process.exit(fails.length ? 1 : 0);
