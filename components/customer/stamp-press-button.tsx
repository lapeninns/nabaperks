"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { PointerEvent as ReactPointerEvent } from "react"

import { CheckmarkBadge04Icon } from "@hugeicons/core-free-icons"

import { Icon } from "@/components/brand/icon"
import { deriveVenueInitials } from "@/components/brand/venue-mark"
import { WetInkBreathe } from "@/components/motion"
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
  holdMs = 600,
  label = "Add today's stamp",
}: {
  onStamp: () => void
  venueName?: string
  disabled?: boolean
  /** The stamp has landed — show the confirmed disc and ignore input. */
  secured?: boolean
  holdMs?: number
  label?: string
}) {
  const reduce = useReducedMotionHook()
  const ringRef = useRef<SVGCircleElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef(0)
  const holdingRef = useRef(false)
  const completedRef = useRef(false)
  const ringShownRef = useRef(false)
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

  const resetRing = useCallback(() => {
    stopRaf()
    holdingRef.current = false
    ringShownRef.current = false
    setRingVisible(false)
    setRingOffset(0)
  }, [setRingOffset, stopRaf])

  const commit = useCallback(() => {
    if (inactive) return
    vibrate(24)
    onStamp()
  }, [inactive, onStamp])

  useEffect(() => stopRaf, [stopRaf])

  function startHold() {
    if (inactive) return
    holdingRef.current = true
    completedRef.current = false
    startRef.current = performance.now()

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
    if (inactive) return
    setPressing(true)
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Pointer capture is best-effort.
    }
    startHold()
  }

  function handlePointerUp() {
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
    // Idle invite: the actionable disc breathes to advertise the tap/hold
    // gesture (the screen's single action). Gated on the stable `inactive` flag
    // so it pauses once a stamp is in flight or landed — and never remounts the
    // button mid-press. The primitive holds it static under reduced motion.
    <WetInkBreathe active={!inactive} className="inline-grid">
      <button
        type="button"
        aria-label={secured ? "Stamp added" : label}
        disabled={disabled}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleClick}
        className={cn(
          "relative grid size-28 touch-none place-items-center transition-transform duration-[var(--w-dur-fast)] ease-[var(--w-ease)] select-none motion-reduce:transition-none",
          pressing && !reduce ? "scale-95" : "scale-100",
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
            "grid size-[5.5rem] place-items-center rounded-full border-2 border-ink shadow-md",
            secured
              ? "bg-reward text-reward-foreground"
              : "bg-stamp text-stamp-foreground"
          )}
        >
          {secured ? (
            <Icon icon={CheckmarkBadge04Icon} size={34} />
          ) : initials ? (
            <span className="font-mono text-xl font-bold tracking-[0.04em] uppercase">
              {initials}
            </span>
          ) : (
            <Icon icon={CheckmarkBadge04Icon} size={30} />
          )}
        </span>
      </button>
    </WetInkBreathe>
  )
}
