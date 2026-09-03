import type { Metadata } from "next"
import { connection } from "next/server"

import { AdminMfaPanel } from "@/components/admin/mfa-panel"
import { Eyebrow } from "@/components/brand"
import { requireAdminRead } from "@/lib/admin/auth"
import { PRIVATE_ROUTE_METADATA } from "@/lib/seo/metadata"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const metadata: Metadata = PRIVATE_ROUTE_METADATA

export default async function AdminSecurityPage() {
  await connection()
  // requireAdminRead never step-up-gates (reads stay open); the layout has
  // already rendered the step-up card if a challenge were pending, so this page
  // is only reached in the no-factor or satisfied state.
  const access = await requireAdminRead()
  // Database-sourced, so a session cookie predating the enrolment cannot make
  // the page offer first-factor enrolment to an already-enrolled admin.
  const enrolled = access.mfaEnrolled

  let factorId: string | null = null
  if (enrolled) {
    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase.rpc(
      "viewer_admin_webauthn_credential_id"
    )
    if (error) throw new Error("Unable to read the administrator credential.")
    factorId = typeof data === "string" ? data : null
  }

  return (
    <div className="space-y-6">
      <header>
        <Eyebrow>Security</Eyebrow>
        <h1 className="mt-2 text-3xl leading-tight font-extrabold">
          Two-factor authentication
        </h1>
      </header>
      <AdminMfaPanel enrolled={enrolled} factorId={factorId} />
    </div>
  )
}
