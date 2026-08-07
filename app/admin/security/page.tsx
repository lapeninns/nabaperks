import { AdminMfaPanel } from "@/components/admin/mfa-panel"
import { PageTitle } from "@/components/brand"
import { requireAdminRead } from "@/lib/admin/auth"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { connection } from "next/server"

// Every other admin route names its tab "Admin — X"; PRIVATE_ROUTE_METADATA
// left this one generic and unfindable among several open admin tabs.
export const metadata = { title: "Admin — Security" }

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
    const { data } = await supabase.auth.mfa.listFactors()
    factorId = data?.totp?.[0]?.id ?? null
  }

  return (
    // `grid gap-6` + PageTitle + the "Internal admin" eyebrow: the page used a
    // different spacing utility, a hand-rolled header, a different eyebrow
    // taxonomy and no description, so it visibly did not belong to the console.
    <div className="grid gap-6">
      <PageTitle
        eyebrow="Internal admin"
        title="Two-factor authentication"
        description="Authenticator enrolment and removal for your own admin account. Admin sign-in requires a code once a factor is enrolled."
      />
      <AdminMfaPanel enrolled={enrolled} factorId={factorId} />
    </div>
  )
}
