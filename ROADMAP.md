# Canopy roadmap

Ideas worth building someday, not a schedule. Nothing here has a date attached
or is promised. This is a list to pull from when there's time, not a plan
being executed against.

## Where Canopy actually stands

A PWA that scans a food label photo, checks it against your saved allergens
using Claude's vision model, and keeps your allergens and scan history in a
real Supabase-backed account (Postgres, Row Level Security, real auth).
Deployed on Vercel. Being built for the Congressional App Challenge, by one
person, with no funding, no team, and no company behind it. Every idea below
should be read against that reality, not against what a bigger company with
capital and a legal team could eventually do.

## Near-term feature ideas

### Barcode scanning (stage 1 built, 2026-07-12)
A barcode is an exact product ID, so instead of guessing from a photo you
look it up directly in Open Food Facts (millions of products, real
ingredient/allergen data, no API key needed).

Shipped in stage 1: a Label/Barcode toggle on the scan screen, live detection
from the camera feed (`barcode-detector` package: native API on Android,
WASM on iPhone), a server route (`/api/barcode`) that queries OFF and derives
the verdict from declared allergen and traces tags using the same
profile-lookup rules as the label scan. Safety rule baked in: database tags
can prove an allergen IS present, never that it's absent, so there is no
green "safe" from a barcode alone. No-hit results say so honestly and hand
off to the label scan.

Remaining stages:
- Stage 2: run OFF's ingredients text through the existing model matching
  pipeline (aliases, composite foods) so a barcode alone can produce a real
  verdict, still without needing a photo.
- Stage 3: scanned-before cache keyed by barcode, so repeat products skip
  the lookup and the model entirely.
- Stage 4: recommend a comparable product without the allergen (needs OFF
  category data).

### Ask about this scan
After a result, let someone tap in and ask a follow-up in plain language:
"is the natural flavor a risk?" or "why did you flag this?" Turns a one-shot
verdict into an actual conversation about that specific label instead of a
dead end.

### Restaurant / menu mode
Photograph a printed menu instead of a packaged label, and flag dishes most
likely to contain saved allergens. A genuinely different problem from
packaged food (menu composition isn't as reliably knowable as a printed
ingredients list), so the framing needs to be more conservative: "ask your
server about X" rather than a hard verdict.

### Household profiles
One phone, multiple people's allergies. A parent scanning for two kids with
different restrictions. A "who's this for" switcher, or check everyone at
once and show per-person results. Natural fit now that real accounts exist.

### Remembered / scanned-before products
Right now the same granola bar gets rescanned every grocery trip. Once a
product's been checked (especially via barcode), remember it and surface
"already checked, still clear" instead of making someone redo the work.
Probably the single biggest everyday friction fix on this list.

### Recommend a similar product without the allergen
When something gets flagged, suggest a comparable product that doesn't have
the allergen. Needs to be backed by a real product database (same one
barcode scanning would use), not the model's general knowledge: asking an
LLM to invent "a nut-free granola brand" risks recommending something that
doesn't exist, isn't sold nearby, or isn't actually safe anymore.

### Printable / shareable allergen card, in multiple languages (next up)
A summary of someone's allergen list formatted to hand to a waiter, a school
nurse, a host, or to carry while traveling abroad, translated. Low effort
since the data already exists, real utility for the exact people this app is
for. Greenlit 2026-07-13 as the next build after barcode stage 1.

### AI alias expansion for custom allergens (Taymour's idea, 2026-07-13)
When someone adds a custom allergen ("Mustard"), make one model call at
add time asking for its families, aliases, and derivative names ("dijon,
mustard seed, mustard flour, sinapis"), store them on the allergen row, and
feed them into the scan prompt and the barcode tag matching. The scan model
already alias-matches by meaning at scan time, so the win here is threefold:
custom allergens get first-class treatment in barcode lookups (which are
deterministic and know nothing about aliases), the user can SEE what Canopy
watches for and correct it, and the stored list feeds the translated
allergen card. One call per allergen ever, roughly a cent, cached forever.

## Supported scan languages (verified 2026-07-14)

English, French, Japanese, Spanish, German, and Simplified Chinese, each
with its own redteam fixture (T7, T14, T22, T23, T24 plus the English
suite) measured at or near 100% on the day of verification. Support rests
on three layers: the model's own multilingual reading, per-language
allergen vocabulary in the scan prompt, and a deterministic
translation-trap table in the server for words the model reliably gets
wrong (German Vollei, Japanese 全粉乳, and friends). Other languages still
work on a best-effort basis through the model; these six are the ones
Canopy stands behind.

## One legitimate longer-range direction

Scanning a food label is really one instance of a broader question: "is this
compatible with what I can or can't have." That question doesn't stop at
allergies. Halal (no alcohol, no pork, no non-halal gelatin), kosher, vegan,
and vegetarian checking are the same underlying mechanic (a restriction list
checked against ingredients) with different vocabularies. Taymour flagged
this for real consideration on 2026-07-13. Design note for when it happens:
these are restriction PROFILES (one toggle enables a whole vocabulary), not
individual allergen chips, and the verdict language changes ("not halal"
rather than "allergen flagged"), so it deserves its own section in the
profile UI and its own reference table in the scan prompt rather than being
stuffed into the allergens list.

A visual redesign is also on Taymour's mind (flagged 2026-07-13, direction
TBD). Any restyle should run the design-pass skill first and keep the
result-card information hierarchy intact, since its severity tiers are part
of the safety design, not just styling.

## Deliberately not planning, and why

**Medication interactions, symptom tracking, EHR/clinical integration.**
This is regulated medical device software territory. The FDA has specific,
real guidance on when health software crosses into clinical decision
support, and getting that wrong isn't a technical mistake, it's a legal and
safety one. The disclaimer already in this app ("not a medical device,
always verify yourself") is the correct posture precisely because Canopy
stays out of that territory. Moving into it would need medical and legal
oversight this project doesn't have, and shouldn't pretend to.

**Business model, pricing tiers, school/restaurant contracts, fundraising
targets.** There's no product-market validation yet beyond a working
scanner and one person's testing. Numbers like this without real evidence
behind them (revenue targets, contract values, a valuation) create false
confidence rather than a plan. If Canopy ever has real users asking for a
school or restaurant version, that's the point to think about it, backed by
actual demand instead of a projection.

**A general-purpose "health compatibility API" for other companies to
build on.** This assumes a scale of trust, data, and legal standing Canopy
doesn't have and can't manufacture by writing it into a roadmap. It's the
kind of thing that becomes true, if it ever does, as a consequence of
Canopy being good and trusted at the narrower thing first, not a parallel
track to build now.
