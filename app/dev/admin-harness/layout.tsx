import type { Metadata } from "next"
import type { ReactNode } from "react"
import { notFound } from "next/navigation"

import { AdminShell } from "@/components/layout"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Admin harness — /admin shell",
  robots: { index: false, follow: false },
}

/**
 * Unauthenticated ADMIN harness shell, the sibling of
 * `app/dev/app-harness/layout.tsx` (which mounts the merchant shell).
 *
 * It exists because the admin console's own container is what decides how its
 * panels behave at intermediate widths: `AdminShell` puts every page inside a
 * collapsible sidebar, a `SidebarInset`, a `px-4 py-5 sm:px-6 sm:py-6 lg:px-8
 * lg:py-8` ramp and a `max-w-merchant` (72rem) column. Measuring an admin
 * panel under the MERCHANT shell — which is where the existing `trial/*`
 * harnesses live — measures a different width chain and would be exactly the
 * harness drift that has already produced two wrong conclusions here.
 *
 * The REAL shell is mounted, with no Supabase session: `signOutAction` is
 * omitted (the harness signs nobody out) and the operator identity is an
 * obvious fixture. No /admin page, component or data path is modified.
 */
export default function AdminHarnessLayout({
  children,
}: {
  children: ReactNode
}) {
  if (process.env.NODE_ENV === "production") notFound()

  return (
    <AdminShell operatorEmail="harness@nabaperks.invalid" activePath="/admin">
      {children}
    </AdminShell>
  )
}
