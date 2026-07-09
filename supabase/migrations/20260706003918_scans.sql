-- ============================================================================
-- 0003 · scans
-- ----------------------------------------------------------------------------
-- One row per scan. Mirrors the Scan / ScanResult types in storage.ts.
--
-- A scan is a HISTORICAL RECORD of a check that already happened. That framing
-- drives the two most important decisions in this file:
--   1. allergens_at_time is a frozen jsonb snapshot, not a live link (see below)
--   2. there is no UPDATE policy — you never edit a past scan
-- ============================================================================

create table public.scans (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references auth.users (id) on delete cascade,

  food_name text,

  -- The three-state verdict our /api/scan route derives server-side. The CHECK
  -- constraint pins it to exactly the ScanStatus union from storage.ts, so an
  -- impossible fourth status can never be stored.
  status text not null check (status in ('clear', 'flagged', 'unreadable')),

  -- Postgres has NATIVE array columns (the [] means "array of text"), so these
  -- lists of allergen labels stay as real arrays instead of being flattened
  -- into a comma-joined string we'd have to parse back out. default '{}' is an
  -- empty array.
  flagged_allergies text[] not null default '{}',
  flagged_intolerances text[] not null default '{}',
  ingredients text[] not null default '{}',

  -- Advisories are small structured objects: {allergen, severity, phrase}.
  -- jsonb is the right fit — it stores arbitrary JSON in one column AND lets us
  -- query inside it later if we want. default '[]' is an empty JSON array.
  advisories jsonb not null default '[]',

  reasoning text not null default '',

  -- ***THE key design decision in this schema.***
  -- We store a COPY of the user's allergen list exactly as it was at scan time,
  -- as jsonb — instead of linking to the live `allergens` table with a foreign
  -- key. This is deliberate denormalization, and here's why it's correct:
  --   A scan is a record of what was checked on a specific day. If it pointed
  --   at live allergens, then editing or deleting an allergen later would
  --   silently rewrite (or break) old history — a scan from three months ago
  --   would suddenly claim it checked against a different list than it actually
  --   did. Freezing a snapshot keeps every past scan an accurate, permanent
  --   record. (The current app already snapshots this in localStorage; we're
  --   preserving that exact, intentional behavior.)
  allergens_at_time jsonb not null default '[]',

  created_at timestamptz not null default now()
);

-- "all scans for this user" — same reasoning as the allergens index.
create index scans_user_id_idx on public.scans (user_id);

-- We display scans newest-first. A COMPOSITE index on (user_id, created_at desc)
-- lets Postgres serve "this user's most recent scans" already sorted, without a
-- separate sort step — the single most common query this table will get.
create index scans_user_created_idx on public.scans (user_id, created_at desc);

alter table public.scans enable row level security;

create policy "Users can view their own scans"
  on public.scans for select
  using (auth.uid() = user_id);

create policy "Users can add their own scans"
  on public.scans for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own scans"
  on public.scans for delete
  using (auth.uid() = user_id);

-- Deliberately NO update policy. Scans are immutable: you create them and you
-- can delete them, but editing a past scan would falsify the historical record.
-- The database enforces that by simply never allowing an UPDATE from a user.
