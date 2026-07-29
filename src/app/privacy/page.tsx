import Link from "next/link";
import {
  ArrowLeft,
  Camera,
  Database,
  Server,
  Trash2,
  UserCheck,
} from "lucide-react";
import { BottomNav } from "@/components/BottomNav";

export const metadata = {
  title: "Privacy",
  description: "What Canopy stores, what it never stores, and how to delete it.",
};

// Every claim on this page is checked against the actual schema in
// supabase/migrations/ and the actual request code. If you change what gets
// stored or what leaves the device, change this page in the same commit.
export default function PrivacyPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-6 pt-10 pb-2">
        <Link
          href="/settings"
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <h1 className="text-[23px] font-extrabold leading-[1.2]">Privacy</h1>
        <p className="mt-1 text-sm text-muted">
          What Canopy stores, what it never stores, and how to delete it.
        </p>
      </header>

      <main className="flex-1 space-y-4 px-6 pt-6 pb-32">
        <div className="rounded-2xl border border-accent/20 bg-accent-soft p-6">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-accent/15 text-accent">
            <Camera className="h-5 w-5" />
          </div>
          <h2 className="text-base font-semibold">
            Your label photos are never saved
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-foreground">
            When you scan, the photo is sent to Anthropic&apos;s Claude API to
            be read, and the text it found comes back. The photo itself is
            never written to Canopy&apos;s database and never stored on
            Canopy&apos;s servers. Nothing keeps it after your scan finishes.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-foreground">
            What does get saved is the result: the ingredients that were read,
            what got flagged, and the explanation.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-muted">
            <Database className="h-5 w-5" />
          </div>
          <h3 className="text-base font-semibold">What Canopy stores</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <span>
                Your email address and password, handled by Supabase Auth.
                Canopy never sees your password, only Supabase&apos;s
                encrypted version of it. If you sign in with Google, Canopy
                gets your email from Google and never sees that password
                either.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <span>The display name you chose, and your scan settings.</span>
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <span>
                Your allergen list: each name and whether you marked it severe
                or mild.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <span>
                Each scan: the name you gave it, the verdict, which allergens
                were flagged, the ingredients that were read, any &ldquo;may
                contain&rdquo; warnings, the written explanation, a copy of
                your allergen list as it was at that moment, and the date.
              </span>
            </li>
          </ul>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            That is the whole list. There is no analytics, no advertising, no
            tracking across other sites, and nothing is sold or shared with
            anyone for marketing.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-muted">
            <UserCheck className="h-5 w-5" />
          </div>
          <h3 className="text-base font-semibold">Only you can read it</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Every table is protected by Row Level Security, which is a rule
            enforced by the database itself rather than by app code. Your
            allergens and scans can only be read by a request carrying your
            own login. A bug in the app cannot hand someone else&apos;s data
            to you, because the database refuses the query regardless of what
            the app asks for.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-muted">
            <Server className="h-5 w-5" />
          </div>
          <h3 className="text-base font-semibold">
            Who else is involved in a scan
          </h3>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <span>
                <strong className="font-medium text-foreground">
                  Anthropic
                </strong>{" "}
                receives the label photo and your allergen names in order to
                read the label. Their handling of that data is governed by
                their own privacy and data usage policies.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <span>
                <strong className="font-medium text-foreground">
                  Open Food Facts
                </strong>{" "}
                receives only the barcode number when you scan a barcode. It
                is a free public food database, and it is not told anything
                about you or your allergens.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <span>
                <strong className="font-medium text-foreground">
                  Supabase
                </strong>{" "}
                hosts the database and handles logins.{" "}
                <strong className="font-medium text-foreground">Vercel</strong>{" "}
                hosts the app itself.
              </span>
            </li>
          </ul>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-danger-soft text-danger">
            <Trash2 className="h-5 w-5" />
          </div>
          <h3 className="text-base font-semibold">Deleting your data</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            You can download everything Canopy has saved, clear your scan
            history, or delete your entire account from Settings. Deleting the
            account removes your login, your profile, your allergens, and every
            scan. It happens immediately, it is not recoverable, and there is
            no waiting period or backup copy kept for you.
          </p>
          <Link
            href="/settings"
            className="mt-4 inline-flex items-center rounded-full bg-surface-2 px-5 py-2.5 text-sm font-semibold text-foreground ring-1 ring-border transition-colors hover:bg-accent-soft/40"
          >
            Go to Settings
          </Link>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <h3 className="text-base font-semibold">A note on what this is</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Canopy is a student project built by one person, not a company. It
            is described here as plainly and accurately as possible rather than
            in legal language. If something here is unclear or looks wrong,
            that is worth reporting, and the code is public so any of this can
            be checked directly.
          </p>
        </div>

        <p className="px-1 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
          Last updated 24 July 2026
        </p>
      </main>

      <BottomNav />
    </div>
  );
}
