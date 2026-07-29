"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Clock, Camera, User, Settings } from "lucide-react";

const tabs = [
  { label: "Home", icon: Home, href: "/" },
  { label: "History", icon: Clock, href: "/history" },
  { label: "Scan", icon: Camera, href: "/scan", fab: true },
  { label: "Profile", icon: User, href: "/profile" },
  { label: "Settings", icon: Settings, href: "/settings" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    // print:hidden keeps app navigation off paper. The allergen card at
    // /card is the only thing in this app anyone prints, and the nav was
    // landing on it.
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] print:hidden">
      <ul className="mx-auto flex max-w-md items-end justify-around px-1.5 pb-3 pt-2.5">
        {tabs.map(({ label, icon: Icon, href, fab }) => {
          const active = pathname === href;

          if (fab) {
            return (
              <li key={label} className="flex-1">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  aria-label="Scan a label"
                  className="mx-auto flex w-full flex-col items-center gap-1"
                >
                  {/* ring-4 in the nav's own background colour is what makes
                      the FAB read as punched through the bar rather than
                      sitting on it. */}
                  <span className="-mt-6 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-white shadow-fab ring-4 ring-card transition-transform active:scale-95">
                    <Icon className="h-5 w-5" strokeWidth={1.8} />
                  </span>
                  <span className="font-mono text-[8px] font-bold uppercase tracking-[0.05em] text-accent-ink">
                    {label}
                  </span>
                </Link>
              </li>
            );
          }

          return (
            <li key={label} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className="mx-auto flex w-full flex-col items-center gap-[3px]"
              >
                <span
                  className={`flex h-[25px] w-9 items-center justify-center rounded-full transition-colors ${
                    active ? "bg-accent-soft text-accent-ink" : "text-faint"
                  }`}
                >
                  <Icon className="h-[17px] w-[17px]" strokeWidth={1.8} />
                </span>
                <span
                  className={`font-mono text-[8px] uppercase tracking-[0.05em] transition-colors ${
                    active
                      ? "font-bold text-accent-ink"
                      : "font-semibold text-faint"
                  }`}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
