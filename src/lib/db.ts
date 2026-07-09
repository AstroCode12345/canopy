// The Supabase-backed data layer. Every function here talks to the database
// built in supabase/migrations/ — this file is the ONLY place that should
// call supabase.from("allergens" | "scans" | "profiles"). Pages call these
// functions; they never write raw Supabase queries themselves. That keeps
// the "how do we talk to the DB" logic in one reviewable place.
//
// A pattern you'll see repeated below: SELECT queries have no
// .eq("user_id", ...) filter. That is not a bug — Row Level Security in
// Postgres already restricts every query to the signed-in user's own rows,
// no matter what we ask for. We only need to supply user_id explicitly on
// INSERT, because RLS's WITH CHECK clause requires the row you're creating
// to already claim auth.uid() = user_id; the value has to come from
// somewhere, and that somewhere is us.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";
import type { Allergen, Scan, ScanResult, Severity } from "./storage";

type Client = SupabaseClient<Database>;
type ScanRow = Database["public"]["Tables"]["scans"]["Row"];

// ----- Allergens -----

export async function getAllergensDb(supabase: Client): Promise<Allergen[]> {
  const { data, error } = await supabase
    .from("allergens")
    .select("id, label, severity")
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[db] getAllergensDb:", error.message);
    return [];
  }
  return data;
}

/**
 * Replaces a user's ENTIRE allergen list in one call: delete everything they
 * had, insert the list from the editor. Simple to reason about ("what's on
 * screen when you hit Save is now the truth"), and safe specifically because
 * scans never reference an allergen row by id — every scan freezes its own
 * copy in allergens_at_time (see supabase/migrations/..._scans.sql). Deleting
 * and recreating allergen rows can never corrupt scan history.
 *
 * Delete-before-insert is not just a style choice: allergens has a
 * UNIQUE(user_id, label) constraint, so inserting "Peanuts" again before the
 * old "Peanuts" row is gone would violate it.
 *
 * Known simplification, left as-is on purpose: this is two separate requests,
 * not one atomic transaction, so a connection drop between them could leave
 * a user with zero allergens saved. Rare, and a true fix means writing a
 * Postgres function — more machinery than a v1 project needs. Noting it
 * rather than hiding it.
 */
export async function replaceAllergensDb(
  supabase: Client,
  userId: string,
  allergens: { label: string; severity: Severity }[],
): Promise<boolean> {
  const { error: deleteError } = await supabase
    .from("allergens")
    .delete()
    .eq("user_id", userId);
  if (deleteError) {
    console.error("[db] replaceAllergensDb delete:", deleteError.message);
    return false;
  }

  if (allergens.length === 0) return true; // nothing to insert

  const { error: insertError } = await supabase.from("allergens").insert(
    allergens.map((a) => ({
      user_id: userId,
      label: a.label,
      severity: a.severity,
    })),
  );
  if (insertError) {
    console.error("[db] replaceAllergensDb insert:", insertError.message);
    return false;
  }
  return true;
}

// ----- Scans -----

/** Row (flat, snake_case, DB types) -> Scan (nested, camelCase, app types). */
function rowToScan(row: ScanRow): Scan {
  return {
    id: row.id,
    createdAt: new Date(row.created_at).getTime(),
    foodName: row.food_name ?? undefined,
    allergensAtTime: row.allergens_at_time.map((a) => ({
      id: a.id,
      label: a.label,
      severity: a.severity,
    })),
    result: {
      status: row.status,
      safe: row.status === "clear", // derived, not a separate column — see migration
      flaggedAllergies: row.flagged_allergies,
      flaggedIntolerances: row.flagged_intolerances,
      advisories: row.advisories,
      ingredients: row.ingredients,
      reasoning: row.reasoning,
    },
  };
}

export async function getScansDb(
  supabase: Client,
  limit = 50,
): Promise<Scan[]> {
  const { data, error } = await supabase
    .from("scans")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[db] getScansDb:", error.message);
    return [];
  }
  return data.map(rowToScan);
}

/**
 * Saves a completed scan. Called client-side from scan/page.tsx AFTER
 * /api/scan returns its verdict — the API route itself stays completely
 * unaware of accounts (see src/middleware.ts: /api/scan is deliberately
 * excluded from auth, so the red-team regression suite can keep calling it
 * standalone with no session). Analyzing a photo and saving the result to
 * someone's account are two separate concerns on purpose; this function is
 * the second one.
 */
export async function addScanDb(
  supabase: Client,
  userId: string,
  foodName: string | undefined,
  result: ScanResult,
  allergensAtTime: Allergen[],
): Promise<Scan | null> {
  const { data, error } = await supabase
    .from("scans")
    .insert({
      user_id: userId,
      food_name: foodName ?? null,
      status: result.status ?? (result.safe ? "clear" : "unreadable"),
      flagged_allergies: result.flaggedAllergies,
      flagged_intolerances: result.flaggedIntolerances,
      advisories: result.advisories,
      ingredients: result.ingredients,
      reasoning: result.reasoning,
      allergens_at_time: allergensAtTime,
    })
    .select("*")
    .single();
  if (error) {
    console.error("[db] addScanDb:", error.message);
    return null;
  }
  return rowToScan(data);
}

export async function deleteScanDb(
  supabase: Client,
  id: string,
): Promise<void> {
  // No .eq("user_id", ...) needed: RLS's USING clause means this can only
  // ever match a row that already belongs to the signed-in user, even if a
  // bug somewhere passed a different user's scan id.
  const { error } = await supabase.from("scans").delete().eq("id", id);
  if (error) console.error("[db] deleteScanDb:", error.message);
}

export async function clearScansDb(
  supabase: Client,
  userId: string,
): Promise<boolean> {
  // Here the .eq IS required: PostgREST refuses a DELETE with no filter at
  // all (a guardrail against accidentally wiping a whole table). RLS would
  // have scoped it to this user regardless, but PostgREST wants an explicit
  // condition in the request itself.
  const { error } = await supabase.from("scans").delete().eq("user_id", userId);
  if (error) {
    console.error("[db] clearScansDb:", error.message);
    return false;
  }
  return true;
}

// ----- Settings -----
// flag_may_contain lives as a column on profiles (see useProfile()), not a
// separate table — same "don't build a table for one boolean" reasoning
// from supabase/README.md. Reading it goes through useProfile(); this is
// just the write side.

export async function setFlagMayContainDb(
  supabase: Client,
  userId: string,
  value: boolean,
): Promise<boolean> {
  const { error } = await supabase
    .from("profiles")
    .update({ flag_may_contain: value })
    .eq("id", userId);
  if (error) {
    console.error("[db] setFlagMayContainDb:", error.message);
    return false;
  }
  return true;
}
