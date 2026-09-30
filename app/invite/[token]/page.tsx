import { after } from "next/server"

import { InviteClaimPanel } from "@/components/customer/invite-claim-panel"
import { customerEmailAuthMode } from "@/lib/customer/email-auth-mode"
import {
  markInviteOpened,
  resolveInviteClaimContext,
} from "@/lib/loyalty-invites/claim-context"

import { startInviteClaimAction } from "./actions"
import { inviteNextStepCopy } from "./invite-copy"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const metadata = { robots: { index: false, follow: false } }

export default async function InviteClaimPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const context = await resolveInviteClaimContext(token)

  if (context.status === "available") {
    // "Opened" = the link was visited. Recorded after the response so it never
    // blocks or breaks the page render.
    after(() => markInviteOpened(context.claimTokenHash))
  }

  return (
    <InviteClaimPanel
      status={context.status}
      businessName={context.businessName}
      token={token}
      nextStep={inviteNextStepCopy(customerEmailAuthMode())}
      startAction={startInviteClaimAction}
    />
  )
}
