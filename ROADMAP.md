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

### Barcode scanning
A barcode is an exact product ID, so instead of guessing from a photo you
look it up directly in a free food database like Open Food Facts (millions
of products, real ingredient/allergen data, no API key needed). More
reliable than vision-model OCR for identifying *which* product something is,
and it's the same data plumbing the "recommend an alternative" idea below
needs. Worth pairing with the eventual mobile wrap, since native camera APIs
handle barcode detection better than a browser can.

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

### Printable / shareable allergen card, in multiple languages
A summary of someone's allergen list formatted to hand to a waiter, a school
nurse, a host, or to carry while traveling abroad, translated. Low effort
since the data already exists, real utility for the exact people this app is
for.

## One legitimate longer-range direction

Scanning a food label is really one instance of a broader question: "is this
compatible with what I can or can't have." That question doesn't stop at
allergies. Halal, kosher, vegan, and celiac-safe checking are the same
underlying mechanic (a restriction list checked against ingredients) with
different vocabularies. If this project ever has a reason to grow past
allergies specifically, that's the direction that's actually adjacent to what
already exists, not a new product.

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
