"use client"

/**
 * Wet Ink motion primitives — the Framer Motion library that backs every
 * choreographed beat in DESIGN.md. Each primitive is a thin, typed wrapper over
 * `motion/react` that reads its timing from `lib/motion/tokens.ts` and renders
 * static children when `prefers-reduced-motion` is set (no opacity blanking, no
 * empty states). Production code uses these instead of inline w-prefixed CSS
 * animation hooks — the keyframes in globals.css remain only for the resting
 * tilt fallback.
 */

import {
  type AriaRole,
  type CSSProperties,
  type ReactNode,
} from "react"
import * as m from "motion/react-m"

import { useHydrated } from "@/lib/motion/use-hydrated"
import { useReducedMotionHook } from "@/lib/motion/use-reduced-motion"
import { wetInkTransition } from "@/lib/motion/tokens"

/** Standard Wet Ink easing — cubic-bezier(0.2, 0, 0, 1). */
const STANDARD_EASE: [number, number, number, number] = [0.2, 0, 0, 1]
/** Slam easing with overshoot — cubic-bezier(0.16, 1.2, 0.3, 1). */
const SLAM_EASE: [number, number, number, number] = [0.16, 1.2, 0.3, 1]

type MotionBox = {
  /** Optional so decorative leaves (confetti dots, ripple rings) can stand alone. */
  children?: ReactNode
  className?: string
  style?: CSSProperties
}

type WetInkRiseBase = MotionBox & {
  delay?: number
  distance?: number
  inView?: boolean
}

type WetInkForwardProps = {
  id?: string
  role?: AriaRole
  tabIndex?: number
  title?: string
  [ariaAttribute: `aria-${string}`]: string | number | boolean | undefined
  [dataAttribute: `data-${string}`]: string | number | boolean | undefined
}

type WetInkRiseProps = WetInkRiseBase &
  WetInkForwardProps & {
    as?: "div" | "section"
  }

function useWetInkAnimationEnabled() {
  const reduce = useReducedMotionHook()
  return useHydrated() && !reduce
}

/** One-shot primitives only animate while `active`; toggling it re-fires them. */
type Triggered = MotionBox & {
  active?: boolean
  /** Notified once the animation settles — handy for chaining beats. */
  onComplete?: () => void
}

/**
 * WetInkRise — standard entrance. Rises 14px (default) into place and settles
 * scale. Use `inView` for section entrances that should fire once when scrolled
 * into view, and `as` when the animated node must be the semantic element.
 * Animates position/scale only, never opacity, so wrapped content stays legible
 * if the entrance never runs. Replaces the `w-rise` keyframe.
 */
export function WetInkRise({ ...riseProps }: WetInkRiseProps) {
  const shouldAnimate = useWetInkAnimationEnabled()
  const target = { y: 0, scale: 1 }
  const viewport = riseProps.inView ? { once: true, amount: 0.2 } : undefined
  const transition = {
    duration: wetInkTransition.rise.duration,
    ease: STANDARD_EASE,
    delay: riseProps.delay ?? 0,
  }

  if (riseProps.as === "section") {
    const {
      as: _as,
      children,
      className,
      style,
      delay: _delay,
      distance = 14,
      inView = false,
      ...sectionProps
    } = riseProps
    void _as
    void _delay

    if (!shouldAnimate) {
      return (
        <section {...sectionProps} className={className} style={style}>
          {children}
        </section>
      )
    }

    return (
      <m.section
        {...sectionProps}
        className={className}
        style={style}
        initial={{ y: distance, scale: 0.98 }}
        animate={inView ? undefined : target}
        whileInView={inView ? target : undefined}
        viewport={viewport}
        transition={transition}
      >
        {children}
      </m.section>
    )
  }

  const {
    as: _as,
    children,
    className,
    style,
    delay: _delay,
    distance = 14,
    inView = false,
    ...divProps
  } = riseProps
  void _as
  void _delay

  if (!shouldAnimate) {
    return (
      <div {...divProps} className={className} style={style}>
        {children}
      </div>
    )
  }

  return (
    <m.div
      {...divProps}
      className={className}
      style={style}
      initial={{ y: distance, scale: 0.98 }}
      animate={inView ? undefined : target}
      whileInView={inView ? target : undefined}
      viewport={viewport}
      transition={transition}
    >
      {children}
    </m.div>
  )
}

/**
 * WetInkSlam — the stamp landing. Scale overshoots from 2.6 → 1 with a brief
 * settle, so a fresh stamp reads as slammed onto paper. Animates scale/opacity
 * only and never rotation: the disc keeps its CSS `rotate(var(--stamp-rot))`
 * resting tilt, which this wrapper scales in place. Replaces the `w-slam`
 * keyframe on earned stamps.
 */
export function WetInkSlam({
  children,
  className,
  style,
  active = false,
  onComplete,
}: Triggered) {
  const shouldAnimate = useWetInkAnimationEnabled()

  if (!shouldAnimate || !active) {
    return (
      <span className={className} style={style}>
        {children}
      </span>
    )
  }

  return (
    <m.span
      className={className}
      style={style}
      initial={{ scale: 2.6, opacity: 0 }}
      animate={{ scale: [2.6, 0.94, 1.04, 1], opacity: [0, 1, 1, 1] }}
      transition={{
        duration: wetInkTransition.slam.duration,
        ease: SLAM_EASE,
        times: [0, 0.62, 0.8, 1],
      }}
      onAnimationComplete={onComplete}
    >
      {children}
    </m.span>
  )
}

/**
 * WetInkSoftStamp — a gentler slam for previews. Scale eases 1.18 → 1 with the
 * standard curve (no overshoot). Replaces the `w-soft-stamp` keyframe.
 */
export function WetInkSoftStamp({
  children,
  className,
  style,
  active = false,
  onComplete,
}: Triggered) {
  const shouldAnimate = useWetInkAnimationEnabled()

  if (!shouldAnimate || !active) {
    return (
      <span className={className} style={style}>
        {children}
      </span>
    )
  }

  return (
    <m.span
      className={className}
      style={style}
      initial={{ scale: 1.18, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{
        duration: wetInkTransition.softStamp.duration,
        ease: STANDARD_EASE,
      }}
      onAnimationComplete={onComplete}
    >
      {children}
    </m.span>
  )
}

/**
 * WetInkShake — the paper jitter that can ride along with a slam. Translates a
 * few pixels with a tiny rotation and returns to rest. Replaces the `w-shake`
 * keyframe; intended to wrap a receipt or card.
 */
export function WetInkShake({
  children,
  className,
  style,
  active = false,
  onComplete,
}: Triggered) {
  const shouldAnimate = useWetInkAnimationEnabled()

  if (!shouldAnimate || !active) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    )
  }

  return (
    <m.div
      className={className}
      style={style}
      initial={{ x: 0, y: 0, rotate: 0 }}
      animate={{
        x: [0, -3, 3, -2, 0],
        y: [0, 2, -2, 1, 0],
        rotate: [0, -0.5, 0.5, -0.25, 0],
      }}
      transition={{
        duration: wetInkTransition.shake.duration,
        ease: "easeInOut",
        times: [0, 0.2, 0.45, 0.7, 1],
      }}
      onAnimationComplete={onComplete}
    >
      {children}
    </m.div>
  )
}

/**
 * WetInkPop — the reward reveal. Scale springs 0.6 → 1.08 → 1 with overshoot,
 * used on reward seals, the row reward chip, and confetti dots. Animates
 * scale/opacity only so any resting rotation on the child is preserved.
 * Replaces the `w-pop` keyframe.
 */
export function WetInkPop({
  children,
  className,
  style,
  active = false,
  delay = 0,
  onComplete,
}: Triggered & { delay?: number }) {
  const shouldAnimate = useWetInkAnimationEnabled()

  if (!shouldAnimate || !active) {
    return (
      <span className={className} style={style}>
        {children}
      </span>
    )
  }

  return (
    <m.span
      className={className}
      style={style}
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: [0.6, 1.08, 1], opacity: [0, 1, 1] }}
      transition={{
        duration: wetInkTransition.pop.duration,
        ease: SLAM_EASE,
        times: [0, 0.7, 1],
        delay,
      }}
      onAnimationComplete={onComplete}
    >
      {children}
    </m.span>
  )
}

/**
 * WetInkWiggle — the idle tease on a sealed mystery. Rotates gently ±3° on a
 * loop and pauses under reduced motion. Replaces the `w-wiggle` keyframe.
 */
export function WetInkWiggle({
  children,
  className,
  style,
  active = true,
}: MotionBox & { active?: boolean }) {
  const shouldAnimate = useWetInkAnimationEnabled()

  if (!shouldAnimate || !active) {
    return (
      <span className={className} style={style}>
        {children}
      </span>
    )
  }

  return (
    <m.span
      className={className}
      style={style}
      animate={{ rotate: [-3, 3, -3], scale: [1, 1.03, 1] }}
      transition={{
        duration: wetInkTransition.wiggle.duration,
        ease: "easeInOut",
        repeat: Infinity,
      }}
    >
      {children}
    </m.span>
  )
}

/**
 * WetInkBreathe — the resting pulse on an unlocked reward. Scales gently
 * 1 → 1.04 → 1 on a slow loop so a reward that is waiting out its rest day (or
 * sitting ready at the counter) reads as alive without demanding a tap. Scale
 * only — the seal never blanks — and holds completely still under reduced
 * motion. The calm companion to WetInkWiggle's sealed-mystery tease.
 */
export function WetInkBreathe({
  children,
  className,
  style,
  active = true,
}: MotionBox & { active?: boolean }) {
  const shouldAnimate = useWetInkAnimationEnabled()

  if (!shouldAnimate || !active) {
    return (
      <span className={className} style={style}>
        {children}
      </span>
    )
  }

  return (
    <m.span
      className={className}
      style={style}
      animate={{ scale: [1, 1.04, 1] }}
      transition={{
        duration: wetInkTransition.breathe.duration,
        ease: "easeInOut",
        repeat: Infinity,
      }}
    >
      {children}
    </m.span>
  )
}

/**
 * WetInkRipple — an expanding fade ring behind a celebration beat. Scales
 * 0.4 → 2.1 while fading out. Replaces the `w-ripple` keyframe.
 */
export function WetInkRipple({
  children,
  className,
  style,
  active = false,
}: Triggered) {
  const shouldAnimate = useWetInkAnimationEnabled()

  if (!shouldAnimate || !active) return null

  return (
    <m.span
      aria-hidden="true"
      className={className}
      style={style}
      initial={{ scale: 0.4, opacity: 0.9 }}
      animate={{ scale: 2.1, opacity: 0 }}
      transition={{
        duration: wetInkTransition.ripple.duration,
        ease: "easeOut",
      }}
    >
      {children}
    </m.span>
  )
}

/**
 * WetInkMarquee — the horizontal riso strip. Translates its track 0 → -50% on
 * an infinite linear loop (the caller renders the strip twice). Holds still
 * under reduced motion. Replaces the `w-marquee` keyframe.
 */
export function WetInkMarquee({
  children,
  className,
  style,
  durationSeconds = wetInkTransition.marquee.duration,
}: MotionBox & { durationSeconds?: number }) {
  const shouldAnimate = useWetInkAnimationEnabled()

  if (!shouldAnimate) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    )
  }

  return (
    <m.div
      className={className}
      style={style}
      animate={{ x: ["0%", "-50%"] }}
      transition={{
        duration: durationSeconds,
        ease: "linear",
        repeat: Infinity,
      }}
    >
      {children}
    </m.div>
  )
}

/**
 * WetInkSheet — the bottom-sheet entrance. Slides translateY 100% → 0. Replaces
 * the `w-sheet-up` keyframe.
 */
export function WetInkSheet({ children, className, style }: MotionBox) {
  const shouldAnimate = useWetInkAnimationEnabled()

  if (!shouldAnimate) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    )
  }

  return (
    <m.div
      className={className}
      style={style}
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      transition={{
        duration: wetInkTransition.sheet.duration,
        ease: STANDARD_EASE,
      }}
    >
      {children}
    </m.div>
  )
}

/**
 * StampSlamSequence — the composed beat: a stamp slams down and the receipt it
 * sits on shudders. Wrap the receipt/card; pass `active` when a fresh stamp
 * lands. The slam itself runs on the individual `StampDot` via `WetInkSlam`;
 * this adds the paper shake around it.
 */
export function StampSlamSequence({
  children,
  className,
  style,
  active = false,
  onComplete,
}: Triggered) {
  return (
    <WetInkShake
      active={active}
      className={className}
      style={style}
      onComplete={onComplete}
    >
      {children}
    </WetInkShake>
  )
}
