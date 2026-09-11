"use client"

import { useEffect, useReducer, useRef, useState } from "react"
import { useRouter } from "next/navigation"

import {
  selfStampAction,
  venueCodeStampAction,
} from "@/app/card/[membershipId]/actions"
import { CustomerStampCard } from "@/components/customer/customer-flow-system"
import {
  addLocationCapture,
  resolveStampLocation,
  shouldAttemptStampLocation,
  type StampLocationCapture,
} from "@/components/customer/self-service-forms"
import { LocationRetryButton } from "@/components/customer/location-retry-button"
import { StampPressButton } from "@/components/customer/stamp-press-button"
import { VenueCodeForm } from "@/components/customer/venue-code-form"
import {
  initialStampChoreographyState,
  readbackBonusStampsApplied,
  reduceStampChoreography,
  stampChoreographyView,
  type StampChoreographyView,
} from "@/lib/customer/experience/stamp-choreography"
import {
  initialSelfStampState,
  type SelfStampActionState,
} from "@/lib/customer/self-stamp-action-state"
import { SEALED_REWARD_NOTE } from "@/lib/copy/product-copy"
import { wetInkTransition } from "@/lib/motion/tokens"
import { useReducedMotionHook } from "@/lib/motion/use-reduced-motion"
import { cn } from "@/lib/utils"

type StampSubmitter = (
  state: SelfStampActionState,
  formData: FormData
) => Promise<SelfStampActionState>

export type StampCollectorProps = {
  membershipId: string
  qrId: string
  canStamp: boolean
  venueName: string
  cardName: string
  current: number
  total: number
  stampDates: string[]
  todayLabel: string
  rewardName: string
  rewardUnlocked?: boolean
  location: {
    requireGeofence: boolean
    geofenceRadiusMeters: number
    firstVerifiedVisit?: number
    nextVisitNumber?: number
  }
  submitStamp?: StampSubmitter
  /** The venue-code fallback submitter; injectable for the DB-free harness. */
  submitVenueCode?: StampSubmitter
  refreshCard?: () => void
}

function markStampPhase(phase: string) {
  if (typeof performance === "undefined") return
  performance.mark(`nabaperks:stamp:${phase}`)
}

function StampStatusBand({
  view,
  phase,
}: {
  view: StampChoreographyView
  phase: string
}) {
  return (
    <section
      data-stamp-status-band
      data-phase={phase}
      className={cn(
        // A reserved band so feedback replaces in place without the card
        // jumping between phases — reserved with min-height, not a hard
        // height: the copy must never scroll inside a 112px box when a large
        // type setting or a long refusal needs more room.
        "grid min-h-28 grid-rows-[auto_1fr] content-start gap-1 rounded-lg border-2 px-4 py-3 text-center short:min-h-24 squat:content-center squat:text-left",
        view.confirmed
          ? "border-reward bg-reward/10"
          : phase === "blocked"
            ? "border-destructive bg-destructive/10"
            : phase === "checking" || phase === "unknown"
              ? "border-stamp bg-stamp/8"
              : "border-line bg-secondary/45"
      )}
    >
      <p className="font-extrabold text-balance">{view.statusTitle}</p>
      <p className="text-sm leading-5 font-medium text-ink-soft">
        {view.statusBody}
      </p>
    </section>
  )
}

export function StampCollector({
  membershipId,
  qrId,
  canStamp,
  venueName,
  cardName,
  current,
  total,
  stampDates,
  todayLabel,
  rewardName,
  rewardUnlocked: authoritativeRewardUnlocked = false,
  location,
  submitStamp = selfStampAction,
  submitVenueCode = venueCodeStampAction,
  refreshCard,
}: StampCollectorProps) {
  const router = useRouter()
  const reduceMotion = useReducedMotionHook()
  const [state, dispatch] = useReducer(
    reduceStampChoreography,
    initialStampChoreographyState
  )
  const initialCurrentRef = useRef(current)
  const [locationNotice] = useState(
    () =>
      canStamp &&
      shouldAttemptStampLocation(
        location.requireGeofence,
        location.nextVisitNumber ?? current + 1,
        location.firstVerifiedVisit
      )
  )
  const requestInFlightRef = useRef(false)
  const refresh = refreshCard ?? router.refresh
  const view = stampChoreographyView(state, {
    canStamp,
    current,
    total,
    stampDates,
    todayLabel,
    rewardUnlocked: authoritativeRewardUnlocked,
  })

  useEffect(() => {
    if (!locationNotice) return
    // Warm the permission prompt and GPS chip. The stamp request captures a
    // fresh fix when the customer actually collects, so this result is unused.
    void resolveStampLocation(true)
  }, [locationNotice, membershipId, qrId])

  useEffect(() => {
    if (state.phase !== "unknown") return
    if (current <= initialCurrentRef.current) {
      requestInFlightRef.current = false
      if (!canStamp) {
        dispatch({ type: "readback_closed" })
        return
      }
      // Readback confirmed nothing was added and today is still open — unlock
      // a retry instead of leaving the card secured forever.
      dispatch({
        type: "request_blocked",
        message:
          "We couldn't confirm the stamp. Check your card, then try again.",
      })
      return
    }

    requestInFlightRef.current = false
    dispatch({
      type: "readback_issued",
      result: {
        status: "issued",
        newStampCount: current,
        rewardUnlocked: total > 0 && current >= total,
        geoFlagged: false,
        bonusStampsApplied: readbackBonusStampsApplied(
          initialCurrentRef.current,
          current
        ),
      },
    })
  }, [canStamp, current, state.phase, total])

  useEffect(() => {
    if (state.phase !== "printing") return
    const delayMs = reduceMotion ? 0 : wetInkTransition.slam.duration * 1000
    const timeoutId = window.setTimeout(() => {
      dispatch({ type: "print_settled" })
      markStampPhase("settled")
    }, delayMs)

    return () => window.clearTimeout(timeoutId)
  }, [reduceMotion, state.phase])

  /** One settlement path for both the GPS stamp and the venue-code stamp. */
  function settle(next: SelfStampActionState) {
    if (next.status === "error") {
      requestInFlightRef.current = false
      dispatch({
        type: "request_blocked",
        message: next.message,
        reason: next.reason,
        attemptsRemaining: next.attemptsRemaining,
        lockedUntil: next.lockedUntil,
      })
      markStampPhase("blocked")
      return
    }
    if (next.status !== "issued") {
      dispatch({ type: "request_unknown" })
      markStampPhase("unknown")
      refresh()
      return
    }

    dispatch({ type: "request_issued", result: next })
    markStampPhase("issued")
    if (next.rewardUnlocked) refresh()
  }

  function lostResult() {
    dispatch({ type: "request_unknown" })
    markStampPhase("unknown")
    refresh()
  }

  async function issueStamp(prefetched: StampLocationCapture | null = null) {
    if (requestInFlightRef.current || view.secured || !canStamp) return
    requestInFlightRef.current = true
    dispatch({ type: "request_started", current })
    markStampPhase("checking")

    try {
      const locationCapture =
        prefetched ??
        (locationNotice ? await resolveStampLocation(true) : null)
      const formData = new FormData()
      formData.set("membershipId", membershipId)
      formData.set("qrId", qrId)
      addLocationCapture(formData, locationCapture)
      markStampPhase("request")

      settle(await submitStamp(initialSelfStampState, formData))
    } catch {
      lostResult()
    }
  }

  async function issueWithCode(code: string) {
    if (requestInFlightRef.current || view.secured || !canStamp) return
    requestInFlightRef.current = true
    dispatch({ type: "request_started", current })
    markStampPhase("checking")

    try {
      const formData = new FormData()
      formData.set("membershipId", membershipId)
      formData.set("qrId", qrId)
      formData.set("code", code)
      markStampPhase("request")

      settle(await submitVenueCode(initialSelfStampState, formData))
    } catch {
      lostResult()
    }
  }

  const rewardUnlocked = view.rewardUnlocked
  const showVenueCode =
    canStamp && (view.venueCodeOffer || view.venueCodeLockedUntil !== null)

  return (
    <div aria-busy={view.ariaBusy || undefined} data-stamp-phase={state.phase}>
      <CustomerStampCard
        venueName={venueName}
        cardName={cardName}
        current={view.displayCurrent}
        total={total}
        slamIndex={view.slamIndex}
        pendingIndex={view.pendingIndex}
        stampDates={view.dates}
        reward={{
          state: rewardUnlocked ? "waiting" : "sealed",
          name: rewardName,
          description: rewardUnlocked
            ? "Open your reward to see what landed."
            : SEALED_REWARD_NOTE,
          sealSlammed: view.rewardSlammed,
        }}
        rewardSlot={rewardUnlocked ? "revealed" : "locked"}
        hideFooter
        hideHeaderText
        // The stamp control sits directly under its feedback band, *above*
        // the reward ticket: grid → status → (code fallback) → press → ticket.
        // With the ticket in between, the button fell below the fold on a
        // 390×844 phone — the one thing the screen exists for was off-screen
        // after a scan. The sealed ticket is context, not the action.
        // Landscape floor (≤480px tall): the band and the press sit side by
        // side — feedback left, control right — so both stay in the first
        // screen; the code fallback and the location note span the rows
        // beneath. Every cell is placed explicitly: with auto-placement the
        // two-column fallback could not follow the band on row 1, so it fell
        // to row 2 and pushed the press to row 3 — exactly when the keyboard
        // makes height scarcest.
        afterGrid={
          <div className="grid gap-3 short:gap-2 squat:grid-cols-[minmax(0,1fr)_auto] squat:items-center">
            <div className="squat:col-start-1 squat:row-start-1">
              <StampStatusBand view={view} phase={state.phase} />
            </div>
            {showVenueCode ? (
              <div className="grid gap-3 squat:col-span-2 squat:row-start-2">
                {locationNotice && view.locationRetryOffer ? (
                  <LocationRetryButton
                    disabled={view.pending}
                    onGranted={(capture) => {
                      void issueStamp(capture)
                    }}
                  />
                ) : null}
                <VenueCodeForm
                  attemptsRemaining={view.venueCodeAttemptsRemaining}
                  lockedUntil={view.venueCodeLockedUntil}
                  pending={view.pending}
                  onSubmit={(code) => {
                    void issueWithCode(code)
                  }}
                />
              </div>
            ) : null}
            <div className="grid justify-items-center gap-3 pt-1 short:gap-2 short:pt-0 squat:col-start-2 squat:row-start-1">
              <StampPressButton
                onStamp={() => {
                  void issueStamp()
                }}
                venueName={venueName}
                secured={view.secured}
                confirmed={view.confirmed}
                pending={view.pending}
                label={view.buttonLabel}
              />
              <p
                className="sr-only"
                role="status"
                aria-live="polite"
                aria-atomic="true"
              >
                {view.announcement}
              </p>
            </div>
            {locationNotice ? (
              <p className="rounded-lg bg-secondary px-3 py-2 text-center text-xs leading-5 text-muted-foreground squat:col-span-2 squat:row-start-3">
                This venue may try a soft location check within{" "}
                {location.geofenceRadiusMeters}m. Your stamp still saves if your
                phone cannot share location.
              </p>
            ) : null}
          </div>
        }
      />
    </div>
  )
}
