"use client"

import { useState } from "react"
import Link from "next/link"
import {
  CheckmarkCircle02Icon,
  DiscountTag01Icon,
} from "@hugeicons/core-free-icons"

import type { OfferCampaignState } from "@/app/app/offers/actions"
import {
  EmptyState,
  Eyebrow,
  Icon,
  MonoTag,
  ReceiptCard,
  SectionHeader,
} from "@/components/brand"
import { HomeCardTile } from "@/components/customer/home-card-tile"
import { SubmitButton } from "@/components/forms"
import { OfferPass, StatusBanner } from "@/components/loyalty"
import { OfferCampaignForm } from "@/components/merchant/offer-campaign-form"
import {
  OfferActionNotice,
  OfferCampaignPanel,
} from "@/components/merchant/offer-campaign-panel"
import { MerchantOfferPassRedeemForm } from "@/components/merchant/offer-pass-redeem-form"
import { OFFER_BENEFIT_PRESETS } from "@/components/merchant/offers/offer-benefit-preview"
import { Button } from "@/components/ui/button"
import type { HomeCard } from "@/lib/customer/home-types"
import type { CustomerOfferPass } from "@/lib/customer/offer-pass"
import type { MerchantOfferCampaign } from "@/lib/merchant/offer-campaigns"
import { OFFERS_HOME_PATH, OFFERS_NEW_PATH } from "@/lib/merchant/offer-nav"
import type { OfferCampaignStatus } from "@/lib/offers/constants"
import {
  offerPassDiscountLabel,
  offerPassScanBanner,
  offerPassValidityLabel,
  type OfferPassScanStatus,
} from "@/lib/offers/redeem-core"

/**
 * DB-free QA lane for Merchant Offers and Campaign QR.
 *
 * Every state in the specification's QA matrix — empty, draft, scheduled, live,
 * paused, ended, error and long copy — is rendered here from static fixtures,
 * across the merchant desk, the three creator steps, the customer landing, the
 * customer pass and the staff redemption screen. Nothing on this lane reads a
 * database or a session, so the layouts are provable at 375, 768 and 1280 with
 * no Supabase and no login.
 *
 * Where a real component exists it is MOUNTED, not re-drawn: the desk states are
 * the real {@link OfferCampaignPanel}, the creator is the real
 * {@link OfferCampaignForm} seeded through its `seedState` prop, the pass face is
 * the real {@link OfferPass}, the staff confirm is the real
 * {@link MerchantOfferPassRedeemForm}, and the staff banner copy comes from the
 * real `offerPassScanBanner`. Two page-level compositions are private to their
 * routes and are therefore reproduced from the same brand primitives, and each
 * says so where it is defined: the customer landing shell and the staff pass
 * face. Every sentence copied across with them is pinned in
 * tests/contracts/offer-campaigns.test.mjs against the surface it came from, so
 * a lane showing last month's wording fails the gate rather than passing QA.
 *
 * Long copy means the maximums the database enforces, all at once: a
 * 60-character name, a 160-character customer description and 500 characters of
 * additional terms. If a layout can survive those three together it can survive
 * anything a merchant can type.
 *
 * Forms on this lane are inert by construction. The lifecycle buttons and the
 * redeem confirm post the real server actions, which prove a merchant session
 * before they do anything, so an automated run must read these screens rather
 * than submit them.
 */

// ─── Surfaces ─────────────────────────────────────────────────────────────────

const OFFER_HARNESS_SURFACES = ["desk", "creator", "customer", "staff"] as const

export type OfferHarnessSurface = (typeof OFFER_HARNESS_SURFACES)[number]

const OFFER_HARNESS_STEPS = ["benefits", "rules", "review"] as const

export type OfferHarnessStep = (typeof OFFER_HARNESS_STEPS)[number]

const SURFACE_LABELS: Record<OfferHarnessSurface, string> = {
  desk: "Merchant desk",
  creator: "Creator steps",
  customer: "Customer landing and pass",
  staff: "Staff redemption",
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const VENUE_NAME = "Old Crown Girton"
const STAMPS_REQUIRED = 3
const REWARD_NAME = "Free pint"

/** Fixed dates keep every screenshot on this lane byte-stable. */
const TODAY = "2026-08-03"
const OPENS = "2026-08-03"
const CLOSES = "2026-09-30"
const OPENS_LATER = "2026-09-01"
const LATEST_END = "2027-08-04"

const CLAIM_URL = "http://localhost:3000/offer/harness-claim-token"

// Valid uuid shapes: the pass and scan routes reject anything else outright, so
// a fixture that could never reach them would prove nothing about the links.
const CAMPAIGN_ID = "00000000-0000-4000-8000-0000000000c1"
const ENTITLEMENT_ID = "00000000-0000-4000-8000-0000000000e1"
// Hex, and deliberately not all digits: the staff screen prints the first eight
// characters of the membership id, and a merchant surface must never show
// anything that reads as a phone number.
const MEMBERSHIP_ID = "0f3a91cd-0000-4000-8000-0000000000b1"
const REWARD_ID = "00000000-0000-4000-8000-0000000000a1"
const SCAN_TOKEN = "00000000-0000-4000-8000-0000000000f1"

/** Exactly 60 characters — the CHECK on offer_campaigns.name. */
const LONG_NAME = "A midsummer welcome for new regulars at the Old Crown Girton"

/** Exactly 160 characters — the CHECK on offer_campaigns.customer_description. */
const LONG_DESCRIPTION =
  "Two welcome stamps on your card the moment you join, and ten per cent off the whole bill every single time you visit us while the summer offer is still running."

/** Exactly 500 characters — the CHECK on offer_campaigns.extra_terms. */
const LONG_TERMS =
  "Available on food and drink bought at the bar, and on table orders taken by a member of the team. Not available on tickets for ticketed events, on gift vouchers, or on drinks bought as part of a function booking made in advance. One pass to a person. The team may ask to see the pass before your order is rung through the till, so please have it open on your phone when you pay. If the kitchen is closed the discount still applies to drinks. Please be patient with the team on a busy night. Thank you"

function campaign(
  status: OfferCampaignStatus,
  overrides: Partial<MerchantOfferCampaign> = {}
): MerchantOfferCampaign {
  return {
    id: CAMPAIGN_ID,
    status,
    name: "Summer welcome",
    customerDescription:
      "Two stamps on your card the moment you join, and 10% off the whole bill while the offer runs.",
    bonusStampCount: 2,
    discountPercent: 10,
    startsOn: OPENS,
    endsOn: CLOSES,
    requiresIdCheck: false,
    extraTerms: null,
    tokenGeneration: 1,
    claimToken: "harness-claim-token",
    createdAt: "2026-08-01T09:00:00.000Z",
    publishedAt: status === "draft" ? null : "2026-08-03T09:30:00.000Z",
    pausedAt: status === "paused" ? "2026-08-19T17:05:00.000Z" : null,
    metrics: {
      linkOpens: 0,
      claims: 0,
      bonusStampsIssued: 0,
      activePasses: 0,
      passRedemptions: 0,
    },
    ...overrides,
  }
}

const RUNNING_METRICS = {
  // Comfortably larger than the claims beneath it: most people who open a
  // poster link never join, and a refresh or a link preview counts too.
  linkOpens: 412,
  claims: 34,
  bonusStampsIssued: 68,
  activePasses: 31,
  passRedemptions: 12,
} as const

const LIVE_PASS: CustomerOfferPass = {
  entitlementId: ENTITLEMENT_ID,
  membershipId: MEMBERSHIP_ID,
  venueName: VENUE_NAME,
  venueSlug: "old-crown-girton",
  discountPercent: 10,
  requiresIdCheck: false,
  extraTerms: null,
  validFrom: OPENS,
  validTo: CLOSES,
  state: "active",
  unavailableReason: null,
  presentable: true,
}

/** The card at the end of the journey: stamp three landed, reward redeemable. */
const REWARD_READY_CARD: HomeCard = {
  membershipId: MEMBERSHIP_ID,
  businessName: VENUE_NAME,
  businessSlug: "old-crown-girton",
  locality: "Girton",
  cardName: "Old Crown card",
  rewardName: REWARD_NAME,
  currentStamps: 3,
  stampsRequired: STAMPS_REQUIRED,
  stampDates: ["3 Aug", "3 Aug", "3 Aug"],
  stampedToday: true,
  lastVisitAt: "2026-08-03T18:20:00.000Z",
  stampsRemaining: 0,
  unlockedRewards: 1,
  stampRewardId: REWARD_ID,
  available: true,
}

/**
 * The same card the moment the offer was claimed. `stampedToday` is false even
 * though both welcome stamps landed today: offer stamps are written with a NULL
 * `earned_business_date`, which is exactly what leaves the customer's earned day
 * free for a normal venue-QR stamp on the same visit.
 */
const WELCOME_STAMPS_CARD: HomeCard = {
  ...REWARD_READY_CARD,
  currentStamps: 2,
  stampDates: ["3 Aug", "3 Aug"],
  stampedToday: false,
  stampsRemaining: 1,
  unlockedRewards: 0,
  stampRewardId: undefined,
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export function OffersHarnessClient({
  surface,
  step,
}: {
  readonly surface: OfferHarnessSurface
  readonly step: OfferHarnessStep
}) {
  return (
    <div className="grid min-w-0 gap-10">
      <SurfaceNav surface={surface} step={step} />
      {surface === "desk" ? <DeskSurface /> : null}
      {surface === "creator" ? <CreatorSurface step={step} /> : null}
      {surface === "customer" ? <CustomerSurface /> : null}
      {surface === "staff" ? <StaffSurface /> : null}
    </div>
  )
}

function SurfaceNav({
  surface,
  step,
}: {
  surface: OfferHarnessSurface
  step: OfferHarnessStep
}) {
  return (
    <nav aria-label="Offer harness surfaces" className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        {OFFER_HARNESS_SURFACES.map((entry) => (
          <Button
            key={entry}
            asChild
            size="sm"
            variant={entry === surface ? "default" : "secondary"}
          >
            <Link href={`/dev/app-harness/offers?surface=${entry}`}>
              {SURFACE_LABELS[entry]}
            </Link>
          </Button>
        ))}
      </div>
      {surface === "creator" ? (
        <div className="flex flex-wrap gap-2">
          {OFFER_HARNESS_STEPS.map((entry) => (
            <Button
              key={entry}
              asChild
              size="sm"
              variant={entry === step ? "default" : "ghost"}
            >
              <Link
                href={`/dev/app-harness/offers?surface=creator&step=${entry}`}
              >
                Step: {entry}
              </Link>
            </Button>
          ))}
        </div>
      ) : null}
    </nav>
  )
}

function HarnessSection({
  id,
  eyebrow,
  title,
  description,
  children,
}: {
  id: string
  eyebrow: string
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      data-harness-state={id}
      className="grid min-w-0 scroll-mt-6 gap-4"
    >
      <SectionHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
      />
      {children}
    </section>
  )
}

// ─── Merchant desk ────────────────────────────────────────────────────────────

function DeskSurface() {
  return (
    <>
      <HarnessSection
        id="desk-empty"
        eyebrow="Empty"
        title="No offer running"
        description="What a venue inside the pilot sees before it has ever created an offer."
      >
        {/* The hub's empty state is a private function of app/app/offers/page.tsx,
            so it is reproduced here from the same EmptyState primitive and the
            same OFFER_BENEFIT_PRESETS the real page maps over. */}
        <div className="grid gap-5">
          <EmptyState
            icon={DiscountTag01Icon}
            title="No offer running"
            description="Choose what new members get, set the dates, and print the campaign QR. Nothing goes live until you publish it."
            actions={
              <Button asChild>
                <Link href="/dev/app-harness/offers?surface=creator&step=benefits">
                  Create an offer
                </Link>
              </Button>
            }
          />
          <section className="grid gap-3" aria-label="What an offer can give">
            <Eyebrow>What an offer can give</Eyebrow>
            {/* Mirrors the hub's snap-scroll rail on the phone, three-up grid
                from sm — the two surfaces map the same presets. */}
            <ul className="flex snap-x [scrollbar-width:none] gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0 [&::-webkit-scrollbar]:hidden">
              {OFFER_BENEFIT_PRESETS.map((preset) => (
                <li
                  key={preset.kind}
                  className="grid w-60 shrink-0 snap-start content-start gap-1.5 rounded-lg border-[1.5px] border-border bg-card p-3 sm:w-auto sm:min-w-0 sm:p-4"
                >
                  <span className="flex items-center gap-2">
                    <Icon icon={preset.icon} size={16} />
                    <span className="text-sm font-semibold text-foreground">
                      {preset.title}
                    </span>
                  </span>
                  <span className="text-xs leading-5 text-muted-foreground">
                    {preset.description}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </HarnessSection>

      <DeskState
        id="desk-draft"
        eyebrow="Draft"
        title="Saved, and nobody can claim it yet"
        campaign={campaign("draft")}
        claimUrl={null}
      />

      <DeskState
        id="desk-scheduled"
        eyebrow="Scheduled"
        title="Published ahead of its opening date"
        campaign={campaign("scheduled", { startsOn: OPENS_LATER })}
      />

      <DeskState
        id="desk-live"
        eyebrow="Live"
        title="Accepting claims, with the counts recorded so far"
        campaign={campaign("live", { metrics: { ...RUNNING_METRICS } })}
      />

      <DeskState
        id="desk-paused"
        eyebrow="Paused"
        title="No new claims, and issued passes keep working"
        campaign={campaign("paused", { metrics: { ...RUNNING_METRICS } })}
      />

      <DeskState
        id="desk-ended"
        eyebrow="Ended"
        title="Terminal, with the link switched off for good"
        campaign={campaign("ended", {
          claimToken: null,
          metrics: { ...RUNNING_METRICS },
        })}
        claimUrl={null}
      />

      <HarnessSection
        id="desk-error"
        eyebrow="Error"
        title="A lifecycle action failed, and the link cannot be shown"
        description="The notice is rendered from a closed set of codes, so an edited query string can only ever select copy the console already owns."
      >
        <div className="grid gap-5">
          <OfferActionNotice error="link" />
          <OfferCampaignPanel
            campaign={campaign("live", { metrics: { ...RUNNING_METRICS } })}
            claimUrl={null}
            qrHref={`${OFFERS_HOME_PATH}/${CAMPAIGN_ID}/qr`}
            qrImageHref={`${OFFERS_HOME_PATH}/${CAMPAIGN_ID}/qr.png`}
            returnTo={OFFERS_HOME_PATH}
            stampsRequired={STAMPS_REQUIRED}
          />
        </div>
      </HarnessSection>

      <DeskState
        id="desk-long-copy"
        eyebrow="Long copy"
        title="Every merchant-authored field at its maximum length"
        description="A 60-character name, a 160-character customer description and 500 characters of additional terms, all at once."
        campaign={campaign("live", {
          name: LONG_NAME,
          customerDescription: LONG_DESCRIPTION,
          extraTerms: LONG_TERMS,
          requiresIdCheck: true,
          discountPercent: 25,
          metrics: { ...RUNNING_METRICS },
        })}
      />
    </>
  )
}

function DeskState({
  id,
  eyebrow,
  title,
  description,
  campaign: fixture,
  claimUrl = CLAIM_URL,
}: {
  id: string
  eyebrow: string
  title: string
  description?: string
  campaign: MerchantOfferCampaign
  claimUrl?: string | null
}) {
  return (
    <HarnessSection
      id={id}
      eyebrow={eyebrow}
      title={title}
      description={description}
    >
      <OfferCampaignPanel
        campaign={fixture}
        claimUrl={claimUrl}
        qrHref={`${OFFERS_HOME_PATH}/${fixture.id}/qr`}
        qrImageHref={`${OFFERS_HOME_PATH}/${fixture.id}/qr.png`}
        returnTo={OFFERS_HOME_PATH}
        stampsRequired={STAMPS_REQUIRED}
      />
    </HarnessSection>
  )
}

// ─── Creator ──────────────────────────────────────────────────────────────────

const REVIEW_SEED: OfferCampaignState = {
  step: "review",
  campaignId: CAMPAIGN_ID,
  message: "Your offer is saved as a draft. Nothing is live until you publish.",
  fields: {
    benefitKind: "both",
    name: LONG_NAME,
    customerDescription: LONG_DESCRIPTION,
    bonusStampCount: "2",
    discountPercent: "10",
    startsOn: OPENS,
    endsOn: CLOSES,
    requiresIdCheck: true,
    extraTerms: LONG_TERMS,
  },
}

const RULES_SEED: OfferCampaignState = {
  step: "rules",
  fields: REVIEW_SEED.fields,
}

/**
 * Pin this lane's address bar for as long as the creator is mounted.
 *
 * The creator keeps the address bar in step with `/app/offers/new`, which is
 * right on its own route and destructive here: the console router adopts the
 * new canonical URL, the authenticated route redirects, and the harness lane is
 * replaced by the login screen — mid-audit, and with no interaction to blame it
 * on. Only calls aimed at the creator's own route are swallowed; every other
 * call, including everything the router does for itself, passes straight
 * through.
 *
 * The patch is installed during render rather than in an effect because a
 * child's effects run before its parent's, so an effect here would always be
 * too late. It is never restored: it is inert outside `/app/offers/new`, and
 * leaving the lane reloads the document anyway.
 */
function usePinnedAddressBar(): void {
  useState(() => {
    if (typeof window === "undefined") return false

    const original = window.history.replaceState.bind(window.history)
    window.history.replaceState = function pinnedReplaceState(
      data: unknown,
      unused: string,
      url?: string | URL | null
    ) {
      if (typeof url === "string" && url.startsWith(OFFERS_NEW_PATH)) return
      original(data, unused, url)
    }

    return true
  })
}

/**
 * One creator instance per render. The real form keeps the address bar in step
 * with the step being shown, so mounting three at once would leave three of them
 * arguing over one URL — and it rewrites this lane's address bar to
 * `/app/offers/new?step=…` after hydration, so an automated run must reach each
 * step with a fresh navigation rather than a reload.
 *
 * The seeds carry the copy at its maximum lengths on purpose: the rules and
 * review steps are where a 60-character name, a 160-character description and
 * 500 characters of terms first have to fit next to one another.
 */
function CreatorSurface({ step }: { step: OfferHarnessStep }) {
  const seedState =
    step === "review" ? REVIEW_SEED : step === "rules" ? RULES_SEED : undefined

  usePinnedAddressBar()

  return (
    <HarnessSection
      id={`creator-${step}`}
      eyebrow="Creator"
      title={
        step === "benefits"
          ? "Step one — what does this offer give?"
          : step === "rules"
            ? "Step two — the rules, at their maximum lengths"
            : "Step three — review and publish, with the customer preview"
      }
      description="The real three-step creator, seeded through the seedState prop it exposes for exactly this lane."
    >
      <OfferCampaignForm
        merchantName={VENUE_NAME}
        stampsRequired={STAMPS_REQUIRED}
        rewardName={REWARD_NAME}
        today={TODAY}
        latestEndDate={LATEST_END}
        initialStep={step}
        seedState={seedState}
      />
    </HarnessSection>
  )
}

// ─── Customer ─────────────────────────────────────────────────────────────────

function CustomerSurface() {
  return (
    <>
      <HarnessSection
        id="landing-available"
        eyebrow="Landing · available"
        title="The offer a new customer scans into"
      >
        <LandingShell venue={VENUE_NAME} campaignName="Summer welcome">
          <h3 className="text-xl leading-tight font-extrabold text-balance">
            2 bonus stamps and 10% off to start with
          </h3>
          <p className="text-sm leading-6 text-foreground">
            Two stamps on your card the moment you join, and 10% off the whole
            bill while the offer runs.
          </p>
          {/* The real landing renders these lines as a compact checkmark
              list; the transcription keeps the same shape and wording. */}
          <ul className="grid gap-1.5 text-sm leading-6 text-muted-foreground">
            <li className="flex items-start gap-1.5">
              <Icon
                icon={CheckmarkCircle02Icon}
                size={16}
                className="mt-1 shrink-0 text-reward"
              />
              <span className="min-w-0">
                2 bonus stamps added to your card the moment you join. There is
                no app to download.
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <Icon
                icon={CheckmarkCircle02Icon}
                size={16}
                className="mt-1 shrink-0 text-reward"
              />
              <span className="min-w-0">
                A 10% discount pass you can use as often as you like while the
                offer runs.
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <Icon
                icon={CheckmarkCircle02Icon}
                size={16}
                className="mt-1 shrink-0 text-reward"
              />
              <span className="min-w-0">
                The offer runs until 30 September 2026.
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <Icon
                icon={CheckmarkCircle02Icon}
                size={16}
                className="mt-1 shrink-0 text-reward"
              />
              <span className="min-w-0">
                The discount cannot be used with any other offer.
              </span>
            </li>
          </ul>
          <ClaimForm />
        </LandingShell>
      </HarnessSection>

      <HarnessSection
        id="landing-long-copy"
        eyebrow="Landing · long copy"
        title="The same landing at every maximum length"
      >
        <LandingShell venue={VENUE_NAME} campaignName={LONG_NAME}>
          <h3 className="text-xl leading-tight font-extrabold text-balance">
            2 bonus stamps and 25% off to start with
          </h3>
          <p className="text-sm leading-6 text-foreground">
            {LONG_DESCRIPTION}
          </p>
          <ul className="grid gap-1.5 text-sm leading-6 text-muted-foreground">
            <li className="flex items-start gap-1.5">
              <Icon
                icon={CheckmarkCircle02Icon}
                size={16}
                className="mt-1 shrink-0 text-reward"
              />
              <span className="min-w-0">
                The offer runs until 30 September 2026.
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <Icon
                icon={CheckmarkCircle02Icon}
                size={16}
                className="mt-1 shrink-0 text-reward"
              />
              <span className="min-w-0">
                Bring photo identification when you use the discount.
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <Icon
                icon={CheckmarkCircle02Icon}
                size={16}
                className="mt-1 shrink-0 text-reward"
              />
              <span className="min-w-0">
                The discount cannot be used with any other offer.
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <Icon
                icon={CheckmarkCircle02Icon}
                size={16}
                className="mt-1 shrink-0 text-reward"
              />
              <span className="min-w-0">{LONG_TERMS}</span>
            </li>
          </ul>
          <ClaimForm />
        </LandingShell>
      </HarnessSection>

      <HarnessSection
        id="landing-recovery"
        eyebrow="Landing · recovery"
        title="Not started, paused, expired, replaced and already a member"
        description="Five closed states. A campaign that has not opened yet is never reported as finished, and an ended link is indistinguishable from a rotated one by design."
      >
        <div className="grid gap-4">
          <LandingShell
            venue={VENUE_NAME}
            title="This offer opens on 1 September 2026"
          >
            <p className="text-sm leading-6 text-muted-foreground">
              Scan the code again once it opens and you can claim it then.
            </p>
          </LandingShell>
          <LandingShell
            venue={VENUE_NAME}
            title="This offer is paused just now"
          >
            <p className="text-sm leading-6 text-muted-foreground">
              The venue has paused it for the moment. Try again later, or ask
              the team when it is back.
            </p>
          </LandingShell>
          <LandingShell venue={VENUE_NAME} title="This offer has finished">
            <p className="text-sm leading-6 text-muted-foreground">
              It ran until 30 September 2026. Ask the venue whether they have a
              new one.
            </p>
          </LandingShell>
          <LandingShell title="This offer link is not available">
            <p className="text-sm leading-6 text-muted-foreground">
              It may have finished, or the venue may have replaced the code. Ask
              the team for the current one.
            </p>
          </LandingShell>
          <LandingShell
            venue={VENUE_NAME}
            title="You are already a member here"
          >
            <p className="text-sm leading-6 text-muted-foreground">
              This offer is a welcome for people joining for the first time, so
              there is nothing to add to your card. Your card is where it always
              is.
            </p>
            <Button asChild size="lg" className="w-full">
              <Link href={`/card/${MEMBERSHIP_ID}`}>Open your card</Link>
            </Button>
          </LandingShell>
        </div>
      </HarnessSection>

      <HarnessSection
        id="pass-faces"
        eyebrow="Pass"
        title="The held pass in each of its four states"
        description="A pass that cannot be used shows the same face and no code at all — a scannable code that would be refused at the till is worse than none."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <OfferPass
            venueName={VENUE_NAME}
            discountPercent={10}
            validFrom={OPENS}
            validTo={CLOSES}
            requiresIdCheck={false}
            state="active"
          >
            <p className="rounded-lg bg-secondary px-3 py-2 text-center text-sm font-bold text-foreground">
              A team member scans this before they apply the discount
            </p>
          </OfferPass>
          <OfferPass
            venueName={VENUE_NAME}
            discountPercent={10}
            validFrom={OPENS_LATER}
            validTo={CLOSES}
            requiresIdCheck
            state="not_started"
          />
          <OfferPass
            venueName={VENUE_NAME}
            discountPercent={10}
            validFrom="2026-05-01"
            validTo="2026-06-30"
            requiresIdCheck={false}
            state="expired"
          />
          <OfferPass
            venueName={VENUE_NAME}
            discountPercent={10}
            validFrom={OPENS}
            validTo={CLOSES}
            requiresIdCheck={false}
            state="revoked"
          />
        </div>
        <OfferPass
          venueName={VENUE_NAME}
          discountPercent={25}
          validFrom={OPENS}
          validTo={CLOSES}
          requiresIdCheck
          extraTerms={LONG_TERMS}
          state="active"
        >
          <StatusBanner title="Not available just now" tone="warning">
            The venue has paused its loyalty programme. Your pass is safe — it
            will be here when the venue is back.
          </StatusBanner>
        </OfferPass>
      </HarnessSection>

      <HarnessSection
        id="pass-rail"
        eyebrow="Pass rail"
        title="The route from the home tile to the pass code"
        description="The tile below points at the redeemable stamp reward, not the card. The pass chip therefore carries its own link, outside the tile's anchor, or the customer could see the pass and never open it."
      >
        <div className="grid gap-6 sm:max-w-md">
          <div className="grid gap-2">
            <Eyebrow>Two welcome stamps, no reward yet</Eyebrow>
            <HomeCardTile
              card={WELCOME_STAMPS_CARD}
              offerPasses={[LIVE_PASS]}
            />
          </div>
          <div className="grid gap-2">
            <Eyebrow>Stamp three landed, reward redeemable</Eyebrow>
            <HomeCardTile card={REWARD_READY_CARD} offerPasses={[LIVE_PASS]} />
          </div>
          <div className="grid gap-2">
            <Eyebrow>Venue cannot honour the pass — chip, and no code</Eyebrow>
            <HomeCardTile
              card={REWARD_READY_CARD}
              offerPasses={[
                {
                  ...LIVE_PASS,
                  presentable: false,
                  unavailableReason:
                    "The venue has paused its loyalty programme.",
                },
              ]}
            />
          </div>
        </div>
      </HarnessSection>
    </>
  )
}

/**
 * The claim landing's card, reproduced from the same ReceiptCard and MonoTag the
 * real route uses. The route's own shell wraps this in a `<main>` and a Logo,
 * which the console lane already provides — a second main landmark here would be
 * an accessibility defect invented by the harness rather than found by it.
 */
function LandingShell({
  venue,
  campaignName,
  title,
  children,
}: {
  venue?: string
  campaignName?: string
  title?: string
  children: React.ReactNode
}) {
  return (
    <ReceiptCard className="grid max-w-customer gap-4">
      {venue ? <MonoTag tone="leaf">{venue}</MonoTag> : null}
      {campaignName ? <p className="eyebrow">{campaignName}</p> : null}
      {title ? (
        <h3 className="text-xl leading-tight font-extrabold">{title}</h3>
      ) : null}
      {children}
    </ReceiptCard>
  )
}

/** Inert: a client-side form action, so nothing is posted from the harness. */
function ClaimForm() {
  return (
    <form action={() => undefined} className="grid gap-3">
      <SubmitButton size="lg" className="w-full" pendingLabel="Just a moment…">
        Claim this offer
      </SubmitButton>
    </form>
  )
}

// ─── Staff redemption ─────────────────────────────────────────────────────────

const SCAN_STATES: ReadonlyArray<{
  readonly id: string
  readonly status: OfferPassScanStatus
  readonly label: string
  readonly blockedReason?: string
}> = [
  { id: "scan-ready", status: "ready", label: "Ready to redeem" },
  { id: "scan-redeemed", status: "redeemed", label: "Code already used" },
  { id: "scan-expired", status: "expired", label: "Code expired" },
  {
    id: "scan-unauthorized",
    status: "unauthorized",
    label: "Pass belongs to another venue",
  },
  {
    id: "scan-blocked",
    status: "blocked",
    label: "Blocked",
    blockedReason: "This pass is outside its dates.",
  },
]

function StaffSurface() {
  return (
    <>
      {SCAN_STATES.map((state) => (
        <HarnessSection
          key={state.id}
          id={state.id}
          eyebrow="Staff scan"
          title={state.label}
        >
          <StaffScanScreen
            status={state.status}
            blockedReason={state.blockedReason}
            requiresIdCheck={state.status === "ready"}
          />
        </HarnessSection>
      ))}

      <HarnessSection
        id="scan-long-copy"
        eyebrow="Staff scan · long copy"
        title="A pass carrying 500 characters of additional terms"
      >
        <StaffScanScreen
          status="ready"
          requiresIdCheck
          extraTerms={LONG_TERMS}
          discountPercent={25}
        />
      </HarnessSection>
    </>
  )
}

/**
 * The staff deep link, reproduced from the same ReceiptCard, StatusBanner and
 * redeem form the route composes — the route's own PassFace and PassScanShell
 * are private to it. The banner copy is not re-typed: it comes from the real
 * `offerPassScanBanner`, so a change to what staff are told fails here too.
 */
function StaffScanScreen({
  status,
  blockedReason,
  requiresIdCheck,
  extraTerms = null,
  discountPercent = 10,
}: {
  status: OfferPassScanStatus
  blockedReason?: string
  requiresIdCheck: boolean
  extraTerms?: string | null
  discountPercent?: number
}) {
  const banner = offerPassScanBanner(status, blockedReason)
  const validity = offerPassValidityLabel(CLOSES)

  return (
    <div className="mx-auto grid w-full max-w-xl gap-4">
      <ReceiptCard edge padding="md">
        <Eyebrow>Discount pass</Eyebrow>
        {/* Mirrors the route's PassFace: the two facts staff check first, read
            across a counter as one line. */}
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="text-3xl font-extrabold tracking-tight">
            {offerPassDiscountLabel(discountPercent)}
          </p>
          {validity ? (
            <p className="text-sm font-bold text-muted-foreground">
              {validity}
            </p>
          ) : null}
        </div>
        {extraTerms ? (
          <p className="text-sm leading-6 text-muted-foreground">
            {extraTerms}
          </p>
        ) : null}
        <p className="text-sm leading-6 text-muted-foreground">
          {requiresIdCheck ? "Photo ID check required. " : null}
          Cannot be used with another reward or offer.
        </p>
      </ReceiptCard>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl border-2 border-ink bg-card p-4 text-sm">
        <dt className="font-bold text-muted-foreground">Member</dt>
        {/* Merchant surfaces show a masked identifier and never a number. */}
        <dd className="text-right font-bold">Phone ending 421</dd>
        <dt className="font-bold text-muted-foreground">Card</dt>
        <dd className="mono-id text-right">{MEMBERSHIP_ID.slice(0, 8)}</dd>
      </dl>

      <StatusBanner title={banner.title} tone={banner.tone}>
        {banner.body}
      </StatusBanner>

      {status === "ready" ? (
        <MerchantOfferPassRedeemForm
          scanToken={SCAN_TOKEN}
          discountPercent={discountPercent}
          requiresIdCheck={requiresIdCheck}
        />
      ) : null}
    </div>
  )
}
