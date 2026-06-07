import { AdminShell } from "@/components/layout"
import { getAdminAccess } from "@/lib/admin/auth"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const access = await getAdminAccess()

  if (access.status !== "allowed") {
    return (
      <main className="flex min-h-svh items-center justify-center px-6 py-10">
        <section className="w-full max-w-sm rounded-3xl border bg-card p-6 text-center shadow-xs">
          <p className="font-mono text-xs uppercase text-muted-foreground">
            Internal admin
          </p>
          <h1 className="mt-2 text-3xl font-extrabold leading-tight">
            Access denied
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {access.reason}
          </p>
        </section>
      </main>
    )
  }

  return <AdminShell mfaRequired={access.mfaRequired}>{children}</AdminShell>
}
