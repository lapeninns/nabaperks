import { notFound } from "next/navigation"

import { AdminMfaPanel } from "@/components/admin/mfa-panel"
import { AdminMfaStepUp } from "@/components/admin/mfa-step-up"
import { PageTitle } from "@/components/brand"

export const dynamic = "force-dynamic"

const SURFACES = new Set(["enroll", "enrolled", "step-up"])

/**
 * DB-free proof of the admin MFA panels. Production layout enrolment is
 * currently unreachable while getAdminAccess reports mfaRequired false; these
 * surfaces still exist and must stay copy-stable without granting authority.
 */
export default async function AdminMfaHarnessPage({
  searchParams,
}: {
  searchParams: Promise<{ surface?: string }>
}) {
  if (process.env.NODE_ENV === "production") notFound()

  const query = await searchParams
  const surface = SURFACES.has(query.surface ?? "") ? query.surface : "enroll"

  return (
    <div className="mx-auto grid min-h-dvh max-w-lg content-center gap-6 px-6 py-10">
      <PageTitle
        eyebrow="Harness"
        title="Administrator MFA"
        description="DB-free enrolment and step-up panels."
      />
      {surface === "enrolled" ? (
        <AdminMfaPanel
          enrolled
          factorId="00000000-0000-4000-8000-000000000099"
        />
      ) : null}
      {surface === "enroll" ? (
        <AdminMfaPanel enrolled={false} factorId={null} />
      ) : null}
      {surface === "step-up" ? (
        <AdminMfaStepUp operatorEmail="admin@nabaperks.test" />
      ) : null}
    </div>
  )
}
