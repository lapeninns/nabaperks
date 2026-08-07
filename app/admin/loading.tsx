import {
  AdminPageTitleSkeleton,
  AdminTableSkeleton,
} from "@/components/admin/skeletons"

// Route-level fallback for every /admin/* segment: a page-title placeholder
// plus a table-shaped panel block, holding the AdminShell steady (header, nav,
// operator tag stay put) while the service-role readbacks resolve. Per-panel
// streaming is owned by each route's <Suspense> boundaries; this is the shell
// of the first paint. Mirrors app/app/loading.tsx.
export default function AdminLoading() {
  return (
    <section aria-busy="true" className="grid gap-6">
      <p className="sr-only">Loading admin workspace…</p>
      <AdminPageTitleSkeleton />
      <AdminTableSkeleton />
    </section>
  )
}
