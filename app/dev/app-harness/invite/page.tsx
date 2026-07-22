import { notFound } from "next/navigation"

import { PageTitle } from "@/components/brand"
import { InviteCustomersForm } from "@/components/merchant/invite-customers-form"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Invite-customers harness — mounts the real {@link InviteCustomersForm} inside
 * the merchant shell, DB-free, for keyboard / screen-reader / responsive proof.
 * The preview/send server actions still require auth + a database, so this
 * harness exercises the input step and accessibility, not the live journey.
 */
export default function InviteCustomersHarnessPage() {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  return (
    <div className="grid max-w-2xl min-w-0 gap-6">
      <PageTitle
        eyebrow="Members"
        title="Invite customers"
        description="Email your customers a one-off invitation worth two welcome stamps. Only import lists you have a lawful basis to email."
      />
      <InviteCustomersForm activeCampaign={null} />
    </div>
  )
}
