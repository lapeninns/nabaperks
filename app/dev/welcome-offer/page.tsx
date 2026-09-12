import Link from "next/link"
import { notFound } from "next/navigation"

import { MonoTag } from "@/components/brand"
import { CustomerCardExperience } from "@/components/customer/customer-card-experience"
import { JoinWizard } from "@/components/customer/join-wizard"
import { OfferClaimLanding } from "@/components/customer/offer-claim-landing"
import { OfferFlowShell } from "@/components/customer/offer-flow-shell"
import { OfferPassQr } from "@/components/customer/offer-pass-qr"
import {
  OfferPass,
  StatusBanner,
  type OfferPassState,
} from "@/components/loyalty"
import { OfferPassScanPanel } from "@/components/merchant/offer-pass-scan"
import { Button } from "@/components/ui/button"
import type { OfferPassScanStatus } from "@/lib/offers/redeem-core"
import {
  LONG_WELCOME_OFFER,
  WELCOME_CARD,
  WELCOME_OFFER,
  WELCOME_PASS,
  welcomeJoinExperience,
} from "./fixtures"

export const dynamic = "force-dynamic"

/** Real production components with controlled data, not a second implementation. */
export default async function WelcomeOfferHarness({
  searchParams,
}: {
  searchParams: Promise<{ surface?: string; state?: string; long?: string }>
}) {
  if (process.env.NODE_ENV === "production") notFound()
  const query = await searchParams
  const offer = query.long === "1" ? LONG_WELCOME_OFFER : WELCOME_OFFER

  if (["phone", "code", "terms"].includes(query.surface ?? "")) {
    return (
      <JoinWizard
        experience={welcomeJoinExperience(query.surface ?? "phone")}
        pendingOffer={WELCOME_OFFER}
      />
    )
  }
  if (query.surface === "card")
    return (
      <CustomerCardExperience
        experience={WELCOME_CARD}
        offerPasses={[WELCOME_PASS]}
        offerClaimNotice={query.state === "claimed" ? "claimed" : null}
      />
    )
  if (query.surface === "counter") {
    const status: Exclude<OfferPassScanStatus, "unauthorized"> =
      query.state === "expired" ||
      query.state === "redeemed" ||
      query.state === "blocked"
        ? query.state
        : "ready"
    return (
      <OfferFlowShell
        backHref="/app/scan"
        label="At the counter"
        className="pb-28"
      >
        <h1 className="text-3xl leading-tight font-extrabold">
          Check this pass.
        </h1>
        <OfferPassScanPanel
          stickyAction
          venueName={offer.venueName ?? "Venue"}
          redeemed={query.state === "redeemed"}
          context={{
            status,
            scanToken: "abcd1234-0000-4000-8000-0000000000f1",
            entitlementId: WELCOME_PASS.entitlementId,
            membershipId: WELCOME_PASS.membershipId,
            customerLabel: "Phone ending 0123",
            discountPercent: offer.discountPercent ?? 10,
            requiresIdCheck: offer.requiresIdCheck,
            extraTerms: offer.extraTerms ?? "",
            validFrom: offer.startsOn,
            validTo: offer.endsOn,
          }}
        />
      </OfferFlowShell>
    )
  }
  if (query.surface === "pass") {
    const state: OfferPassState =
      query.state === "expired" ||
      query.state === "revoked" ||
      query.state === "not_started"
        ? query.state
        : "active"
    const presentable = state === "active" && query.state !== "unavailable"
    return (
      <OfferFlowShell
        backHref="/dev/welcome-offer?surface=card"
        label="Your discount pass"
      >
        <h1 className="sr-only">Your discount pass</h1>
        <OfferPass
          venueName={offer.venueName ?? "Venue"}
          discountPercent={offer.discountPercent ?? 10}
          validFrom={offer.startsOn ?? ""}
          validTo={offer.endsOn ?? ""}
          requiresIdCheck={offer.requiresIdCheck}
          extraTerms={offer.extraTerms}
          state={state}
          termsExpanded={false}
          headingLevel="h2"
          statusTag={
            query.state === "unavailable" ? (
              <MonoTag tone="sun">Not available</MonoTag>
            ) : undefined
          }
        >
          {presentable ? (
            <OfferPassQr
              entitlementId={WELCOME_PASS.entitlementId}
              venueName={WELCOME_PASS.venueName}
              discountPercent={WELCOME_PASS.discountPercent}
            />
          ) : query.state === "unavailable" ? (
            <StatusBanner title="Not available just now" tone="warning">
              Your pass is safe and unchanged.
            </StatusBanner>
          ) : null}
        </OfferPass>
        <Button asChild variant="link" size="lg">
          <Link href="/dev/welcome-offer?surface=card">Back to your card</Link>
        </Button>
      </OfferFlowShell>
    )
  }
  return (
    <OfferFlowShell>
      <OfferClaimLanding
        {...offer}
        stickyAction
        claimAction={
          <Button asChild size="lg" className="w-full">
            <Link href="/dev/welcome-offer?surface=phone">
              Claim this offer
            </Link>
          </Button>
        }
      />
    </OfferFlowShell>
  )
}
