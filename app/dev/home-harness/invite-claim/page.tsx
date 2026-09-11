import { notFound } from "next/navigation"

import { InviteClaimPanel } from "@/components/customer/invite-claim-panel"
import type { InviteClaimStatus } from "@/components/customer/invite-claim-panel"

import { harnessStartInviteClaimAction } from "./actions"

export const dynamic = "force-dynamic"

const STATES = new Set(["available", "expired", "unavailable", "claimed"])

export default async function InviteClaimHarnessPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>
}) {
  if (process.env.NODE_ENV === "production") notFound()

  const query = await searchParams
  const state = STATES.has(query.state ?? "") ? query.state : "available"

  if (state === "claimed") {
    return (
      <main className="mx-auto grid min-h-dvh max-w-md content-center gap-6 p-6 text-ink">
        <div className="rounded-lg border-2 border-ink bg-paper p-6">
          <h1 className="text-2xl font-extrabold">Continue on the join page</h1>
          <p className="mt-3 text-ink-soft">
            The invitation is ready to hand off. Phone verification and the two
            welcome stamps are proven in the database suite, not this harness.
          </p>
        </div>
      </main>
    )
  }

  return (
    <InviteClaimPanel
      status={state as InviteClaimStatus}
      businessName="The Test Arms"
      token="harness-invite-token"
      startAction={harnessStartInviteClaimAction}
    />
  )
}
