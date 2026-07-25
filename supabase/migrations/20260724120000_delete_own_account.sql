-- ============================================================================
-- 0004 · delete_own_account
-- ----------------------------------------------------------------------------
-- Lets a signed-in user permanently delete their OWN account.
--
-- The problem this solves: deleting a row from auth.users normally requires
-- the Supabase service role key, which bypasses every Row Level Security
-- policy in the database. That key must never reach the browser and never be
-- deployed to Vercel, so "call the admin API from a server route" is not an
-- option here. Without something like this function, self-serve account
-- deletion is impossible for this project.
--
-- The fix is a SECURITY DEFINER function. A normal function runs with the
-- CALLER's permissions (an ordinary user, who cannot touch auth.users).
-- SECURITY DEFINER makes it run with the permissions of the role that OWNS
-- the function (postgres, which can). So the elevated permission lives in
-- this one function, which does exactly one narrow thing, rather than in a
-- key we would have to ship somewhere.
--
-- That elevation is also why the rest of this file is so careful. A
-- SECURITY DEFINER function is the classic place to introduce a privilege
-- escalation bug, so each guard below is deliberate:
--
--   1. `set search_path = ''`
--      Without this, the function resolves unqualified names using the
--      CALLER's search_path. An attacker could create their own `auth` schema
--      containing their own `users` table, put it first on the path, and
--      change what this function actually operates on. Pinning the path to
--      empty forces every name to be fully qualified (auth.users below), so
--      there is nothing left to hijack.
--
--   2. Deleting `auth.uid()` and nothing else
--      The id is never taken as a parameter. There is no argument to tamper
--      with: the function can only ever delete the account belonging to the
--      session that called it. Even a caller who wanted to delete someone
--      else's account has no way to express that.
--
--   3. An explicit null check
--      auth.uid() is null when there is no valid session. `delete ... where
--      id = null` would match zero rows and quietly "succeed", which would be
--      a confusing lie. Raising instead means an unauthenticated call fails
--      loudly.
--
--   4. Locked-down grants
--      Postgres grants execute on new functions to PUBLIC by default, which
--      would include the anonymous role. That is revoked, then granted only
--      to `authenticated`.
--
-- Cleaning up the user's data needs no code at all: profiles, allergens, and
-- scans all declare `references auth.users (id) on delete cascade`, so
-- removing the auth row removes everything that hangs off it, enforced by the
-- database rather than by app code remembering to do it in the right order.
-- ============================================================================

create or replace function public.delete_own_account ()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid ();
begin
  if caller_id is null then
    raise exception 'delete_own_account: no authenticated user';
  end if;

  -- The cascades on profiles, allergens, and scans do the rest.
  delete from auth.users where id = caller_id;
end;
$$;

revoke execute on function public.delete_own_account () from public;

grant execute on function public.delete_own_account () to authenticated;
