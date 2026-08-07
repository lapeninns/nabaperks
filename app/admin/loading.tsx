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
    <section
      role="status"
      aria-label="Loading admin workspace"
      className="grid gap-6"
    >
      <AdminPageTitleSkeleton />
      <AdminTableSkeleton />
    </section>
  )
}
