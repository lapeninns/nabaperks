"use client"

import { useState, useTransition } from "react"

import { selfStampAction } from "@/app/card/[membershipId]/actions"
import { CustomerStampCard } from "@/components/customer/customer-flow-system"
import { StampPressButton } from "@/components/customer/stamp-press-button"
import { RewardCelebration, StatusBanner } from "@/components/loyalty"
import { StampCelebration, WetInkShake } from "@/components/motion"
import {
  addLocationCapture,
  resolveStampLocation,
} from "@/components/customer/self-service-forms"
import {
  initialSelfStampState,
  type SelfStampActionState,
} from "@/lib/customer/self-stamp-action-state"

export type StampCollectorProps = {
  membershipId: string
  qrId: string
  /** True while today's stamp is still available — false once it has landed. */
  canStamp: boolean
  venueName: string
  cardName: string
  /** Stamps already on the card, before today's. */
  current: number
  total: number
  stampDates: string[]
  /** Pre-formatted UK date for the stamp landing now (server computes it). */
  todayLabel: string
  rewardName: string
  location: { requireGeofence: boolean; geofenceRadiusMeters: number }
}

/** The instruction line under the disc for each state. */
function stampHint(
  committed: boolean,
  inFlight: boolean,
  canStamp: boolean,
  cardComplete: boolean
) {
  if (committed) {
    // A full card has no next scan window until the reward is collected and a
    // new cycle starts, so don't promise one.
    return cardComplete
      ? "That's every stamp on this card."
      : "Stamp secured. Your next scan window opens on the next UK business day."
  }
  if (inFlight) return "Adding your stamp, keep this screen open a moment."
  if (canStamp)
    return "Press and hold the stamp, or tap it, to add today's mark."
  return "You're stamped for today. Come back tomorrow."
}

/** Pure view derivation: turn the action state + props into display values. */
function stampView(args: {
  issued: { newStampCount: number; geoFlagged: boolean } | null
  armed: boolean
  canStamp: boolean
  current: number
  total: number
  stampDates: string[]
  todayLabel: string
}) {
  const { issued, armed, canStamp, current, total, stampDates, todayLabel } =
    args
  const committed = issued !== null
  const showStamp = armed || committed
  const displayCurrent = issued
    ? issued.newStampCount
    : showStamp
      ? current + 1
      : current
  const dates =
    showStamp && displayCurrent > stampDates.length
      ? [
          ...stampDates,
          ...Array.from(
            { length: displayCurrent - stampDates.length },
            () => todayLabel
          ),
        ]
      : stampDates.slice(0, displayCurrent)
  // In-flight = optimistic stamp shown, RPC not confirmed yet (armed is cleared
  // on error, so this is false once a stamp is declined).
  const inFlight = armed && !committed
  const cardComplete = total > 0 && displayCurrent >= total

  return {
    hint: stampHint(committed, inFlight, canStamp, cardComplete),
    displayCurrent,
    slamIndex: showStamp ? displayCurrent - 1 : -1,
    dates,
    cardComplete,
    geoFlagged: issued?.geoFlagged ?? false,
    secured: committed || armed || !canStamp,
  }
}

/** The celebration shown below the grid once a stamp is confirmed. */
function StampAftermath({
  committed,
  cardComplete,
}: {
  committed: boolean
  cardComplete: boolean
}) {
  if (!committed) return null
  if (cardComplete) {
    // Stay reward-state-agnostic here: the reward may not be redeemable until the
    // next UK business day, so don't promise an at-the-counter claim. The
    // "See your reward" tap-through carries the timing detail.
    return (
      <RewardCelebration
        title="That's the full card."
        message="Your mystery reward is unlocked."
      />
    )
  }
  return (
    <StampCelebration>
      <StatusBanner title="Stamp added." tone="success" className="text-center">
        That&apos;s one. Your progress is saved.
      </StatusBanner>
    </StampCelebration>
  )
}

/**
 * The interactive, in-place stamp surface. The customer presses (or holds) the
 * stamp disc; the stamp lands on the visible grid *optimistically* — the slam
 * fires as a direct response to the gesture — while the RPC confirms in the
 * background. On success the disc seals and a celebration shows; on a declined
 * stamp the optimistic mark rolls back with calm copy. No page navigation.
 */
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
  location,
}: StampCollectorProps) {
  const [result, setResult] = useState<SelfStampActionState>(
    initialSelfStampState
  )
  const [, startTransition] = useTransition()
  const [armed, setArmed] = useState(false)
  const [shake, setShake] = useState(false)

  const issued = result.status === "issued" ? result : null
  const errorMessage = result.status === "error" ? result.message : null
  const committed = issued !== null
  const view = stampView({
    issued,
    armed,
    canStamp,
    current,
    total,
    stampDates,
    todayLabel,
  })

  function commit() {
    if (armed || committed || !canStamp) return
    // Land the stamp immediately — location is optional and never blocks it.
    setArmed(true)
    setShake(true)
    void (async () => {
      const nextCycleStampNumber = current + 1
      const shouldAttemptLocation =
        location.requireGeofence && nextCycleStampNumber === 3
      const locationCapture = await resolveStampLocation(shouldAttemptLocation)
      const formData = new FormData()
      formData.set("membershipId", membershipId)
      formData.set("qrId", qrId)
      addLocationCapture(formData, locationCapture)
      startTransition(async () => {
        const next = await selfStampAction(initialSelfStampState, formData)
        setResult(next)
        // Roll the optimistic stamp back if the server declined it.
        if (next.status === "error") setArmed(false)
      })
    })()
  }

  return (
    <WetInkShake active={shake} onComplete={() => setShake(false)}>
      <CustomerStampCard
        venueName={venueName}
        cardName={cardName}
        current={view.displayCurrent}
        total={total}
        slamIndex={view.slamIndex}
        stampDates={view.dates}
        reward={{
          state: "sealed",
          name: rewardName,
          description: "Mystery reward stays sealed until the final stamp.",
        }}
        hideFooter
        hideHeaderText
        afterGrid={
          <StampAftermath
            committed={committed}
            cardComplete={view.cardComplete}
          />
        }
      >
        <div className="grid justify-items-center gap-3 pt-2">
          <StampPressButton
            onStamp={commit}
            venueName={venueName}
            secured={view.secured}
          />
          <p className="max-w-[18rem] text-center text-sm font-medium text-ink-soft">
            {view.hint}
          </p>
          {errorMessage ? (
            <StatusBanner
              tone="warning"
              title="Stamp not added"
              className="text-left"
            >
              <span className="grid gap-2">
                <span>{errorMessage}</span>
                <span>
                  If this keeps failing, ask the venue team to check
                  today&apos;s stamp from their console.
                </span>
              </span>
            </StatusBanner>
          ) : null}
          {location.requireGeofence && current + 1 === 3 && !view.secured ? (
            <p className="rounded-xl bg-secondary px-3 py-2 text-center text-xs leading-5 text-muted-foreground">
              This venue may try a soft location check within{" "}
              {location.geofenceRadiusMeters}m. Your stamp still saves if your
              phone cannot share location.
            </p>
          ) : null}
        </div>
      </CustomerStampCard>
    </WetInkShake>
  )
}
