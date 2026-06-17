"use client"

import { useState, useTransition } from "react"

import {
  initialSelfStampState,
  selfStampAction,
  type SelfStampActionState,
} from "@/app/card/[membershipId]/actions"
import { CustomerStampCard } from "@/components/customer/customer-flow-system"
import { StampPressButton } from "@/components/customer/stamp-press-button"
import { RewardCelebration, StatusBanner } from "@/components/loyalty"
import { StampCelebration, WetInkShake } from "@/components/motion"

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

/** Optional, never-blocking location check — resolves null on denial/absence. */
function resolveCoords(
  requireGeofence: boolean
): Promise<{ latitude: number; longitude: number } | null> {
  return new Promise((resolve) => {
    if (
      !requireGeofence ||
      typeof navigator === "undefined" ||
      !navigator.geolocation
    ) {
      resolve(null)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      () => resolve(null),
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 5_000 }
    )
  })
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

  const showStamp = armed || committed
  const displayCurrent = issued
    ? issued.newStampCount
    : showStamp
      ? current + 1
      : current
  const cardComplete = total > 0 && displayCurrent >= total
  const slamIndex = showStamp ? displayCurrent - 1 : -1
  const geoFlagged = issued?.geoFlagged ?? false

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

  function commit() {
    if (armed || committed || !canStamp) return
    // Land the stamp immediately — location is optional and never blocks it.
    setArmed(true)
    setShake(true)
    void (async () => {
      const coords = await resolveCoords(location.requireGeofence)
      const formData = new FormData()
      formData.set("membershipId", membershipId)
      formData.set("qrId", qrId)
      if (coords) {
        formData.set("latitude", String(coords.latitude))
        formData.set("longitude", String(coords.longitude))
      }
      startTransition(async () => {
        const next = await selfStampAction(initialSelfStampState, formData)
        setResult(next)
        // Roll the optimistic stamp back if the server declined it.
        if (next.status === "error") setArmed(false)
      })
    })()
  }

  // In-flight = the optimistic stamp is shown but the RPC hasn't confirmed yet.
  const inFlight = armed && !committed && !errorMessage
  const secured = committed || armed || !canStamp
  const hint = committed
    ? "Stamp secured. Your next scan window opens on the next UK business day."
    : inFlight
      ? "Adding your stamp — keep this screen open a moment."
      : canStamp
        ? "Press and hold the stamp, or tap it, to add today's mark."
        : "You're stamped for today. Come back tomorrow."

  return (
    <WetInkShake active={shake} onComplete={() => setShake(false)}>
      <CustomerStampCard
        venueName={venueName}
        cardName={cardName}
        current={displayCurrent}
        total={total}
        slamIndex={slamIndex}
        stampDates={dates}
        reward={{
          state: "sealed",
          name: rewardName,
          description: "Mystery reward stays sealed until the final stamp.",
        }}
        hideFooter
        hideHeaderText
        afterGrid={
          committed ? (
            cardComplete ? (
              <RewardCelebration
                title="That's the full card."
                message="Your reward is ready — claim it at the counter while you're here."
              />
            ) : (
              <StampCelebration>
                <StatusBanner
                  title="Stamp added."
                  tone="success"
                  className="text-center"
                >
                  That&apos;s one. Your progress is saved.
                  {geoFlagged
                    ? " Location could not be confirmed, so the venue may review it."
                    : null}
                </StatusBanner>
              </StampCelebration>
            )
          ) : null
        }
      >
        <div className="grid justify-items-center gap-3 pt-2">
          <StampPressButton
            onStamp={commit}
            venueName={venueName}
            secured={secured}
          />
          <p className="max-w-[18rem] text-center text-sm font-medium text-ink-soft">
            {hint}
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
          {location.requireGeofence && !secured ? (
            <p className="rounded-xl bg-secondary px-3 py-2 text-center text-xs leading-5 text-muted-foreground">
              This venue checks location within {location.geofenceRadiusMeters}m
              when available. Stamping still continues if your browser cannot
              share it.
            </p>
          ) : null}
        </div>
      </CustomerStampCard>
    </WetInkShake>
  )
}
