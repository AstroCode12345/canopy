-- ============================================================================
-- 0005 · api_usage + rate limiting
-- ----------------------------------------------------------------------------
-- Caps how many times one account can call the paid API routes per hour.
--
-- Why this exists: /api/scan spends real money on every call (an Anthropic
-- vision request). Requiring a session (see src/lib/apiAuth.ts) means a
-- stranger cannot spend that money, but it does not stop ONE signed-in
-- account from spending all of it, whether maliciously or through a runaway
-- retry loop in a buggy client. Auth answers "who", a rate limit answers
-- "how much".
--
-- Why in the database rather than in memory: the app runs on Vercel, where
-- each request may land on a different serverless instance and instances are
-- recycled constantly. A counter held in a module-level variable would be
-- per-instance and would reset unpredictably, so it would only ever catch
-- the most obvious abuse by luck. Postgres is the one piece of shared,
-- durable state every instance already talks to.
--
-- Like delete_own_account, the work happens in a SECURITY DEFINER function.
-- That is what lets this table have NO row level security policies at all:
-- rather than granting users carefully-shaped access to their own usage
-- rows, no user can touch the table directly under any circumstance. It is
-- reachable only through the one function below, which decides what happens.
-- A user cannot read the table, cannot insert a fake history into it, and
-- most importantly cannot DELETE their own rows to reset their own limit,
-- which is exactly the hole a naive "users manage their own rows" policy
-- would open.
-- ============================================================================

create table public.api_usage (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Which paid route was called, e.g. 'scan' or 'barcode'. Kept as text so
  -- adding a route later needs no migration.
  endpoint text not null,
  created_at timestamptz not null default now()
);

-- The only question ever asked of this table is "how many rows for THIS user
-- and THIS endpoint since some timestamp", so the index matches that shape
-- exactly and the count never scans the whole table.
create index api_usage_lookup_idx on public.api_usage (
  user_id,
  endpoint,
  created_at desc
);

alter table public.api_usage enable row level security;

-- Deliberately no policies. With RLS enabled and nothing granted, every
-- direct query from a normal user returns nothing and every write is
-- refused. The SECURITY DEFINER function below bypasses that, which is the
-- entire point: usage accounting should not be editable by the account
-- being accounted for.

/**
 * Records one call and reports how many the user has made in the window.
 *
 * Returns the count INCLUDING the call just recorded, so the caller
 * compares against its own limit: a return of 61 with a limit of 60 means
 * this request is the one that went over.
 *
 * Recording before counting is deliberate. The opposite order (count, then
 * decide, then record) leaves a gap where several simultaneous requests can
 * each read the same under-limit count and all proceed. Writing first means
 * every call is accounted for even in a burst.
 */
create or replace function public.record_and_check_rate_limit (
  p_endpoint text,
  p_window_seconds integer
)
returns integer
language plpgsql
security definer
-- Pinned for the same reason as delete_own_account: without it, an attacker
-- controlling search_path could redirect these unqualified names at tables
-- of their own choosing.
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid ();
  window_start timestamptz := now() - make_interval(secs => p_window_seconds);
  used integer;
begin
  if caller_id is null then
    raise exception 'record_and_check_rate_limit: no authenticated user';
  end if;

  -- Keep the table small. Rows older than the window can never affect an
  -- answer again, so there is no reason to retain them. This makes the
  -- table self-pruning without a scheduled job.
  delete from public.api_usage
  where user_id = caller_id
    and endpoint = p_endpoint
    and created_at < window_start;

  insert into public.api_usage (user_id, endpoint)
  values (caller_id, p_endpoint);

  select count(*)
  into used
  from public.api_usage
  where user_id = caller_id
    and endpoint = p_endpoint
    and created_at >= window_start;

  return used;
end;
$$;

revoke execute on function public.record_and_check_rate_limit (text, integer)
from public;

grant execute on function public.record_and_check_rate_limit (text, integer)
to authenticated;
