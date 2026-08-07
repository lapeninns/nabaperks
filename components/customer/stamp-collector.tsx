"use client"

import { useEffect, useReducer, useRef, useState } from "react"
import { useRouter } from "next/navigation"

import { selfStampAction } from "@/app/card/[membershipId]/actions"
import { CustomerStampCard } from "@/components/customer/customer-flow-system"
import {
  addLocationCapture,
  resolveStampLocation,
  shouldAttemptStampLocation,
  type StampLocationCapture,
} from "@/components/customer/self-service-forms"
import { StampPressButton } from "@/components/customer/stamp-press-button"
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
      // Reserving the band is the right call (DESIGN.md's readback rule: growth
      // must not move the grid) but `h-28` sized it against the worst-case
      // string, so the common idle case carried ~50px of slack, and
      // `overflow-y-auto` turned the longest blocked message into a hidden
      // inner scroll region on a phone. `min-h-20` with auto rows lets it grow
      // downward instead, which moves nothing above it (CUS 02#19).
      className={cn(
        "grid min-h-20 grid-rows-[auto_1fr] content-start gap-1 rounded-lg border-2 px-4 py-3 text-center",
        view.confirmed
          ? "border-reward bg-reward/10"
          : phase === "blocked"
            ? "border-destructive bg-destructive/10"
            : phase === "checking" || phase === "unknown"
              ? "border-stamp bg-stamp/8"
              : // border-ink, not border-line: an 18% hairline tone drawn at
                // 2px is the only 2px border in the system that is not ink.
                "border-ink bg-secondary/45"
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
  const locationPromiseRef =
    useRef<Promise<StampLocationCapture | null> | null>(null)
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
    if (!locationNotice) {
      locationPromiseRef.current = Promise.resolve(null)
      return
    }
    locationPromiseRef.current = resolveStampLocation(true)
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

  async function issueStamp() {
    if (requestInFlightRef.current || view.secured || !canStamp) return
    requestInFlightRef.current = true
    dispatch({ type: "request_started" })
    markStampPhase("checking")

    try {
      const locationCapture =
        (await locationPromiseRef.current) ??
        (locationNotice ? await resolveStampLocation(true) : null)
      const formData = new FormData()
      formData.set("membershipId", membershipId)
      formData.set("qrId", qrId)
      addLocationCapture(formData, locationCapture)
      markStampPhase("request")

      const next = await submitStamp(initialSelfStampState, formData)
      if (next.status === "error") {
        requestInFlightRef.current = false
        dispatch({ type: "request_blocked", message: next.message })
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
    } catch {
      dispatch({ type: "request_unknown" })
      markStampPhase("unknown")
      refresh()
    }
  }

  const rewardUnlocked = view.rewardUnlocked

  return (
    <div aria-busy={view.ariaBusy || undefined} data-stamp-phase={state.phase}>
      <CustomerStampCard
        venueName={venueName}
        cardName={cardName}
        current={view.displayCurrent}
        total={total}
        slamIndex={view.slamIndex}
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
        afterGrid={<StampStatusBand view={view} phase={state.phase} />}
        // Grid -> status band -> the disc -> the reward ticket. The disc used
        // to be the receipt's last child, under the ticket, which put the only
        // control on the screen at roughly y 900 on a 375x667 phone — a ~350px
        // scroll to reach it, one-handed, at a counter (CUS 02#18).
        primaryAction={
          <div className="grid justify-items-center gap-2 pt-2">
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
            {/* The geofence note used to be a `rounded-lg bg-secondary` block —
                a fourth surface treatment matching nothing else in the system —
                sitting in the space directly under the control where a RESULT
                should land, on every qualifying visit before the member had
                done anything. Same words, no bespoke surface (CUS 02#26). */}
            {locationNotice ? (
              <p className="max-w-[34ch] text-center text-xs leading-5 text-muted-foreground">
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
