import type { ReactNode } from "react"

import Link from "next/link"
import { headers } from "next/headers"
import { after } from "next/server"

import { Logo, MonoTag, ReceiptCard } from "@/components/brand"
import { CustomerFlowShell } from "@/components/customer/customer-flow-system"
import { OfferClaimLanding } from "@/components/customer/offer-claim-landing"
import { UnavailableRecoveryActions } from "@/components/customer/unavailable-recovery"
import { SubmitButton } from "@/components/forms"
import { StatusBanner, type StatusBannerTone } from "@/components/loyalty"
import { Button } from "@/components/ui/button"
import { getCurrentCustomer } from "@/lib/customer/identity"
import {
  recordOfferCampaignOpen,
  resolveOfferClaimContext,
  type OfferClaimContext,
} from "@/lib/offers/claim-context"
import {
  RateLimitError,
  customerRateLimitIdentityFromHeaders,
  enforceRateLimit,
  rateLimitIdentityFromHeaders,
} from "@/lib/security/rate-limit"
import { CUSTOMER_DEVICE_HEADER } from "@/lib/security/rate-limit-core"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

import { startOfferClaimAction } from "./actions"

/**
 * Customer landing for a merchant offer campaign.
 *
 * The link is printed on a poster in the venue, so unlike a per-recipient
 * invitation it is a shared secret with a wide blast radius. Two consequences
 * are deliberate here: the route carries its own noindex metadata and is kept
 * OUT of PRIVATE_ROUTE_PREFIXES (listing a confidential path in robots.txt
 * advertises it), and every request passes a two-bucket rate limit — see
 * `enforceOfferLandingRateLimit` for why one bucket per address is the wrong
 * shape for a poster.
 *
 * The render only reads. Claiming happens after the customer has verified their
 * mobile and accepted the loyalty terms in the existing join flow; the action
 * below simply hands the validated token hash over in an encrypted cookie. The
 * one write this route makes is the "offer link opened" counter, and it is
 * issued from `after()` so it runs once the response has gone out and can
 * neither slow the page nor break it.
 *
 * The claimable screen itself is `OfferClaimLanding`, the one component step
 * three of the merchant creator also renders. This route owns the loading, the
 * limits, the counter and the claim form; it does not own a second copy of the
 * customer's words.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const metadata = {
  title: "An offer from your local · Nabaperks",
  robots: { index: false, follow: false },
}

const OFFER_DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
})

const OFFER_LANDING_WINDOW_MS = 15 * 60 * 1000
const OFFER_LANDING_DEVICE_LIMIT = 30
const OFFER_LANDING_ADDRESS_LIMIT = 600

/**
 * Two buckets, because one address is not one customer here.
 *
 * This link is printed and scanned in the room, so the traffic it is built for
 * is a surge of genuine people sharing a single address: the venue's guest
 * Wi-Fi, or a mobile carrier's NAT. A per-address-only allowance therefore
 * refuses exactly the customers the poster was printed for.
 *
 * The narrow bucket is per device. The proxy already mints a signed
 * `nabaperks_device` cookie on this route and forwards its id as a header, and
 * the customer identity below folds that together with the address. Thirty loads
 * in a quarter of an hour is far more than one phone needs, refreshes included.
 * It is enforced first so a single device hammering the link is cut off without
 * first spending the room's allowance.
 *
 * The wide bucket is the per-address ceiling that still has to exist. A brand
 * new browser has no device cookie on its very first request — the proxy sets it
 * on the way out — so first loads from one address all share one identity by
 * construction, and the narrow bucket cannot be relied on to admit them. Six
 * hundred loads in a quarter of an hour covers a full house several times over
 * while still bounding the work one address can ask of the database. It is not
 * what makes the link unguessable: the token is a 256-bit HMAC digest, so
 * walking the token space is hopeless with or without a limit.
 */
async function enforceOfferLandingRateLimit(
  requestHeaders: Headers
): Promise<void> {
  if (requestHeaders.get(CUSTOMER_DEVICE_HEADER)?.trim()) {
    await enforceRateLimit({
      key: `offer:device:${customerRateLimitIdentityFromHeaders(requestHeaders)}`,
      limit: OFFER_LANDING_DEVICE_LIMIT,
      windowMs: OFFER_LANDING_WINDOW_MS,
    })
  }

  await enforceRateLimit({
    key: `offer:ip:${rateLimitIdentityFromHeaders(requestHeaders)}`,
    limit: OFFER_LANDING_ADDRESS_LIMIT,
    windowMs: OFFER_LANDING_WINDOW_MS,
  })
}

export default async function OfferClaimPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  try {
    await enforceOfferLandingRateLimit(await headers())
  } catch (error) {
    if (error instanceof RateLimitError) {
      return (
        <OfferShell>
          {/* The rate-limited branch used to render a bare paragraph and no
              action whatsoever — the only dead end in the customer journey
              (CUS 02#65). */}
          <OfferRecovery tone="warning" title="Try again shortly">
            Too many attempts from here. Please try again in a few minutes.
          </OfferRecovery>
        </OfferShell>
      )
    }
    throw error
  }

  const context = await resolveOfferClaimContext(token)

  // "Opened" = this page loaded while the offer was actually claimable. It is
  // recorded after the response, so the merchant's count can never cost the
  // customer a millisecond or an error. Recorded here rather than below the
  // membership lookup because somebody who turns out to be a member still
  // opened a claimable link, and the merchant should see that interest.
  if (context.status === "available") {
    after(() => recordOfferCampaignOpen(context.claimTokenHash))
  }

  if (context.status !== "available") {
    const recovery = recoveryCopy(context)
    return (
      <OfferShell venue={context.businessName}>
        <OfferRecovery tone={recovery.tone} title={recovery.title}>
          {recovery.body}
        </OfferRecovery>
      </OfferShell>
    )
  }

  const member = await existingMember(
    context.merchantSlug,
    context.claimTokenHash
  )
  if (member) {
    return (
      <OfferShell
        title={
          member.claimedThisCampaign
            ? "You have already claimed this offer"
            : "You are already a member here"
        }
        venue={context.businessName}
      >
        <p className="text-sm leading-6 text-muted-foreground">
          {member.claimedThisCampaign
            ? "It is on your card already, so scanning again adds nothing. Open your card to see your stamps and any discount pass."
            : "This offer is a welcome for people joining for the first time, so there is nothing to add to your card. Your card is where it always is."}
        </p>
        <Button asChild size="lg" className="w-full">
          <Link href={`/card/${member.membershipId}`}>Open your card</Link>
        </Button>
      </OfferShell>
    )
  }

  const card = await venueCard(context.merchantSlug)

  return (
    <OfferShell>
      <OfferClaimLanding
        venueName={context.businessName}
        campaignName={context.campaignName}
        customerDescription={context.customerDescription}
        bonusStampCount={context.bonusStampCount}
        discountPercent={context.discountPercent}
        stampsRequired={card.stampsRequired}
        rewardName={card.rewardName}
        requiresIdCheck={context.requiresIdCheck}
        extraTerms={context.extraTerms}
        startsOn={context.startsOn}
        endsOn={context.endsOn}
        headingLevel="h1"
        claimAction={
          <form action={startOfferClaimAction} className="grid gap-3">
            <input type="hidden" name="token" value={token} />
            <SubmitButton
              size="lg"
              className="w-full"
              pendingLabel="Just a moment…"
            >
              Claim this offer
            </SubmitButton>
          </form>
        }
      />
    </OfferShell>
  )
}

/**
 * Page chrome only. A recovery state is a title and a sentence, so it passes
 * one; the claimable screen brings its own heading, because that heading is the
 * offer itself and belongs with the rest of the customer's copy.
 *
 * This used to be a hand-rolled `<main className="min-h-svh … px-4 py-10">` with
 * `gap-6`, a bare Logo and no `env(safe-area-inset-bottom)` at all — a fourth
 * customer column, on the screen that is many members' FIRST EVER Nabaperks
 * screen, whose claim button could sit under the iOS home indicator
 * (CUS 02#63). It now renders through CustomerFlowShell, so the header lockup,
 * the 410px column, the rhythm and the safe area are inherited rather than
 * re-guessed.
 */
function OfferShell({
  title,
  venue,
  children,
}: {
  title?: string
  venue?: string | null
  children: ReactNode
}) {
  const name = venue?.trim()

  return (
    <CustomerFlowShell dense screenLabel="Customer offer claim" eyebrow="Offer">
      {/* The shared shell carries no wordmark, so consolidating onto it would
          have dropped the only way back to /home from a cold scan. */}
      <Logo href="/home" />
      <ReceiptCard className="grid gap-4">
        {name ? <MonoTag tone="leaf">{name}</MonoTag> : null}
        {title ? (
          <div className="grid gap-1">
            <h1 className="text-xl leading-tight font-extrabold">{title}</h1>
          </div>
        ) : null}
        {children}
      </ReceiptCard>
    </CustomerFlowShell>
  )
}

/**
 * A scan that cannot be claimed still gets a way onward. The expired, paused
 * and not-started states used to end on a plain `<p>` with an underlined inline
 * link, and the rate-limited state offered NO action at all — in a product
 * whose stated rule is "never a dead end" (CUS 02#65). The message now carries
 * the tone that matches the state, and every non-claimable branch ends on the
 * same two recovery buttons the rest of the journey uses.
 */
function OfferRecovery({
  tone,
  title,
  children,
}: {
  tone: StatusBannerTone
  title: string
  children: ReactNode
}) {
  return (
    <>
      <StatusBanner tone={tone} title={title}>
        {children}
      </StatusBanner>
      <UnavailableRecoveryActions />
    </>
  )
}

/**
 * The five states a scan can land in, each with its own honest answer. A
 * campaign that has not opened yet must never be reported as expired, and an
 * ended campaign is indistinguishable from a replaced link by design — ending
 * scrubs the stored hash, so the page says both rather than guessing.
 */
function recoveryCopy(context: OfferClaimContext): {
  title: string
  body: string
  /**
   * Tone follows the state, not the fact that something did not happen. A
   * campaign that has not opened yet is good news with a date on it and reads
   * as info; one that has finished is neutral, not a warning (CUS 02#65).
   */
  tone: StatusBannerTone
} {
  const opens = formatOfferDate(context.startsOn)
  const closed = formatOfferDate(context.endsOn)

  if (context.status === "not_started") {
    return {
      title: opens
        ? `This offer opens on ${opens}`
        : "This offer has not opened yet",
      body: "Scan the code again once it opens and you can claim it then.",
      tone: "info",
    }
  }
  if (context.status === "paused") {
    return {
      title: "This offer is paused just now",
      body: "The venue has paused it for the moment. Try again later, or ask the team when it is back.",
      tone: "info",
    }
  }
  if (context.status === "expired") {
    return {
      title: "This offer has finished",
      body: closed
        ? `It ran until ${closed}. Ask the venue whether they have a new one.`
        : "Ask the venue whether they have a new one.",
      tone: "neutral",
    }
  }
  return {
    title: "This offer link is not available",
    body: "It may have finished, or the venue may have replaced the code. Ask the team for the current one.",
    tone: "neutral",
  }
}

function formatOfferDate(iso: string | null): string | null {
  if (!iso) return null
  const stamp = Date.parse(`${iso}T00:00:00Z`)
  return Number.isNaN(stamp)
    ? null
    : OFFER_DATE_FORMATTER.format(new Date(stamp))
}

/**
 * The membership this visitor already holds at the venue, when they happen to
 * be signed in. `claim_offer_campaign` refuses an existing member outright, so
 * showing them the card they already have is kinder than letting them walk the
 * whole join flow to be told no. A lookup failure is not fatal: the claim
 * itself is the authority, and the page falls back to the normal offer.
 */
/**
 * Where a signed-in member stands with this campaign.
 *
 * `claim_offer_campaign` already distinguishes a customer who claimed this
 * offer from one who was simply a member before it existed, so the page says
 * which it is rather than telling someone who claimed twenty minutes ago that
 * the offer "is a welcome for people joining for the first time".
 */
type ExistingMember = {
  readonly membershipId: string
  readonly claimedThisCampaign: boolean
}

async function existingMember(
  merchantSlug: string | null,
  claimTokenHash: string
): Promise<ExistingMember | null> {
  if (!merchantSlug) return null
  const customer = await getCurrentCustomer()
  if (!customer) return null

  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("customer_memberships")
    .select("id, merchants!inner(business_slug)")
    .eq("customer_id", customer.id)
    .eq("merchants.business_slug", merchantSlug)
    .maybeSingle()

  if (error || typeof data?.id !== "string") return null

  // A read failure here only costs the more specific sentence, never the card
  // link, so it degrades to the general "already a member" copy.
  const { data: claim } = await supabase
    .from("offer_campaign_claims")
    .select("id, offer_campaigns!inner(claim_token_hash)")
    .eq("customer_id", customer.id)
    .eq("offer_campaigns.claim_token_hash", claimTokenHash)
    .maybeSingle()

  return {
    membershipId: data.id,
    claimedThisCampaign: typeof claim?.id === "string",
  }
}

/**
 * The venue's active card, so the stamp row on the landing is drawn at the
 * length the venue actually runs. `create_offer_campaign_draft` bounds the
 * welcome stamps against the same card — oldest active card first — so the two
 * have to agree, and this repeats its ordering rather than picking its own.
 *
 * A card that cannot be read yields 0, which hides the stamp row rather than
 * drawing a length nobody set. The promise in words is unaffected.
 */
async function venueCard(
  merchantSlug: string | null
): Promise<{ stampsRequired: number; rewardName: string | null }> {
  const unknown = { stampsRequired: 0, rewardName: null }
  if (!merchantSlug) return unknown

  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("loyalty_cards")
    .select("stamps_required, reward_name, merchants!inner(business_slug)")
    .eq("merchants.business_slug", merchantSlug)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error || !data) return unknown

  const stampsRequired: unknown = data.stamps_required
  const rewardName: unknown = data.reward_name

  return {
    stampsRequired:
      typeof stampsRequired === "number" && Number.isInteger(stampsRequired)
        ? Math.max(stampsRequired, 0)
        : 0,
    rewardName:
      typeof rewardName === "string" && rewardName.trim()
        ? rewardName.trim()
        : null,
  }
}
