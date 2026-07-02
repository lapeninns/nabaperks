import { Skeleton } from "@/components/ui/skeleton"

// Route-level fallback for every /admin/* segment: a page-title placeholder
// plus ONE panel-shaped block, holding the AdminShell steady (header, nav,
// operator tag stay put) while the service-role readbacks resolve. The panel
// block stands in for the first data panel every admin page renders, so heavy
// tables no longer pop in under a bare title. Mirrors the merchant
// route-level pattern in app/app/loading.tsx.
export default function AdminLoading() {
  return (
    <section
      role="status"
      aria-label="Loading admin workspace"
      className="grid gap-6"
    >
      <div className="grid gap-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-9 w-56 max-w-full" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <div className="surface-card grid gap-4 p-5">
        <Skeleton className="h-5 w-44 max-w-full" />
        <Skeleton className="h-4 w-full max-w-2xl" />
        <Skeleton className="h-40 w-full" />
      </div>
    </section>
  )
}
