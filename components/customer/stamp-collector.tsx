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
  decideCaptureSubmission,
  shouldAttemptStampLocation,
  type StampLocationCapture,
} from "@/components/customer/self-service-forms"
import { StampPressButton } from "@/components/customer/stamp-press-button"
import { VenueCodeForm } from "@/components/customer/venue-code-form"
import { VerifyVisitControls } from "@/components/customer/verify-visit-controls"
import {
  initialStampChoreographyState,
  locationRetryOffered,
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
    unverifiedGraceRemaining?: number
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
  // Whether this visit must confirm location. Decided from the server's
  // lifetime visit number; `current + 1` is only the DB-free harness fallback.
  const verificationRequired =
    canStamp &&
    shouldAttemptStampLocation(
      location.requireGeofence,
      location.nextVisitNumber ?? current + 1,
      location.firstVerifiedVisit
    )
  const [codeOpen, setCodeOpen] = useState(false)
  const [acquiringLocation, setAcquiringLocation] = useState(false)
  const requestInFlightRef = useRef(false)
  // The server answered `location_required` to a capture without a fix during
  // this visit: the grace is spent whatever the page payload said.
  const [refusedWithoutFix, setRefusedWithoutFix] = useState(false)
  const recoveryCaptureRef = useRef<StampLocationCapture | null>(null)
  const refresh = refreshCard ?? router.refresh
  const view = stampChoreographyView(state, {
    canStamp,
    current,
    total,
    stampDates,
    todayLabel,
    rewardUnlocked: authoritativeRewardUnlocked,
    verificationRequired,
    acquiringLocation,
    unverifiedGraceRemaining: location.unverifiedGraceRemaining,
  })

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
      if (next.reason === "location_required") {
        setRefusedWithoutFix(true)
      }
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

  /**
   * Send the stamp request. The capture, when there is one, was taken by
   * "Use my location" on the customer's tap — this never asks the browser
   * itself, so a stamp press before the verified-visit threshold carries no
   * location and a verified visit carries exactly the reading the customer
   * just gave.
   */
  async function issueStamp(capture: StampLocationCapture | null) {
    if (requestInFlightRef.current || view.secured || !canStamp) return
    requestInFlightRef.current = true
    dispatch({ type: "request_started", current })
    markStampPhase("checking")

    try {
      const formData = new FormData()
      formData.set("membershipId", membershipId)
      formData.set("qrId", qrId)
      addLocationCapture(formData, capture)
      markStampPhase("request")

      settle(await submitStamp(initialSelfStampState, formData))
    } catch {
      lostResult()
    }
  }

  /**
   * The browser has answered. Only an accurate fix is sent automatically.
   * Recovery and GPS retries spend no stamp requests. Grace is a separate
   * customer choice and still goes through the authoritative server checks.
   */
  function handleCapture(
    capture: StampLocationCapture,
    useUnverifiedGrace = false
  ) {
    if (requestInFlightRef.current || view.secured || !canStamp) return
    recoveryCaptureRef.current = capture
    const decision = decideCaptureSubmission(capture, {
      useUnverifiedGrace,
      unverifiedGraceRemaining: location.unverifiedGraceRemaining,
      refusedWithoutFix,
    })
    if (decision.action === "submit") {
      void issueStamp(capture)
      return
    }
    if (decision.action === "refuse") {
      dispatch({
        type: "capture_refused",
        message: decision.message,
        issue: decision.issue,
      })
      markStampPhase("blocked")
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
  const showLocationControls = canStamp && view.locationControls
  // On a visit that must confirm location the ordinary press never renders
  // while the customer can still act: it would submit with no capture, and
  // with grace left that commits a courtesy stamp without any location
  // attempt. During a code lockout, which withholds both controls, only the
  // lockout notice is on screen. The press returns for the in-flight and
  // settled phases so the inking and confirmed states keep their control.
  const showStampPress =
    !showLocationControls &&
    !(verificationRequired && !view.secured && !view.pending)
  // The code form is on screen once the customer asked for it, after any
  // refusal it can answer, or (as a notice) while a lockout runs.
  const showVenueCodeForm =
    canStamp &&
    (view.venueCodeLockedUntil !== null ||
      (view.venueCodeOffer && (codeOpen || state.phase === "blocked")))

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
        // the reward ticket: grid → status → (verify pair / code) → press →
        // ticket. With the ticket in between, the button fell below the fold
        // on a 390×844 phone — the one thing the screen exists for was
        // off-screen after a scan. The sealed ticket is context, not the
        // action. On a visit that must confirm location the press gives way
        // to the location / venue-code pair until the request is in flight.
        // Landscape floor (≤480px tall): the band and the press sit side by
        // side — feedback left, control right — so both stay in the first
        // screen; the pair and the code form span the rows beneath. Every
        // cell is placed explicitly: with auto-placement the two-column
        // fallback could not follow the band on row 1, so it fell to row 2
        // and pushed the press to row 3 — exactly when the keyboard makes
        // height scarcest.
        afterGrid={
          <div className="grid gap-3 short:gap-2 squat:grid-cols-[minmax(0,1fr)_auto] squat:items-center">
            <div className="squat:col-start-1 squat:row-start-1">
              <StampStatusBand view={view} phase={state.phase} />
            </div>
            {showLocationControls || showVenueCodeForm ? (
              <div className="grid gap-3 squat:col-span-2 squat:row-start-2">
                {showLocationControls ? (
                  <VerifyVisitControls
                    disabled={view.pending || view.secured}
                    codeOpen={showVenueCodeForm}
                    recoveryIssue={
                      state.phase === "blocked"
                        ? state.locationIssue
                        : undefined
                    }
                    retry={
                      state.phase === "blocked" &&
                      locationRetryOffered(state.reason)
                    }
                    graceRemaining={
                      state.phase === "blocked" &&
                      state.locationIssue &&
                      !refusedWithoutFix
                        ? location.unverifiedGraceRemaining
                        : undefined
                    }
                    onUseGrace={() => {
                      if (recoveryCaptureRef.current)
                        handleCapture(recoveryCaptureRef.current, true)
                    }}
                    onCapture={handleCapture}
                    onOpenCode={() => setCodeOpen(true)}
                    onAcquiringChange={(acquiring) => {
                      if (acquiring) recoveryCaptureRef.current = null
                      setAcquiringLocation(acquiring)
                    }}
                  />
                ) : null}
                {showVenueCodeForm ? (
                  <VenueCodeForm
                    attemptsRemaining={view.venueCodeAttemptsRemaining}
                    lockedUntil={view.venueCodeLockedUntil}
                    pending={view.pending}
                    onSubmit={(code) => {
                      void issueWithCode(code)
                    }}
                  />
                ) : null}
              </div>
            ) : null}
            <div className="grid justify-items-center gap-3 pt-1 short:gap-2 short:pt-0 squat:col-start-2 squat:row-start-1">
              {showStampPress ? (
                <StampPressButton
                  onStamp={() => {
                    void issueStamp(null)
                  }}
                  venueName={venueName}
                  secured={view.secured}
                  confirmed={view.confirmed}
                  pending={view.pending}
                  label={view.buttonLabel}
                />
              ) : null}
              <p
                className="sr-only"
                role="status"
                aria-live="polite"
                aria-atomic="true"
              >
                {view.announcement}
              </p>
            </div>
          </div>
        }
      />
    </div>
  )
}
