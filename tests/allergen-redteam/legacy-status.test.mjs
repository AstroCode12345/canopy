// Unit check for the read-time status fallback (audit C1, legacy-data rule).
// No live API, no dev server. Run via:
//   npm run redteam:unit
// (uses --experimental-strip-types to import the real lib/storage.ts,
// so the test exercises the exact production function, not a copy)

import {
  scanStatusOf,
  resultVerdict,
} from "../../src/lib/storage.ts";

let failures = 0;
function check(name, actual, expected) {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`);
}

const base = { ingredients: [], reasoning: "" };

// --- Legacy records: no status field. Must resolve to clear/flagged only,
// never "unreadable", and never throw. ---
check(
  "legacy: safe=true, no flags -> clear",
  scanStatusOf({ ...base, safe: true, flaggedAllergies: [], flaggedIntolerances: [] }),
  "clear",
);
check(
  // The honest-ambiguity rule: an old safe=false empty-arrays record MIGHT
  // have been unreadable, but we cannot know retroactively, so it must NOT
  // be relabeled "unreadable".
  "legacy: safe=false, no flags -> clear (never unreadable)",
  scanStatusOf({ ...base, safe: false, flaggedAllergies: [], flaggedIntolerances: [] }),
  "clear",
);
check(
  "legacy: allergy flagged -> flagged",
  scanStatusOf({ ...base, safe: false, flaggedAllergies: ["Peanuts"], flaggedIntolerances: [] }),
  "flagged",
);
check(
  "legacy: intolerance flagged -> flagged",
  scanStatusOf({ ...base, safe: false, flaggedAllergies: [], flaggedIntolerances: ["Soy"] }),
  "flagged",
);

// --- Modern records: explicit status honored, cautious signal wins. ---
check(
  "modern: status=unreadable -> unreadable",
  scanStatusOf({ ...base, status: "unreadable", safe: false, flaggedAllergies: [], flaggedIntolerances: [] }),
  "unreadable",
);
check(
  "conflict: status=unreadable BUT flags present -> flagged (cautious wins)",
  scanStatusOf({ ...base, status: "unreadable", safe: false, flaggedAllergies: ["Eggs"], flaggedIntolerances: [] }),
  "flagged",
);
check(
  "conflict: status=clear BUT flags present -> flagged (cautious wins)",
  scanStatusOf({ ...base, status: "clear", safe: true, flaggedAllergies: ["Eggs"], flaggedIntolerances: [] }),
  "flagged",
);

// --- resultVerdict tier split on top of status ---
check(
  "verdict: unreadable passes through",
  resultVerdict({ ...base, status: "unreadable", safe: false, flaggedAllergies: [], flaggedIntolerances: [] }),
  "unreadable",
);
check(
  "verdict: allergy tier wins over intolerance",
  resultVerdict({ ...base, safe: false, flaggedAllergies: ["Eggs"], flaggedIntolerances: ["Soy"] }),
  "allergy",
);
check(
  "verdict: intolerance-only tier",
  resultVerdict({ ...base, safe: false, flaggedAllergies: [], flaggedIntolerances: ["Soy"] }),
  "intolerance",
);

console.log(
  failures === 0
    ? `\nlegacy-status: all checks passed`
    : `\nlegacy-status: ${failures} check(s) FAILED`,
);
process.exit(failures ? 1 : 0);
