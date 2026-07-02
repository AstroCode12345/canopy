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
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/70 pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex max-w-md items-end justify-around px-2">
        {tabs.map(({ label, icon: Icon, href, fab }) => {
          const active = pathname === href;

          if (fab) {
            return (
              <li key={label} className="flex-1">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  aria-label="Scan a label"
                  className="mx-auto flex w-full flex-col items-center gap-1 pb-2.5 pt-2"
                >
                  <span className="-mt-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-white shadow-[0_10px_20px_-6px_rgb(28_122_83/0.6)] ring-4 ring-card transition-transform active:scale-95">
                    <Icon className="h-6 w-6" strokeWidth={2} />
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-accent">
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
                className={`mx-auto flex w-full flex-col items-center gap-1 py-3 transition-colors ${
                  active ? "text-accent" : "text-muted/60 hover:text-foreground"
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={1.75} />
                <span className="text-[10px] font-semibold uppercase tracking-wider">
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
