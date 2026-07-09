-- ============================================================================
-- 0001 · profiles
-- ----------------------------------------------------------------------------
-- One row per user. Holds app-specific account data that does NOT belong in
-- Supabase's managed `auth.users` table (which stores email, hashed password,
-- linked Google identity, etc. — we never touch that table directly).
--
-- Supabase explicitly recommends this "profiles table linked 1:1 to auth.users"
-- pattern instead of trying to bolt custom columns onto auth.users.
-- ============================================================================

create table public.profiles (
  -- The profile's id IS the auth user's id. This single line does two jobs:
  --   • primary key        -> uniquely identifies the row
  --   • references auth.users(id) -> a foreign key: this id MUST match a real
  --     auth user, so you can never have a profile with no account behind it.
  -- "on delete cascade": if the auth account is deleted, delete this profile
  -- automatically. No orphaned rows left pointing at a user who no longer exists.
  id uuid primary key references auth.users (id) on delete cascade,

  -- Replaces Identity.name from localStorage. Nullable: email/password signups
  -- don't give us a name up front (the user fills it in on the profile screen).
  display_name text,

  -- The one scanning preference we have today (was `flagMayContain`). A single
  -- boolean does not justify its own table, so it lives here on the profile.
  -- We can split it into a settings table later IF settings actually multiply.
  flag_may_contain boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security (RLS)
-- ---------------------------------------------------------------------------
-- The auto-RLS event trigger you enabled already turns this on for new tables,
-- but we declare it explicitly so this migration is correct and self-contained
-- on ANY project (and so a reader can see the intent). Enabling twice is a
-- harmless no-op.
alter table public.profiles enable row level security;

-- auth.uid() returns the id of the currently-logged-in user, read from the JWT
-- attached to the request. So "auth.uid() = id" means "this row is literally
-- you." Enforced by Postgres itself — even a bug in our app code can't read
-- around it.
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Deliberately NO insert policy: users never create their own profile row.
-- The trigger below does it automatically at signup (running with elevated
-- privilege), so the client never needs INSERT rights here.
-- Deliberately NO delete policy: deleting your profile happens by deleting your
-- auth account, which cascades to this row via the foreign key above.

-- ---------------------------------------------------------------------------
-- Auto-create a profile whenever a new auth user signs up
-- ---------------------------------------------------------------------------
-- Signing up inserts a row into auth.users. This trigger fires on that insert
-- and creates the matching profiles row, so EVERY user always has a profile
-- without the app having to remember to make one.
create function public.handle_new_user ()
returns trigger
language plpgsql
-- security definer: the function runs with its OWNER's privileges, not the
-- caller's. It must, because at the instant of signup the new user has no
-- session yet and therefore no permission to insert anything.
security definer
-- Hardening for security-definer functions: an empty search_path stops an
-- attacker from shadowing an unqualified name (e.g. a fake `profiles`) with
-- something on their own path. We fully-qualify every name below to compensate.
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    -- Google sign-in puts the user's name in raw_user_meta_data. For plain
    -- email signups it's absent, so this is simply null (they'll set it later).
    new.raw_user_meta_data ->> 'full_name'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user ();

-- ---------------------------------------------------------------------------
-- Keep updated_at honest
-- ---------------------------------------------------------------------------
-- Automatically stamp updated_at = now() on every UPDATE, so we never rely on
-- app code to remember to do it.
create function public.set_updated_at ()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at ();
