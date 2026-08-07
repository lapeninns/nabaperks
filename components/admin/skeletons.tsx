import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

/**
 * Panel-shaped fallbacks for the console. Every /admin/* segment shared one
 * route-level fallback showing a single panel while the routes themselves
 * render one to four, so the paint-in shifted layout substantially; and with
 * every readback awaited together, a slow consent query blocked the membership
 * lookup the operator actually wanted. These let each panel stream behind its
 * own <Suspense> boundary with a placeholder the same shape as the real thing.
 */
export function AdminPageTitleSkeleton() {
  return (
    <div className="grid gap-3">
      <Skeleton className="h-3 w-28" />
      <Skeleton className="h-9 w-56 max-w-full" />
      <Skeleton className="h-4 w-full max-w-xl" />
    </div>
  )
}

export function AdminPanelSkeleton({
  rows = 4,
  className,
}: {
  /** Row bars in the body — match the panel's usual density. */
  rows?: number
  className?: string
}) {
  return (
    <div
      role="status"
      aria-label="Loading panel"
      className={cn("surface-card grid gap-4 p-5", className)}
    >
      <Skeleton className="h-5 w-44 max-w-full" />
      <Skeleton className="h-4 w-full max-w-2xl" />
      <div className="grid gap-2">
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    </div>
  )
}

/** Flush (table) panel: header block, then a solid table-shaped body. */
export function AdminTableSkeleton({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Loading table"
      className={cn("surface-card grid gap-0 p-0", className)}
    >
      <div className="grid gap-3 border-b p-5">
        <Skeleton className="h-5 w-44 max-w-full" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>
      <div className="grid gap-2 p-5">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  )
}
