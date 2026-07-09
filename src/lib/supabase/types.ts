// TypeScript mirror of the database schema (supabase/migrations/*.sql).
//
// Postgres enforces the real rules (CHECK constraints, foreign keys, RLS);
// these types give the TypeScript compiler the same picture so a typo like
// .from("allergen") or a missing column fails at BUILD time instead of at
// runtime. Hand-written on purpose: it stays readable, and updating it when
// the schema changes forces us to actually think about the change.
//
// The Row / Insert split per table:
//   Row    = what a SELECT returns (every column present)
//   Insert = what you provide when creating a row. Columns the database
//            fills for you (id, created_at, defaults) are optional here.

import type { Advisory, ScanStatus, Severity } from "@/lib/storage";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string; // = auth.users id
          display_name: string | null;
          flag_may_contain: boolean;
          created_at: string; // timestamps arrive as ISO strings over JSON
          updated_at: string;
        };
        // Profiles are created by the signup trigger, never by the app,
        // so Insert only matters for typing; Update is what we use.
        Insert: {
          id: string;
          display_name?: string | null;
          flag_may_contain?: boolean;
        };
        Update: {
          display_name?: string | null;
          flag_may_contain?: boolean;
        };
        Relationships: [];
      };
      allergens: {
        Row: {
          id: string;
          user_id: string;
          label: string;
          severity: Severity; // DB CHECK constraint mirrors this union
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          label: string;
          severity: Severity;
        };
        Update: {
          label?: string;
          severity?: Severity;
        };
        Relationships: [];
      };
      scans: {
        Row: {
          id: string;
          user_id: string;
          food_name: string | null;
          status: ScanStatus; // DB CHECK constraint mirrors this union
          flagged_allergies: string[];
          flagged_intolerances: string[];
          ingredients: string[];
          advisories: Advisory[]; // jsonb column
          reasoning: string;
          allergens_at_time: { id: string; label: string; severity: Severity }[]; // jsonb snapshot
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          food_name?: string | null;
          status: ScanStatus;
          flagged_allergies?: string[];
          flagged_intolerances?: string[];
          ingredients?: string[];
          advisories?: Advisory[];
          reasoning?: string;
          allergens_at_time?: { id: string; label: string; severity: Severity }[];
        };
        // Scans are immutable (no UPDATE policy in the DB), so no Update type.
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
