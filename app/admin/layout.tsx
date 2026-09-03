import type { Metadata } from "next"
import { connection } from "next/server"

import { AdminMfaStepUp } from "@/components/admin/mfa-step-up"
import { AdminMfaPanel } from "@/components/admin/mfa-panel"
import { Eyebrow } from "@/components/brand"
import { AdminShell } from "@/components/layout"
import { getAdminAccess } from "@/lib/admin/auth"
import { adminMfaStepUpRequired } from "@/lib/admin/mfa-gate"
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

  if (!access.mfaRequired) {
    return (
      <AdminShell operatorEmail={access.email} mfaRequired={false}>
        {children}
      </AdminShell>
    )
  }

  // A no-factor admin is confined to enrolment. Factor verification does not
  // activate authority: a trusted operator must independently approve it.
  if (!access.mfaEnrolled) {
    return (
      <main className="flex min-h-svh items-center justify-center px-6 py-10">
        <div className="w-full max-w-lg">
          <AdminMfaPanel enrolled={false} factorId={null} />
        </div>
      </main>
    )
  }

  if (!access.mfaActivated) {
    return (
      <main className="flex min-h-svh items-center justify-center px-6 py-10">
        <section className="surface-card w-full max-w-sm p-6 text-center">
          <Eyebrow>Internal admin</Eyebrow>
          <h1 className="mt-2 text-3xl leading-tight font-extrabold">
            Activation pending
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Your passkey or security key is enrolled. A trusted operator must
            activate admin access after verifying your identity.
          </p>
        </section>
      </main>
    )
  }

  // An activated admin whose session is still aal1 must step up before any
  // privileged shell or child route is rendered.
  if (adminMfaStepUpRequired(access.mfaState)) {
    return <AdminMfaStepUp operatorEmail={access.email} />
  }

  return (
    <AdminShell operatorEmail={access.email} mfaRequired={access.mfaRequired}>
      {children}
    </AdminShell>
  )
}
