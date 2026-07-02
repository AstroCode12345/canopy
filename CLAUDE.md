# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Canopy** — a mobile-first PWA that scans food labels and flags ingredients matching the user's saved allergies or intolerances. Built for Taymour as a first-real-product project; replaces an older Replit "safeeats" prototype at `~/Downloads/safeeats/` (kept around as reference for prompt rules and disclaimer copy, **not** for code reuse).

Production stack: **Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + Anthropic Claude Haiku 4.5 vision.** v1 has no auth, no database, no payments — all user data lives in `localStorage`.

## Commands

```bash
# Dev server — MUST use port 3002 (Reply AI owns 3000 on this machine).
# The folder name has spaces + capitals, so when launching from outside the
# folder use --prefix instead of cd.
npm run dev -- -p 3002
# or:  npm run dev --prefix "/Users/Taymo/Allergy Scan AI" -- -p 3002

npm run build           # Production build
npm run start           # Run the production build
npm run lint            # ESLint (Next.js's flat config in eslint.config.mjs)
```

There are no tests in this project.

**Anthropic API key** for `/api/scan` lives in `.env.local` (gitignored) as `ANTHROPIC_API_KEY=sk-ant-...`. Without it, the scan route returns a clear 500 with instructions.

**Preview tooling:** the dev server is registered in `/Users/Taymo/Claude/.claude/launch.json` as `allergen-scanner` (port 3002). Use `mcp__Claude_Preview__preview_start` with name `allergen-scanner` rather than running `npm run dev` via Bash.

## Big things that bite

1. **This is Next.js 16, not your training data.** APIs and conventions have shifted (see `AGENTS.md`). Check `node_modules/next/dist/docs/` before assuming syntax.
2. **Tailwind v4** — no `tailwind.config.ts` file. **All theme tokens live in `src/app/globals.css`** under the `@theme` block. Custom colors (`accent`, `danger`, `warning`, `accent-soft`, etc.) and keyframes (`halo`, `fade-in`) are defined there.
3. **Folder name** `Allergy Scan AI` has spaces + capitals, which npm rejects as a package name. The `package.json` `name` is `allergen-scanner-init` (from the temp-folder scaffolding workaround). Don't change the folder name without also updating the launch config.
4. **The brand name is Canopy**, not "Allergen Scanner" — the folder name is legacy. Use `Canopy` in user-facing copy, metadata, and the manifest.

## Architecture

### Pages (App Router, all client components)

- **`/` (Home)** — hero with leaf-branded CANOPY kicker, big animated green Scan button, recent scans list (max 3) with severity-coded left stripes, "About Canopy & safety" footer link. Shows `OnboardingTour` modal on truly-first visit (no allergens + no scans + no onboarding flag).
- **`/scan`** — file/camera capture → `POST /api/scan` → result card. State machine: `idle | preview | analyzing | result | error`. If no allergens saved, shows a "Set up allergens" prompt that links to `/profile` (no scan can happen without them).
- **`/profile`** — full-page allergen editor with sticky Save bar above the bottom nav. Uses the same `AllergenEditor` as the (now mostly historical) `AllergenSetup` modal.
- **`/history`** — list of past scans with severity-coded left stripes. Tap a row → bottom-sheet modal with full `ScanResultCard` + delete action.
- **`/disclaimer`** — static safety/limitations page. Linked from Home footer and from a "Why?" link inside every `ScanResultCard`. Copy ported from the original safeeats — keep it serious.

The `BottomNav` is a 4-tab fixed bar (Home / Scan / Profile / History) using `usePathname()` for active-state highlighting. Pages compose their own header + `<main>` + `<BottomNav />`.

### API route — `/api/scan`

`POST` accepts `{ imageDataUrl: string, allergens: Allergen[] }`. Calls Claude Haiku 4.5 with the image as base64 + a JSON-only system prompt + an **assistant prefill of `"{"`** to force valid JSON output. Returns `ScanResult` shape (see storage.ts) or an error.

Hard prompt rules baked into the route (don't soften without thinking):
- Split user sensitivities into `ALLERGIES (avoid)` vs `INTOLERANCES (be aware)` lists
- "May contain traces" and "manufactured in a facility with" count as flagging
- Same ingredient matching both → severe wins
- Never invent ingredients not visible
- Blurry/unreadable → `safe=false`, empty arrays, explain in `reasoning`
- For safe results, reasoning MUST include the literal phrase `"No allergens detected, but please double-check the physical label."`

### Storage layer — `src/lib/storage.ts`

**This file is the single source of truth for all persisted types.** Components import `Allergen`, `Scan`, `ScanResult`, `Severity` from here.

Keys: `allergens:v1`, `scans:v1`, `onboarding:v1`. Bumping the `:v1` suffix is the migration mechanism — there's no schema versioning beyond that.

Two important compatibility shims:
- `getAllergens()` defaults missing `severity` to `"allergy"` (the safer choice if we don't know)
- `normalizeScan()` handles old scans that had a flat `flagged: string[]` by treating those entries as allergies

`resultSeverity(result)` returns `"safe" | "intolerance" | "allergy"` — use it any time you switch UI on the verdict (it's how list rows + the result card pick their colors).

Scans are capped at 50 (newest first) to keep localStorage under the 5MB limit. **No image bytes are stored** — only text fields. If you add image thumbnails, downscale aggressively first.

### Design system

Colors defined in `src/app/globals.css` `@theme`:

| Token | Hex | Use |
|---|---|---|
| `background` | `#FAF9F6` | Page background (warm off-white) |
| `foreground` | `#111111` | Primary text |
| `card` | `#FFFFFF` | Card surfaces |
| `muted` | `#6B7280` | Secondary text |
| `border` | `#ECECEC` | Hairline borders |
| `accent` / `accent-soft` | `#16A34A` / 10% tint | Green — safe / primary CTA |
| `danger` / `danger-soft` | `#DC2626` / 10% tint | Red — severe allergy / avoid |
| `warning` / `warning-soft` | `#D97706` / amber tint | Amber — mild intolerance / be aware |

Animations (`halo`, `fade-in`) and the `.hero-bg` radial-gradient helper also live in `globals.css`. **All animations gate behind `motion-safe:`** — `prefers-reduced-motion` is respected.

Typography: Geist Sans + Geist Mono via `next/font/google`, wired in `src/app/layout.tsx`.

Visual conventions:
- Cards: `rounded-2xl border border-border bg-card`
- Icon squares: `h-10 w-10 rounded-xl bg-accent-soft text-accent` (swap colors for danger/warning variants)
- Primary CTAs: `rounded-full bg-accent text-white shadow-soft`
- Chip selected/deselected states: see `AllergenEditor` `SeverityChip` — three states (off / allergy red / intolerance amber)
- List row severity stripe: `border-l-[3px] border-l-{accent|warning|danger}/60-70`
- Header pattern: H1 + subtitle only. **Don't add a CANOPY kicker to internal pages** — kicker is Home-only branding.

### PWA setup

Manifest and icons are generated programmatically via Next.js metadata-route conventions — there are no binary PNG files in `public/`:

- `src/app/manifest.ts` → served at `/manifest.webmanifest` (Next.js auto-injects `<link rel="manifest">`)
- `src/app/icon.tsx` → served at `/icon` (512×512 PNG via `next/og`)
- `src/app/apple-icon.tsx` → served at `/apple-icon` (180×180)

Theme color `#16a34a` set in `layout.tsx` viewport config.

## Reference files when stuck

- **`/Users/Taymo/.claude/plans/i-m-building-a-mobile-glowing-beacon.md`** — running plan + shipped log for every pass. Read this to understand *why* something is the way it is before changing it.
- **`~/Downloads/safeeats/`** — the original Replit prototype. Useful only as reference for AI prompt heuristics and disclaimer copy. Stack is different (Vite + Express + OpenAI), so don't copy code patterns.

## Working style

The user is a beginner doing his first mobile product. He wants:
- Plain-English explanations before doing non-trivial steps
- One step at a time with check-ins at meaningful boundaries
- No fake placeholder content — use empty states instead of fabricated names/scans
- No "I'll do X then Y" promises — just deliver the current step
- Proactive plan-file updates after every meaningful ship
