# Canopy database

The Postgres schema behind Canopy, hosted on Supabase. Everything here is
"schema as code": the `migrations/` files ARE the database definition, checked
into git, so the structure is reviewable and reproducible rather than clicked
together by hand in a dashboard.

## The data model

Three tables, all owned per-user, all protected by Row Level Security.

```
auth.users            (managed by Supabase Auth — we never edit it directly)
   │  id
   │
   ├──1:1──►  profiles          display_name, flag_may_contain
   │
   ├──1:many─►  allergens       label, severity ('allergy'|'intolerance')
   │
   └──1:many─►  scans           status, flagged_*, advisories, ingredients,
                                reasoning, allergens_at_time (snapshot)
```

Every table's rows point back to an `auth.users` id with `on delete cascade`,
so deleting an account cleanly removes everything that belongs to it.

## The decisions worth understanding

- **A separate `profiles` table, not custom columns on `auth.users`.**
  `auth.users` is a system table managed by Supabase Auth; app data belongs in
  our own table linked 1:1 to it. A database trigger (`handle_new_user`) creates
  the profile row automatically the moment someone signs up.

- **`allergens` is one row per allergen, not a JSON array.** Real rows mean the
  database enforces correctness: `severity` has a `CHECK` constraint (only the
  two valid values get in), and `UNIQUE (user_id, label)` makes duplicates
  impossible — guarantees that live in the database, not just in app code.

- **`scans.allergens_at_time` is a frozen `jsonb` snapshot, not a live link.**
  A scan is a historical record. If it referenced the live `allergens` table,
  editing or deleting an allergen later would silently rewrite old history.
  Snapshotting keeps every past scan an accurate record of what was actually
  checked that day. This is deliberate denormalization.

- **`scans` has no UPDATE policy.** Scans are immutable: create and delete only.
  Editing a past scan would falsify the record, so the database refuses it.

- **Row Level Security everywhere.** Each policy restricts rows to
  `auth.uid() = user_id` — enforced by Postgres itself, so even a bug in app
  code can't read another user's data. This is the real security boundary,
  which is also why the public/anon key is safe to ship in the browser.

- **Settings live on `profiles`, not their own table.** We have exactly one
  setting today (`flag_may_contain`). One boolean doesn't earn a table; we'll
  split it out only if settings actually multiply.

## Applying the migrations

Until we wire up the Supabase CLI, apply each file's SQL in the Supabase
dashboard: **SQL Editor → New query → paste → Run**, in numbered order
(`profiles`, then `allergens`, then `scans`). Order matters because later
tables and the signup trigger depend on earlier ones.

Later we can set up `supabase link` + `supabase db push` so these files apply
automatically and the repo stays in sync with the live database.
