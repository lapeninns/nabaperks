import { Skeleton } from "@/components/ui/skeleton"

// Route-level fallback for every /admin/* segment: a page-title placeholder that
// holds the AdminShell steady (header, nav, operator tag stay put) while the
// service-role readbacks resolve, instead of freezing on the previous page.
// Mirrors the merchant route-level pattern in app/app/loading.tsx; the shared
// PageTitle shape it stands in for is eyebrow + title + description.
export default function AdminLoading() {
  return (
    <section
      role="status"
      aria-label="Loading admin workspace"
      className="grid gap-3"
    >
      <Skeleton className="h-3 w-28" />
      <Skeleton className="h-9 w-56 max-w-full" />
      <Skeleton className="h-4 w-full max-w-xl" />
    </section>
  )
}
