import { notFound } from "next/navigation"

import { CounterPinnedAction } from "@/components/merchant/counter-pinned-action"
import { PresentableQrCard } from "@/components/merchant/counter-qr-card"
import { LaunchReadinessPanel } from "@/components/merchant/launch-readiness-panel"
import {
  CounterQrCardSkeleton,
  TeamCodePanelSkeleton,
} from "@/components/merchant/loading-skeletons"
import { StreamErrorCard } from "@/components/merchant/stream-error-boundary"
import { TeamCodePanelView } from "@/components/merchant/team-code-panel-view"
import { buildLaunchReadiness } from "@/lib/merchant/launch-readiness"
import { LAUNCH_MIN_ACTIVE_REWARDS } from "@/lib/merchant/launch-readiness-contract"

import { HARNESS_MERCHANT, HARNESS_NOW_ISO } from "../fixtures"
import {
  failingResetVenueCodeAction,
  noopResetVenueCodeAction,
  slowResetVenueCodeAction,
} from "./actions"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Shared DB-free inputs for the Counter's live, paused, and setup states. */
const HARNESS_ACTIVE_CARD = {
  id: "card_harness",
  card_name: "Mystery Visit Card",
  reward_name: "Mystery reward",
  stamps_required: 3,
} as const

const HARNESS_LOCATION = {
  id: "loc_harness",
  name: "Old Crown Girton",
  address: "12 High Street, Girton, Cambridge, CB3 0QH",
  latitude: 52.2399,
  longitude: 0.0826,
  geofence_radius_meters: 150,
  require_geofence: false,
  geocoded_at: "2026-06-20T10:00:00.000Z",
} as const

/** Today's code rotates at 5am London; the fixture clock sits at 13:00. */
const HARNESS_ROTATES_AT = "2026-09-22T04:00:00.000Z"

function buildCounterHarnessReadiness({
  setupIncomplete,
  qrPaused,
  qrGated,
  qrMissing,
}: {
  readonly setupIncomplete: boolean
  readonly qrPaused: boolean
  readonly qrGated: boolean
  readonly qrMissing: boolean
}) {
  return buildLaunchReadiness({
    activeCard: HARNESS_ACTIVE_CARD,
    activeRewardPoolItemCount: setupIncomplete ? 1 : LAUNCH_MIN_ACTIVE_REWARDS,
    qrCode:
      setupIncomplete || qrMissing
        ? null
        : {
            id: "qr_harness",
            qr_id: "old-crown-girton",
            destination_type: "join",
            is_active: !qrPaused,
          },
    location: HARNESS_LOCATION,
    billing: {
      requiresBilling: true,
      status: setupIncomplete || qrGated ? null : "active",
    },
  })
}

type CounterHarnessParams = {
  setup?: string
  /** ready (default) · paused · gated · missing · error · loading */
  qr?: string
  /** hidden (default) · revealed · unavailable · loading */
  code?: string
  /** fail · slow */
  reset?: string
  /** Accepted for the existing visual route; the Counter has no metrics. */
  members?: string
}

/**
 * Counter harness — mounts the REAL Counter composition (`PresentableQrCard`,
 * `TeamCodePanelView`, `CounterPinnedAction`) fed DB-free fixtures, one state
 * per query, so every row of handoff §7.2 is screenshot- and axe-provable
 * without a login. The async loaders themselves hit Supabase, so their
 * presentational halves are mounted directly.
 */
export default async function CounterHarnessPage({
  searchParams,
}: {
  searchParams?: Promise<CounterHarnessParams>
}) {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  const params = searchParams ? await searchParams : {}
  const showSetupReminder = params.setup === "incomplete"
  const qr = params.qr ?? "ready"
  const code = params.code ?? "hidden"
  const readiness = buildCounterHarnessReadiness({
    setupIncomplete: showSetupReminder,
    qrPaused: qr === "paused",
    qrGated: qr === "gated",
    qrMissing: qr === "missing",
  })
  const resetAction =
    params.reset === "fail"
      ? failingResetVenueCodeAction
      : params.reset === "slow"
        ? slowResetVenueCodeAction
        : noopResetVenueCodeAction

  return (
    <>
      <h1 className="sr-only">Counter</h1>
      {showSetupReminder ? (
        <LaunchReadinessPanel
          readiness={readiness}
          variant="compact"
          showHeader={false}
          className="mb-5"
        />
      ) : null}

      <div className="mx-auto grid w-full max-w-[35rem] gap-5 min-[600px]:max-w-none min-[600px]:grid-cols-2 min-[600px]:items-start min-[900px]:max-w-[51.25rem]">
        {qr === "loading" ? (
          <CounterQrCardSkeleton />
        ) : qr === "error" ? (
          <StreamErrorCard label="your venue QR" onRetry={noopRetry} />
        ) : (
          <PresentableQrCard
            state={
              qr === "paused"
                ? "paused"
                : qr === "gated" || showSetupReminder
                  ? "gated"
                  : qr === "missing"
                    ? "missing"
                    : "ready"
            }
            qrCodeId="qr_harness"
            venueName={HARNESS_MERCHANT.business_name}
            shareUrl="https://nabaperks.com/q/old-crown-girton"
            gatedAction={readiness.nextStep}
          />
        )}

        {code === "loading" ? (
          <TeamCodePanelSkeleton />
        ) : (
          <TeamCodePanelView
            code={code === "unavailable" ? null : "482913"}
            rotatesAt={HARNESS_ROTATES_AT}
            nowIso={HARNESS_NOW_ISO}
            initialRevealed={code === "revealed"}
            rotationAvailable={code !== "unavailable"}
            resetAction={resetAction}
          />
        )}
      </div>

      <CounterPinnedAction readiness={readiness} />
    </>
  )
}

// A no-op for the mounted fallback: the harness has nothing to refetch.
async function noopRetry() {
  "use server"
}
