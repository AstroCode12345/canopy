"use client";

import { usePathname } from "next/navigation";

/**
 * Root-level wrapper: caps every route to phone width (so pages that don't
 * self-apply max-w-md, like History/Profile/Disclaimer, don't sprawl on
 * wide viewports) and cross-fades between routes.
 *
 * Fullscreen overlays (the camera view, History's detail modal) use
 * `position: fixed`, which anchors to the real viewport regardless of this
 * wrapper's width — so they're unaffected by the phone-width cap here.
 */
export function PageShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div
      key={pathname}
      className="mx-auto w-full max-w-md flex-1 motion-safe:[animation:var(--animate-page-fade)]"
    >
      {children}
    </div>
  );
}
