import type { Metadata } from "next"
import Link from "next/link"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { AlertDiamondIcon } from "@hugeicons/core-free-icons"

import { EmptyState } from "@/components/brand"
import { CanonicalUrl } from "@/components/customer/canonical-url"
import { CustomerCardExperience } from "@/components/customer/customer-card-experience"
import {
  CustomerFlowShell,
  CustomerReceipt,
} from "@/components/customer/customer-flow-system"
import { UnavailableRecoveryActions } from "@/components/customer/unavailable-recovery"
import { Button } from "@/components/ui/button"
import { OPEN_MY_CARDS_LABEL } from "@/lib/copy/product-copy"
import { deriveCustomerExperience } from "@/lib/customer/experience/derive"
import { assertNever } from "@/lib/customer/experience/types"
import { loadStampExperienceContext } from "@/lib/customer/experience/load-stamp"
import {
  getExistingMembershipForCurrentUser,
  resolveQrForJoin,
} from "@/lib/customer/join"
import { logger } from "@/lib/observability/logger"
import {
  normalizeRequestId,
  REQUEST_ID_HEADER,
} from "@/lib/observability/request-id"
import { parseQrShareChannel } from "@/lib/qr/nfc-card-share-url"
import {
  RateLimitError,
  customerRateLimitIdentityFromHeaders,
} from "@/lib/security/rate-limit"
import { PRIVATE_ROUTE_METADATA } from "@/lib/seo/metadata"
import { buildCustomerJoinHref } from "@/lib/navigation/customer-join-intent"

import { CustomerLoadFailed } from "@/app/m/[merchantSlug]/join/join-load-failed"

import { decideQrEntry, qrEntryFailureReason } from "./qr-entry"

export const metadata: Metadata = {
  ...PRIVATE_ROUTE_METADATA,
  title: "Venue QR",
}
export const dynamic = "force-dynamic"

type PublicQrPageProps = {
  params: Promise<{
    qrId: string
  }>
  searchParams: Promise<{ ref?: string; src?: string }>
}

export default async function PublicQrPage({
  params,
  searchParams,
}: PublicQrPageProps) {
  const { qrId } = await params
  const { ref, src } = await searchParams
  const scanSource = parseQrShareChannel(src)

  // Dev-only boundary probe: lets the DB-free e2e tier render this segment's
  // error boundary (tests/e2e/ux-polish-boundaries.spec.ts) without a
  // database. The NODE_ENV gate keeps it out of production builds, mirroring
  // the app/dev/layout.tsx guard.
  if (process.env.NODE_ENV !== "production" && qrId === "dev-boundary-probe") {
    throw new Error("Customer entry boundary probe")
  }

  const requestHeaders = await headers()
  // Failures never fall through to the error boundary (CUS-P1-01), and none
  // is swallowed: each is logged with the request id, and a resolve that
  // could not load is told apart from a QR that is unavailable, while a
  // failed membership lookup carries on to the join flow (QA BUG-041/042).
  const entry = await decideQrEntry({
    resolve: () =>
      resolveQrForJoin(qrId, {
        scanRateLimitIdentity:
          customerRateLimitIdentityFromHeaders(requestHeaders),
        scanSource,
      }),
    lookupMembership: getExistingMembershipForCurrentUser,
    // A rate-limited scan is a transient retry, not a dead QR — give it
    // distinct calm copy so the customer waits and re-scans.
    isRateLimited: (error) => error instanceof RateLimitError,
    report: (stage, error) => {
      logger.error("customer_qr_entry_failed", {
        requestId:
          normalizeRequestId(requestHeaders.get(REQUEST_ID_HEADER)) ??
          "unavailable",
        stage,
        reason: qrEntryFailureReason(error),
      })
    },
  })

  switch (entry.kind) {
    case "rate_limited":
      return <RateLimitedQr />
    case "load_failed":
      return (
        <CustomerLoadFailed
          retryHref={`/q/${encodeURIComponent(qrId)}`}
          screenLabel="QR could not load"
        />
      )
    case "unavailable":
      return <UnavailableQr />
    case "paused":
      return <UnavailableQr paused />
    case "member":
    case "join":
      break
    default:
      return assertNever(entry)
  }

  const { qrContext } = entry
  const membership = entry.kind === "member" ? entry.membership : null

  const encodedQrId = encodeURIComponent(qrContext.qrId ?? qrId)
  const joinUrl = buildCustomerJoinHref(qrContext.merchant.business_slug, {
    qrId: qrContext.qrId ?? qrId,
    referralCode: ref,
    step: "welcome",
  })

  if (membership) {
    // A returning member gets the stamp screen from this render — the one
    // server round trip the scan already paid for — instead of a 302 to
    // `/card/[membershipId]/stamp` and a second cold dynamic render on venue
    // wifi. The canonical address is applied client-side without navigating,
    // so bookmarks, the login `next` target and `router.refresh()` all still
    // point at the stamp route (and a refresh never re-charges the scan
    // rate limit through this resolver).
    const stampContext = await loadStampExperienceContext(
      membership.id,
      qrContext.qrId ?? qrId
    )
    const experience = deriveCustomerExperience({
      entry: "stamp",
      context: stampContext,
    })

    if (experience.kind === "reward_ready") {
      redirect(`/reward/${experience.reward.rewardId}`)
    }

    return (
      <>
        <CanonicalUrl href={`/card/${membership.id}/stamp?qr=${encodedQrId}`} />
        <CustomerCardExperience
          experience={experience}
          offerPasses={[]}
          offerClaimNotice={null}
        />
      </>
    )
  }

  redirect(joinUrl)
}

/** Q2: the QR is not recognised or its card is not live (guest journey Q2). */
const QR_NOT_WORKING_TITLE = "This QR isn't working"
const QR_NOT_WORKING_DESCRIPTION =
  "Ask a member of staff for the current loyalty QR."

/**
 * The error receipts run a single headline (the EmptyState's, inside the
 * receipt) instead of stacking a second level-1 shell headline with
 * near-duplicate copy above it (CUS-P2-02), and hide the mono footer so no
 * placeholder card number reads as fact (CUS-P2-01).
 */
function UnavailableQr({ paused = false }: { readonly paused?: boolean }) {
  return (
    <CustomerFlowShell
      eyebrow="Venue QR"
      className="content-center"
      screenLabel={paused ? "Paused QR" : "Unavailable QR"}
    >
      <CustomerReceipt venueName="Nabaperks" eyebrow="Venue QR" hideFooter>
        <EmptyState
          icon={AlertDiamondIcon}
          title={paused ? "Customer scans are paused" : QR_NOT_WORKING_TITLE}
          description={
            paused
              ? "This venue has paused its loyalty QR. You can still open your cards, but you can't collect a stamp from this QR while it is paused."
              : QR_NOT_WORKING_DESCRIPTION
          }
          headingLevel={1}
          className="w-full"
          // Q2: the guest's cards lead; scanning again is the quiet second.
          actions={
            <UnavailableRecoveryActions
              primary="cards"
              scanLabel="Scan a venue QR"
            />
          }
        />
      </CustomerReceipt>
    </CustomerFlowShell>
  )
}

function RateLimitedQr() {
  return (
    <CustomerFlowShell
      eyebrow="Venue QR"
      className="content-center"
      screenLabel="QR busy"
    >
      <CustomerReceipt venueName="Nabaperks" eyebrow="Venue QR" hideFooter>
        <EmptyState
          icon={AlertDiamondIcon}
          title="Too many scans just now"
          description="Wait a moment, then scan the QR again. Your stamps are safe."
          headingLevel={1}
          className="w-full"
          actions={
            <Button asChild size="lg" className="w-full">
              <Link href="/home">{OPEN_MY_CARDS_LABEL}</Link>
            </Button>
          }
        />
      </CustomerReceipt>
    </CustomerFlowShell>
  )
}
