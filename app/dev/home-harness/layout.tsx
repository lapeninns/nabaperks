import type { Metadata } from "next"
import type { ReactNode } from "react"
import { notFound } from "next/navigation"

import { CustomerAppShell } from "@/components/layout"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Home harness — customer wallet shell",
  robots: { index: false, follow: false },
}

/**
 * Unauthenticated customer-wallet harness. Mounts the REAL
 * {@link CustomerAppShell} (the same header + bottom tab bar the auth-gated
 * `/home` routes use) so the customer surface — including the new issued-reward
 * badges + expiry notes — is screenshot- and e2e-provable with NO Supabase
 * login. Additive scaffolding: no `/home` page or data path is modified. The
 * parent `app/dev/layout.tsx` already returns notFound in production; the guard
 * is repeated here for defence in depth.
 */
async function noopSignOutAction() {
  "use server"
}

export default function HomeHarnessLayout({
  children,
}: {
  children: ReactNode
}) {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  return (
    <CustomerAppShell signOutAction={noopSignOutAction}>
      {children}
    </CustomerAppShell>
  )
}
