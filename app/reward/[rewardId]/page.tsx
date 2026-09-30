import type { Metadata } from "next"

import { CustomerCardExperience } from "@/components/customer/customer-card-experience"
import { ProfileContactNotice } from "@/components/customer/profile-contact-notice"
import { readContactNoticeFlash } from "@/lib/customer/contact-notice-flash"
import { deriveCustomerExperience } from "@/lib/customer/experience/derive"
import { loadRewardExperienceContext } from "@/lib/customer/experience/load-reward"
import type { ProfileGate } from "@/lib/customer/experience/types"
import { getCurrentCustomer } from "@/lib/customer/identity"
import { PRIVATE_ROUTE_METADATA } from "@/lib/seo/metadata"

export const dynamic = "force-dynamic"
export const metadata: Metadata = {
  ...PRIVATE_ROUTE_METADATA,
  title: "My reward",
}

type RewardPageProps = {
  params: Promise<{
    rewardId: string
  }>
  searchParams: Promise<{
    reward?: string | string[]
    prepare?: string | string[]
  }>
}

export default async function RewardPage({
  params,
  searchParams,
}: RewardPageProps) {
  const { rewardId } = await params
  const query = await searchParams
  const context = await loadRewardExperienceContext(rewardId, {
    justRedeemed: firstParam(query.reward) === "redeemed",
    // The early "Get ready to collect" step. It only opens the existing profile
    // gate form — reward timing and collection eligibility stay server-derived
    // and are untouched by this flag.
    prepare: firstParam(query.prepare) === "1",
  })
  const derived = deriveCustomerExperience({ entry: "reward", context })
  // Bound to this customer and this reward's path; never read from the URL.
  const contactNotice = await readContactNoticeFlash({
    customerId: (await getCurrentCustomer())?.id ?? null,
    pathname: `/reward/${rewardId}`,
  })
  // Every dead end on this route is about a reward, so its copy says so
  // rather than "Card unavailable".
  const experience =
    derived.kind === "unavailable"
      ? { ...derived, subject: "reward" as const }
      : derived

  // The reward entry never derives `card_collecting` (see `deriveReward`), so
  // the discount-pass rail cannot render here. It should not: this screen has
  // one job — present the QR for this reward — and a second scannable
  // destination beside it invites the wrong code being shown at the counter.
  // The empty rail is passed explicitly so the decision is visible.
  return (
    <CustomerCardExperience
      experience={experience}
      offerPasses={[]}
      offerClaimNotice={null}
      // The reward gate's phone step redirects back here with a one-time
      // server-set notice once the number is confirmed, because the gate then
      // moves past the step and unmounts the form that would have shown it.
      notice={
        <ProfileContactNotice
          notice={contactNotice}
          confirmed={confirmedContacts(
            "profileGate" in context ? context.profileGate : undefined
          )}
          consume
        />
      }
    />
  )
}

/**
 * What the reward gate read from the server: the phone is confirmed unless
 * the gate still asks for it, the email once it is locked. No gate (a
 * redeemed or blocked reward) backs no notice.
 */
function confirmedContacts(gate: ProfileGate | undefined) {
  if (!gate) return { phone: false, email: false }
  return {
    phone: gate.needsPhoneVerification !== true,
    email: gate.emailLocked,
  }
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}
