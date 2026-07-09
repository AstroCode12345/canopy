-- ============================================================================
-- 0002 · allergens
-- ----------------------------------------------------------------------------
-- One row PER allergen PER user. This is the relational alternative to the JSON
-- array we kept in localStorage. Instead of one blob like
--   [{"label":"Peanuts","severity":"allergy"}, ...]
-- each allergen is its own row of real, typed, constraint-checked, queryable
-- data. This is the core difference between a database and a document store,
-- and it's worth understanding: the database itself now guarantees the data is
-- well-formed, rather than trusting app code to keep the blob clean.
-- ============================================================================

create table public.allergens (
  -- gen_random_uuid() generates a fresh random id for each new row. (profiles
  -- didn't need this because its id came from auth.users; here the row is new,
  -- so we mint an id ourselves.)
  id uuid primary key default gen_random_uuid (),

  -- Which user owns this allergen. Foreign key to auth.users, cascade on delete
  -- (delete the account -> their allergens go with it).
  user_id uuid not null references auth.users (id) on delete cascade,

  label text not null,

  -- The CHECK constraint means Postgres will REJECT any value that isn't one of
  -- these two strings. This is the database being the last line of defense:
  -- even if buggy app code tried to write severity = 'maybe', the insert fails.
  -- It mirrors the Severity type ("allergy" | "intolerance") in storage.ts, but
  -- enforced by the database instead of just by TypeScript (which only checks
  -- at compile time and vanishes at runtime).
  severity text not null check (severity in ('allergy', 'intolerance')),

  created_at timestamptz not null default now(),

  -- A user shouldn't be able to add "Peanuts" twice. This makes the
  -- (user_id, label) PAIR unique, so duplicates are impossible at the database
  -- level — not something we have to check for in app code.
  unique (user_id, label)
);

-- We will almost always ask "give me all allergens for THIS user". An index on
-- user_id lets Postgres jump straight to that user's rows instead of scanning
-- the whole table, which matters as the table grows across many users.
create index allergens_user_id_idx on public.allergens (user_id);

alter table public.allergens enable row level security;

-- Here the user does all four operations on their OWN rows, so we write all
-- four policies. Two clauses appear:
--   • using       -> which EXISTING rows this operation may touch (read/change)
--   • with check  -> what you're allowed to WRITE (so you can't, say, insert a
--                    row stamped with someone else's user_id)
create policy "Users can view their own allergens"
  on public.allergens for select
  using (auth.uid() = user_id);

create policy "Users can add their own allergens"
  on public.allergens for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own allergens"
  on public.allergens for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own allergens"
  on public.allergens for delete
  using (auth.uid() = user_id);
