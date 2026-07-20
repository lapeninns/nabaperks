import type { Metadata } from "next"
import { connection } from "next/server"
import { redirect } from "next/navigation"

import { Eyebrow } from "@/components/brand"
import { AdminShell } from "@/components/layout"
import { getAdminGate } from "@/lib/admin/auth"
import { PRIVATE_ROUTE_METADATA } from "@/lib/seo/metadata"

export const metadata: Metadata = PRIVATE_ROUTE_METADATA

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await connection()
  const gate = await getAdminGate()

  if (gate.status === "anonymous") {
    redirect("/login?next=/admin")
  }

  if (gate.status === "mfa_required") {
    redirect("/admin-mfa?next=/admin")
  }

  if (gate.status === "denied") {
    return (
      <main className="flex min-h-svh items-center justify-center px-6 py-10">
        <section className="surface-card w-full max-w-sm p-6 text-center">
          <Eyebrow>Internal admin</Eyebrow>
          <h1 className="mt-2 text-3xl leading-tight font-extrabold">
            Access denied
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {gate.reason}
          </p>
        </section>
      </main>
    )
  }

  return (
    <AdminShell operatorEmail={gate.email} mfaRequired={gate.mfaRequired}>
      {children}
    </AdminShell>
  )
}
