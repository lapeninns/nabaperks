import { notFound } from "next/navigation"

import { PageTitle } from "@/components/brand"
import { SendRewardForm } from "@/components/merchant/send-reward-form"
import { PUB_REWARD_PRESETS } from "@/lib/merchant/reward-presets"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Send-a-reward harness — mounts the real {@link SendRewardForm} inside the
 * merchant shell, DB-free. `?member=<id>` mounts the membership-prefilled variant
 * (contact field hidden); the default shows contact entry.
 */
export default async function SendRewardHarnessPage({
  searchParams,
}: {
  searchParams?: Promise<{ member?: string }>
}) {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  const params = searchParams ? await searchParams : {}
  const membershipId = params.member

  return (
    <div className="grid min-w-0 gap-6">
      <PageTitle
        eyebrow="Members"
        title="Send a reward"
        description="Give a member a reward outside the stamp card. It redeems like any other reward, and you choose when it expires."
      />
      <section className="grid gap-4 rounded-lg border border-border bg-card p-4 sm:p-6">
        <SendRewardForm
          membershipId={membershipId}
          memberLabel={membershipId ? "Phone ending 4242" : undefined}
          presets={PUB_REWARD_PRESETS}
        />
      </section>
    </div>
  )
}
