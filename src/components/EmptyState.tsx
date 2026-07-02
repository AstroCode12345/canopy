import { Sparkles } from "lucide-react";

export function EmptyState() {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft">
        <Sparkles className="h-6 w-6 text-accent" strokeWidth={1.75} />
      </div>
      <p className="font-medium text-foreground">No scans yet</p>
      <p className="mt-1 text-sm text-muted">
        Tap the camera above to check your first label.
      </p>
    </div>
  );
}
