# Allergen red-team regression suite

Reusable fixtures + runner for Canopy's allergen detection pipeline,
reconstructed from the July 2026 safety audit (cases T1-T20). Run this any
time `buildUserPrompt()`, the model, or the matching rules change.

## Run it

```bash
# 1. dev server must be running with ANTHROPIC_API_KEY in .env.local
npm run dev -- -p 3002

# 2. in another terminal
npm run redteam
```

Point at a deployed instance instead with `SCAN_URL=https://.../api/scan npm run redteam`.
A full run makes ~13 Haiku vision calls (a few cents).

## Files

- `cases.json` - single source of truth: profile, label text, expectations,
  and what the original audit observed (`auditBaseline`).
- `images/*.jpg` - rendered label photos the runner actually sends.
  Regenerate with `npm run redteam:images` only if `labelLines` change.
- `run.mjs` - sends each live case through `POST /api/scan` and scores it.

## Verdict semantics (safety-asymmetric on purpose)

- **FAIL** - false-negative direction: a `required` allergen missing from the
  union of both flag arrays; a `forbidden` allergen flagged (T11 canary; T10's
  may-contain-OFF merge check); an `expectSafe`/`expectEmptyArrays`/
  `expectStatus`/`expectAdvisories` contract broken; an error-path case
  returning 200; OR (as of 2026-07-02) a label landing in the wrong severity
  array or in both arrays at once (**H2** — now a hard regression guard, not
  a tracked/known issue).
- **WARN** - known out-of-scope defects, tracked but not failed:
  `warnIfFlagged` hits (**M1**, e.g. sunflower lecithin -> Soy on T3), and a
  defensive label-wording-drift check (**T19**) that should no longer be able
  to fire at all — see baseline history below.
- **SKIP** - `kind: "manual"` cases (T16-T20) traced in the audit but not
  deterministically automatable here.

`required` allergens are checked against the UNION of flaggedAllergies/
flaggedIntolerances rather than a specific array, but this is no longer a
leniency masking a gap: since tier assignment is now structurally guaranteed
correct (H2), a label being anywhere in the union AND not tripping the
tier-drift FAIL check together mean it is, by construction, in the one
correct array. Fixtures don't need to name which array — the drift checker
independently guarantees it's the right one.

## Baseline history

- **2026-07 audit (pre-C2 fix):** T3, T4, T13 FAIL (dish/confection-name
  allergens missed: marzipan/nougat/praline, satay, brioche dairy). All other
  live cases PASS.
- **2026-07-02 (C2 fix session):** after adding ALLERGEN_REFERENCE + the
  COMPOSITE FOODS rule, T3/T4/T13 passed but T7 and T12 regressed
  persistently (3/3): the longer prompt tipped two pre-existing ambiguities
  (schema line said safe=true iff arrays empty, contradicting the blurry
  rule; FORBIDDEN-invention wording suppressed advisory-sentence flags).
  Fixed by tying `safe` to readability in the schema line, moving the blurry
  rule to the top of Rules, and exempting advisories from the invention rule.
  Final state: **15/15 live cases PASS, twice consecutively.**
  Lesson: any prompt growth can silently re-balance rule priority; always
  run the full suite, and treat a 3/3 repeat as regression, not flake.

- **2026-07-02 (C1 fix session):** server now derives
  `status: "clear" | "flagged" | "unreadable"`; T3/T11/T12/T13 assert on it
  (`expectStatus`), and `npm run redteam` first runs the no-API unit checks in
  `legacy-status.test.mjs`. Required-label matching now scores same-words
  reordered labels ("Wheat / Gluten" vs "Gluten / Wheat") as detected + WARN
  (T19/H2 drift) instead of a false-negative FAIL.

- **2026-07-02 (H1 fix session, first pass):** advisories moved to a
  dedicated `advisories: [{ allergen, severity, phrase }]` channel with the
  server deciding whether one merges into the flagged arrays. This alone was
  NOT enough: live testing found the model would still independently put
  advisory-only allergens into `flaggedAllergies` (violating the new prompt
  rule directly, ~every run with `flagMayContain: false`) because the model
  was still asked to self-report a "flagged" field, and prompt wording alone
  couldn't reliably stop it from doing so — a real example of exactly the
  fragility the original audit warned about with model-level toggles.

- **2026-07-02 (H1 fix session, architecture fix):** removed the model's
  ability to self-report flags at all. The JSON schema no longer has
  `flaggedAllergies`/`flaggedIntolerances`/`safe` — the model reports only
  raw evidence: `directMatches` (allergen is an actual ingredient) and
  `advisories` (a separate cross-contact sentence), plus `readable`. The
  server derives flaggedAllergies/flaggedIntolerances entirely from
  `directMatches` + a profile severity lookup, and merges in `advisories`
  only if `flagMayContain` is true. This made the toggle deterministic:
  **T10 verified clean on 4/4 direct probes** after this change.
  A second issue surfaced immediately after: the model was treating an
  allergen's *name* appearing anywhere in the printed text (including inside
  an advisory sentence like "may contain traces of X") as sufficient for
  `directMatches`, conflating "the word is printed somewhere" with "the word
  is in the ingredients enumeration." Fixed with an explicit worked
  counter-example in the prompt distinguishing "inside the ingredients list"
  from "inside a separate advisory sentence." **Final state: 15/15 live
  cases PASS, confirmed on two consecutive full runs.**

- **2026-07-02 (H2, verified fixed as an architectural side effect):** the
  same restructure that fixed H1 also resolves H2. Severity for BOTH
  `directMatches` and `advisories` now comes exclusively from
  `matchAllergenLabel()` (a profile lookup), never from the model's own
  judgment, and each match resolves to exactly one profile `Allergen` object
  with exactly one severity — making tier drift and both-array duplication
  structurally impossible, not just less likely. Verified empirically:
  zero tier-drift/duplicate warnings across ~6 full and partial suite runs,
  including repeated direct probing of T8 (the case that showed live drift
  in the original audit). The tier-drift/duplicate checks in `run.mjs` were
  hardened from WARN to a hard FAIL accordingly — they're a regression guard
  now, not a tracked known issue. Label-wording drift (T19) appears to have
  been fixed by the same mechanism (output always uses the profile's own
  canonical label string) and was also verified clean across repeated runs,
  though the runner keeps a defensive WARN-level fallback rather than
  assuming the invariant holds forever.

## Known open defects (do not "fix" by relaxing the fixtures)

These are pre-existing model detection-accuracy issues, unrelated to the
H1/H2 architecture (which is about how evidence becomes a flag, not about
whether the model reads a given label correctly). Both predate this session's
changes and are tracked as future language-accuracy / reasoning-consistency
work, not something to patch via looser fixtures.

- **T14 fails intermittently (roughly 1 in 3) on Dairy.** OCR confusion of
  全粉乳 (milk powder) with 全粒粉 (whole wheat), and/or the model
  acknowledging the milk callout in its own reasoning while omitting Dairy
  from `directMatches`.
- **T7 fails intermittently (roughly 1 in 4-8), in two different ways** first
  observed while stress-testing H1/H2 today: the model occasionally
  mistranslates French "fruits à coque" (tree nuts) as fish/shellfish, or
  occasionally omits Gluten/Wheat entirely despite naming "Farine de blé"
  correctly in its own reasoning. In every observed case the *matching*
  pipeline correctly resolved whatever name the model actually produced —
  the miss is upstream, in the model's own reading/translation, not in
  `matchAllergenLabel()` or the evidence-channel split.

A red T7 or T14 is expected background noise at this rate, not automatically
a regression — but model output is still stochastic in general, so treat any
*other* case's single unexpected flip as worth one re-run before concluding
it's a regression, and treat a repeat (2-3 times in a row) as a real signal.
