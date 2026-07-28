# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Canopy** is a mobile-first PWA that scans food labels and flags ingredients matching the user's saved allergies or intolerances. Built for Taymour as a first-real-product project, and entered in the Congressional App Challenge. It replaces an older Replit "safeeats" prototype at `~/Downloads/safeeats/` (reference for prompt heuristics and disclaimer copy only, **not** for code reuse: different stack, and its prompt design predates every safety mechanism below).

Stack: **Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS v4 + Supabase (Postgres, RLS, cookie auth) + Anthropic Claude Haiku 4.5 vision.** Deployed on Vercel.

Start with [README.md](README.md) for the safety architecture and [supabase/README.md](supabase/README.md) for the data model. This file covers the things that bite while editing.

## Commands

```bash
# Dev server: MUST use port 3002 (Reply AI owns 3000 on this machine).
npm run dev -- -p 3002

npm run build           # Production build
npm run lint            # ESLint
npm run redteam         # Adversarial suite, needs the dev server on 3002
npm run redteam:images  # Re-render fixture images after editing cases.json
```

**Preview tooling:** the dev server is registered in `.claude/launch.json` as `allergen-scanner`. Use `mcp__Claude_Browser__preview_start` with that name rather than running `npm run dev` through Bash.

**Env** lives in `.env.local` (gitignored): `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. `SUPABASE_SERVICE_ROLE_KEY` is present locally for one-off admin scripts only. **It must never be deployed to Vercel and must never get a `NEXT_PUBLIC_` prefix**, since that would ship an RLS-bypassing key to the browser. No app code reads it, and it should stay that way.

## Big things that bite

1. **This is Next.js 16, not your training data.** Conventions have shifted (see `AGENTS.md`). Check `node_modules/next/dist/docs/` before assuming syntax.
2. **Tailwind v4**: there is no `tailwind.config.ts`. All theme tokens live in the `@theme` block in `src/app/globals.css`.
3. **The model never decides safety.** See below. This is the project's central invariant and the easiest thing to accidentally undo.
4. **Migrations apply by hand.** No Supabase CLI is linked, so a new migration only reaches the database when someone pastes it into the SQL editor. All five are applied as of 2026-07-26, verified against the live database. Write new ones to fail visibly rather than silently, the way `delete_own_account` and the rate limiter do, since "applied" is a manual step that can be forgotten.
5. **The brand name is Canopy.** Use it in all user-facing copy, metadata, and the manifest.

## Architecture

### The safety invariant: evidence in, verdict derived

`/api/scan` asks the vision model for **evidence only**: the ingredients it can read, which allergens it found with the printed `source` text justifying each, any precautionary statements, and whether the image was legible. There is deliberately **no "safe" or "flagged" field** in the response schema. The server derives `flaggedAllergies` / `flaggedIntolerances` / `status` itself by matching that evidence against the user's profile.

This is what makes prompt injection on a label structurally powerless, and what makes severity drift impossible. **Do not add a verdict field to the model's output schema**, and do not let the model's own words decide a tier. If a scan behaves wrongly, the fix is almost always in the server-side derivation or in a deterministic backstop, not in trusting the model more.

Supporting mechanisms in the same file, each commented with the specific failure that motivated it:

- **Two evidence channels.** `directMatches` (actual ingredients) and `advisories` ("may contain") never merge. Whether an advisory also flags is a deterministic server-side decision from the user's `flag_may_contain` setting.
- **`TRANSLATION_TRAPS`** reconciles terms the model reliably mistranslates (German `Vollei`, Arabic peanut oil, Chinese 腰果). Additive only: it can add a missed flag, never remove one.
- **`NON_ALLERGEN_LOOKALIKES`** is the mirror, and because it *removes* a flag it is gated much harder: it fires only when every ingredient that could plausibly support the allergen is a known lookalike.

### Pages (App Router, client components unless noted)

`/` Home · `/scan` camera, barcode detection, results · `/profile` allergen editor · `/history` past scans · `/settings` account, data, links · `/card` printable multi-language allergen card · `/privacy` · `/disclaimer` · `/welcome` and `/sign-in` auth · `/forgot-password`, `/reset-password`, `/change-password` password flows.

`BottomNav` is a 5-tab fixed bar (Home / History / Scan / Profile / Settings) with Scan as a raised FAB.

Route protection lives in `src/lib/supabase/middleware.ts`. `PUBLIC_PATHS` is the list of pages a signed-out visitor may reach; **`api/` is excluded from middleware entirely** so the redteam suite can drive `/api/scan` with no session. API routes guard themselves through `src/lib/apiAuth.ts`.

### API routes

Both `/api/scan` and `/api/barcode` call `guardApiRoute()` as their first line, which does auth plus a per-account hourly rate limit in a single `getUser()` pass. **Both are production-only no-ops**, which is what keeps `npm run redteam` working locally. The rate limiter **fails open and logs loudly** if its check errors: this is a tool someone may be relying on in a shop, so a broken counter must not block scans.

### Data layer

`src/lib/db.ts` is the **only** file that queries Supabase tables. Pages call its functions and never write raw queries. `src/lib/storage.ts` holds shared types (`Allergen`, `Scan`, `ScanResult`, `Severity`) plus `scanStatusOf()` and `resultVerdict()`. Use those any time UI switches on a verdict, never read `status` directly, since they tolerate pre-July-2026 records that predate the field.

Only one thing still lives in `localStorage`: the onboarding-seen flag, which genuinely belongs to the device.

Scans snapshot the allergen list into `allergens_at_time`, so editing your profile never rewrites history. Scans are immutable by design (no UPDATE policy in the database). **No image bytes are ever stored**, which the privacy page states publicly, so keep it true.

### Design system

Palette is **"Grove"**, defined in the `@theme` block of `src/app/globals.css`. Read the tokens there rather than hardcoding hex: `background` `#f4f7f0`, `foreground` `#16241c`, `card`, `surface-2`, `muted`, `faint`, `border`, `border-strong`, `accent` `#1c7a53`, plus `danger` / `warning` each with `-soft` and `-ink` variants. The `-ink` colors exist for readable text on a `-soft` background.

Typography: Schibsted Grotesk + JetBrains Mono via `next/font/google`.

Conventions:
- Cards: `rounded-3xl border border-border bg-card shadow-soft`
- Icon squares: `h-10 w-10 rounded-xl bg-accent-soft text-accent`
- Primary CTA: `rounded-full bg-accent text-white shadow-soft`
- Section kicker: `font-mono text-[11px] uppercase tracking-[0.16em] text-faint`
- Bottom sheets: `animate-sheet-up` with a grab handle. **Sheets that can open over the camera need an explicit `text-foreground`**, or headings inherit the camera's `text-white` and vanish against the card.
- Severity colors are part of the safety design, not decoration. Do not restyle the result card's hierarchy without keeping the tiers legible.
- `prefers-reduced-motion` is respected globally in `globals.css`.

### Testing

`tests/allergen-redteam/` holds 77 adversarial fixtures across 8 categories, built to force false negatives. `cases.json` defines them, `gen-images.mjs` renders them to label images, `run.mjs` sends each through the real `/api/scan`.

**A new case that fails is doing its job. Fix the app, not the test.** Fixture notes carry measured evidence for known-failing cases; several end in "DO NOT relax this fixture," and that instruction is meant literally.

## Working style

Taymour is a student learning by building. He wants:
- Plain-English explanations before non-trivial steps
- One step at a time with check-ins at meaningful boundaries
- No fake placeholder content, use empty states instead
- **No em dashes** in body copy, comments, or commit messages
- Proactive `ROADMAP.md` updates after every meaningful ship
- The `design-pass` skill run *before* frontend work, not as a rescue afterwards
