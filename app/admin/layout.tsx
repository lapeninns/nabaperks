import { connection } from "next/server"

import { Eyebrow } from "@/components/brand"
import { AdminShell } from "@/components/layout"
import { getAdminAccess } from "@/lib/admin/auth"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await connection()
  const access = await getAdminAccess()

  if (access.status !== "allowed") {
    return (
      <main className="flex min-h-svh items-center justify-center px-6 py-10">
        <section className="surface-card w-full max-w-sm p-6 text-center">
          <Eyebrow>Internal admin</Eyebrow>
          <h1 className="mt-2 text-3xl leading-tight font-extrabold">
            Access denied
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {access.reason}
          </p>
        </section>
      </main>
    )
  }

  return (
    <AdminShell operatorEmail={access.email} mfaRequired={access.mfaRequired}>
      {children}
    </AdminShell>
  )
}
