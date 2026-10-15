import { cn } from "@/lib/cn";

/** Reference: Skeleton/Card. Decorative placeholder; pair with a status message for screen readers. */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cn("block animate-pulse rounded-sm bg-line-soft", className)} />;
}

export function SkeletonCard({ lines = 3, label = "Loading" }: { lines?: number; label?: string }) {
  return (
    <div role="status" className="rounded-md border border-border bg-surface p-5 shadow-card md:p-6">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-3 w-28" />
      <Skeleton className="mt-3 h-6 w-1/2" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: lines }, (_, index) => (
          <Skeleton key={index} className={cn("h-4", index === lines - 1 ? "w-2/3" : "w-full")} />
        ))}
      </div>
    </div>
  );
}
