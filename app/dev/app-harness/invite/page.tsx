import { notFound } from "next/navigation"

import type { LoyaltyInviteState } from "@/app/app/customers/invite/actions"
import { PageTitle } from "@/components/brand"
import { InviteCustomersForm } from "@/components/merchant/invite-customers-form"
import { LOYALTY_INVITE_SEND_SUCCESS } from "@/lib/merchant/loyalty-invite-fields"
import type { LoyaltyInviteCampaignSummary } from "@/lib/merchant/loyalty-invites"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MERCHANT_NAME = "The Copper Kettle"
const SAMPLE = ["al•••@example.com", "jo•••@example.com", "sa•••@example.com"]
const RECIPIENTS_DRAFT = [
  "alex@example.com",
  "jordan@example.com",
  "sam@example.com",
  "priya@example.com",
  "morgan@example.com",
].join("\n")

function previewState(eligible: number): LoyaltyInviteState {
  return {
    step: "preview",
    fields: { recipients: RECIPIENTS_DRAFT },
    preview: {
      campaignId: "demo-campaign",
      eligible,
      invalid: 3,
      duplicate: 8,
      notEligible: eligible === 0 ? 165 : 12,
      sample: SAMPLE,
    },
  }
}

function mockCampaign(
  status: "sending" | "completed"
): LoyaltyInviteCampaignSummary {
  const base = {
    id: "demo-campaign",
    eligibleCount: 142,
    invalidCount: 3,
    duplicateCount: 8,
    notEligibleCount: 12,
    legalBasis: "venue_email_consent",
    createdAt: "2026-07-22T10:00:00.000Z",
    linkExpiresAt: null,
    sample: SAMPLE,
  }
  return status === "sending"
    ? {
        ...base,
        status: "sending",
        statusCounts: {
          queued: 40,
          sending: 2,
          sent: 60,
          delivered: 30,
          opened: 8,
          joined: 2,
        },
      }
    : {
        ...base,
        status: "completed",
        statusCounts: { sent: 50, delivered: 60, opened: 20, joined: 12 },
      }
}

/**
 * Invite-customers harness — mounts the real {@link InviteCustomersForm} inside
 * the merchant shell, DB-free, for keyboard / screen-reader / responsive proof.
 * `?state=` seeds each screen of the flow (the live preview/send server actions
 * still require auth + a database):
 *
 *   compose (default) · preview · none-eligible · sending · completed · sent
 */
export default async function InviteCustomersHarnessPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>
}) {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  const { state } = await searchParams

  let activeCampaign: LoyaltyInviteCampaignSummary | null = null
  let seedState: LoyaltyInviteState | undefined

  if (state === "sending") activeCampaign = mockCampaign("sending")
  else if (state === "completed") activeCampaign = mockCampaign("completed")
  else if (state === "preview") seedState = previewState(142)
  else if (state === "none-eligible") seedState = previewState(0)
  else if (state === "sent")
    seedState = { message: LOYALTY_INVITE_SEND_SUCCESS }

  return (
    <div className="grid max-w-5xl min-w-0 gap-6">
      <PageTitle
        eyebrow="Members"
        title="Invite customers"
        description="Email your customers a one-off invitation worth two welcome stamps. Only import lists you have a lawful basis to email — never bought, scraped or third-party addresses."
      />
      <InviteCustomersForm
        activeCampaign={activeCampaign}
        merchantName={MERCHANT_NAME}
        seedState={seedState}
      />
    </div>
  )
}
