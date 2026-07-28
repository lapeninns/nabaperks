import type { Metadata } from "next"
import { connection } from "next/server"

import { AdminMfaPanel } from "@/components/admin/mfa-panel"
import { AdminMfaStepUp } from "@/components/admin/mfa-step-up"
import { Eyebrow } from "@/components/brand"
import { AdminShell } from "@/components/layout"
import { getAdminAccess } from "@/lib/admin/auth"
import { PRIVATE_ROUTE_METADATA } from "@/lib/seo/metadata"

export const metadata: Metadata = PRIVATE_ROUTE_METADATA

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

  switch (access.mfaState) {
    case "enrollment-required":
      return (
        <main className="flex min-h-svh items-center justify-center px-6 py-10">
          <section className="w-full max-w-lg space-y-5">
            <div className="text-center">
              <Eyebrow>Internal admin security</Eyebrow>
              <h1 className="mt-2 text-3xl leading-tight font-extrabold">
                Two-factor authentication is required
              </h1>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Set up an authenticator before using the admin console.
              </p>
            </div>
            <AdminMfaPanel enrolled={false} factorId={null} />
          </section>
        </main>
      )
    case "step-up-required":
      return <AdminMfaStepUp operatorEmail={access.email} />
    case "unavailable":
      return (
        <main className="flex min-h-svh items-center justify-center px-6 py-10">
          <section className="surface-card w-full max-w-sm p-6 text-center">
            <Eyebrow>Internal admin security</Eyebrow>
            <h1 className="mt-2 text-3xl leading-tight font-extrabold">
              Security check unavailable
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              We could not verify two-factor authentication. Refresh and try
              again.
            </p>
          </section>
        </main>
      )
    case "satisfied":
      return (
        <AdminShell
          operatorEmail={access.email}
          mfaRequired={access.mfaRequired}
        >
          {children}
        </AdminShell>
      )
  }
}
