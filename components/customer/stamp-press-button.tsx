"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"
import type { PointerEvent as ReactPointerEvent } from "react"

import { CheckmarkBadge04Icon } from "@hugeicons/core-free-icons"

import { Icon } from "@/components/brand/icon"
import { deriveVenueInitials } from "@/components/brand/venue-mark"
import { useReducedMotionHook } from "@/lib/motion/use-reduced-motion"
import { cn } from "@/lib/utils"

const RING_RADIUS = 44
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS
/** Below this, a press is treated as a tap (no ring) so a quick tap stays a tap. */
const HOLD_THRESHOLD_MS = 130

function vibrate(pattern: number | number[]) {
  if (typeof navigator === "undefined") return
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // Haptics are a progressive enhancement — ignore unsupported devices.
  }
}

function StampDiscFace({
  confirmed,
  pending,
  closed,
  initials,
}: {
  /** Server-confirmed stamp — the only state that earns the green leaf disc. */
  confirmed: boolean
  /** Optimistic stamp in flight — stays the neutral stamp colour, lightly dimmed. */
  pending: boolean
  /**
   * The control is not accepting input and has no stamp of its own to show for
   * it — already stamped today, or the window is shut. It used to render
   * pixel-identical to the live disc, so a member tapped something that looked
   * fully available and nothing happened (CUS 02#24).
   */
  closed: boolean
  initials: string
}) {
  return (
    <span
      className={cn(
        "grid size-[5.5rem] place-items-center rounded-full border-2 border-ink shadow-md transition-colors duration-[var(--w-dur-fast)] ease-[var(--w-ease)] motion-reduce:transition-none",
        confirmed
          ? "bg-reward text-reward-foreground"
          : pending
            ? "bg-stamp/10 text-stamp"
            : "bg-stamp text-stamp-foreground",
        pending && !confirmed
          ? "border-dashed border-stamp shadow-none"
          : undefined,
        // DESIGN.md's disabled treatment: 50% opacity, and the dashed ink
        // border the empty stamp slots already use for "nothing here yet".
        closed ? "border-dashed opacity-50 shadow-none" : undefined
      )}
    >
      {confirmed ? (
        <Icon icon={CheckmarkBadge04Icon} size={34} />
      ) : pending ? (
        <span className="grid justify-items-center gap-1">
          <span className="font-mono text-lg font-bold tracking-meta uppercase">
            {initials}
          </span>
          <span className="mono-id">Checking</span>
        </span>
      ) : initials ? (
        <span className="font-mono text-xl font-bold tracking-meta uppercase">
          {initials}
        </span>
      ) : (
        <Icon icon={CheckmarkBadge04Icon} size={30} />
      )}
    </span>
  )
}

/**
 * The stamp gesture: a rubber-stamp disc that commits on a plain tap (mouse,
 * touch, or keyboard) AND on a press-and-hold whose ring charges to full. A
 * quick tap cancels the hold and commits via click; a completed hold commits
 * and swallows the trailing click. Haptics fire on hold-start and on commit.
 * The parent disables the button once a stamp is in flight, so a double-commit
 * cannot slip through the async gap.
 */
export function StampPressButton({
  onStamp,
  venueName,
  disabled = false,
  secured = false,
  confirmed = false,
  pending = false,
  holdMs = 600,
  label = "Add today's stamp",
}: {
  onStamp: () => void
  venueName?: string
  disabled?: boolean
  /**
   * Input is locked — the stamp has landed (optimistically or for real) or the
   * window is closed. Drives the accessible name, the breathe pause and the
   * disabled-input gate, but NOT the disc colour (see `confirmed`).
   */
  secured?: boolean
  /**
   * The server confirmed the stamp ("issued") — the only signal that flips the
   * disc to the success-green leaf. Kept distinct from `secured` so an optimistic
   * press never shows a success colour the server might un-happen (friction F10).
   */
  confirmed?: boolean
  /** Optimistic stamp in flight — neutral pending treatment, not green. */
  pending?: boolean
  holdMs?: number
  label?: string
}) {
  const reduce = useReducedMotionHook()
  const hintId = useId()
  const ringRef = useRef<SVGCircleElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const holdTimeoutRef = useRef<number | null>(null)
  const startRef = useRef(0)
  const holdingRef = useRef(false)
  const completedRef = useRef(false)
  const ringShownRef = useRef(false)
  const activePointerIdRef = useRef<number | null>(null)
  const previousConfirmedRef = useRef(confirmed)
  const [pressing, setPressing] = useState(false)
  const [ringVisible, setRingVisible] = useState(false)

  const inactive = disabled || secured

  const setRingOffset = useCallback((p: number) => {
    const el = ringRef.current
    if (el) el.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - p))
  }, [])

  const stopRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  const stopHoldTimeout = useCallback(() => {
    if (holdTimeoutRef.current !== null) {
      window.clearTimeout(holdTimeoutRef.current)
      holdTimeoutRef.current = null
    }
  }, [])

  const resetRing = useCallback(() => {
    stopRaf()
    stopHoldTimeout()
    holdingRef.current = false
    ringShownRef.current = false
    setRingVisible(false)
    setRingOffset(0)
  }, [setRingOffset, stopHoldTimeout, stopRaf])

  const commit = useCallback(() => {
    if (inactive) return
    vibrate(8)
    onStamp()
  }, [inactive, onStamp])

  useEffect(
    () => () => {
      stopRaf()
      stopHoldTimeout()
    },
    [stopHoldTimeout, stopRaf]
  )
  useEffect(() => {
    if (!inactive) completedRef.current = false
  }, [inactive])
  useEffect(() => {
    if (!previousConfirmedRef.current && confirmed) vibrate(24)
    previousConfirmedRef.current = confirmed
  }, [confirmed])

  function startHold() {
    if (inactive) return
    holdingRef.current = true
    completedRef.current = false
    startRef.current = performance.now()

    if (reduce) {
      holdTimeoutRef.current = window.setTimeout(() => {
        if (!holdingRef.current) return
        completedRef.current = true
        commit()
        resetRing()
      }, holdMs)
      return
    }

    const tick = (now: number) => {
      if (!holdingRef.current) return
      const elapsed = now - startRef.current
      const p = Math.min(1, elapsed / holdMs)

      if (!ringShownRef.current && elapsed >= HOLD_THRESHOLD_MS) {
        ringShownRef.current = true
        setRingVisible(true)
        vibrate(8)
      }
      if (ringShownRef.current) setRingOffset(p)

      if (p >= 1) {
        completedRef.current = true
        commit()
        resetRing()
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
  }

  function cancelHold() {
    if (!holdingRef.current) return
    resetRing()
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (
      inactive ||
      !event.isPrimary ||
      event.button !== 0 ||
      activePointerIdRef.current !== null
    ) {
      return
    }
    activePointerIdRef.current = event.pointerId
    setPressing(true)
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Pointer capture is best-effort.
    }
    startHold()
  }

  function finishPointer(pointerId: number) {
    if (activePointerIdRef.current !== pointerId) return
    activePointerIdRef.current = null
    setPressing(false)
    cancelHold()
  }

  function handleClick() {
    if (inactive) return
    if (completedRef.current) {
      // Already committed by a completed hold — swallow the trailing click.
      completedRef.current = false
      return
    }
    commit()
  }

  const initials = venueName ? deriveVenueInitials(venueName) : ""

  return (
    <span className="inline-grid">
      <button
        type="button"
        aria-label={label}
        aria-describedby={inactive ? undefined : hintId}
        aria-busy={pending || undefined}
        aria-disabled={inactive}
        disabled={disabled}
        onPointerDown={handlePointerDown}
        onPointerUp={(event) => finishPointer(event.pointerId)}
        onPointerCancel={(event) => finishPointer(event.pointerId)}
        onLostPointerCapture={(event) => finishPointer(event.pointerId)}
        onClick={handleClick}
        data-stamp-press-button
        className={cn(
          "focus-ring relative grid size-28 touch-none place-items-center select-none",
          inactive ? "cursor-default" : "cursor-pointer"
        )}
      >
        <svg
          viewBox="0 0 100 100"
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -rotate-90"
          style={{ opacity: ringVisible ? 1 : 0 }}
        >
          <circle
            ref={ringRef}
            cx="50"
            cy="50"
            r={RING_RADIUS}
            fill="none"
            stroke="var(--w-accent)"
            strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={RING_CIRCUMFERENCE}
          />
        </svg>
        <span
          className={cn(
            "grid transition-transform duration-[var(--w-dur-press)] ease-out motion-reduce:transition-none",
            pressing && !reduce ? "scale-95" : "scale-100"
          )}
        >
          <StampDiscFace
            confirmed={confirmed}
            pending={pending}
            closed={inactive && !confirmed && !pending}
            initials={initials}
          />
        </span>
        {/* Names the gesture for assistive tech without altering the button's
            accessible name (kept as the label for e2e role-name locators). */}
        <span id={hintId} className="sr-only">
          Tap, or press and hold, to add today&apos;s stamp.
        </span>
      </button>
      {/* The hold gesture — a 600ms charge with a ring and haptics — was
          announced only to screen readers, and the ring appears 130ms into the
          hold, so sighted members had no way to know the path existed and
          always tapped. One printed line makes it an affordance (CUS 02#25).
          Hidden while the control is closed, where the band above carries the
          reason instead. */}
      {inactive ? null : (
        <span
          aria-hidden="true"
          className="mono-meta mt-1 text-center text-muted-foreground"
        >
          Tap or hold to stamp
        </span>
      )}
    </span>
  )
}
