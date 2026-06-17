"use client"

/**
 * Wet Ink motion primitives — the Framer Motion library that backs every
 * choreographed beat in DESIGN.md. Each primitive is a thin, typed wrapper over
 * `motion/react` that reads its timing from `lib/motion/tokens.ts` and renders
 * static children when `prefers-reduced-motion` is set (no opacity blanking, no
 * empty states). Production code uses these instead of inline `animation: w-*`
 * CSS — the keyframes in globals.css remain only for the resting tilt fallback.
 */

import type { CSSProperties, ReactNode } from "react"
import { motion } from "motion/react"

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

/** One-shot primitives only animate while `active`; toggling it re-fires them. */
type Triggered = MotionBox & {
  active?: boolean
  /** Notified once the animation settles — handy for chaining beats. */
  onComplete?: () => void
}

/**
 * WetInkRise — standard entrance. Rises 14px (default) into place and settles
 * scale. Animates position/scale only, never opacity, so wrapped content stays
 * legible if the entrance never runs. Replaces the `w-rise` keyframe.
 */
export function WetInkRise({
  children,
  className,
  style,
  delay = 0,
  distance = 14,
}: MotionBox & { delay?: number; distance?: number }) {
  const reduce = useReducedMotionHook()

  if (reduce) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    )
  }

  return (
    <motion.div
      className={className}
      style={style}
      initial={{ y: distance, scale: 0.98 }}
      animate={{ y: 0, scale: 1 }}
      transition={{
        duration: wetInkTransition.rise.duration,
        ease: STANDARD_EASE,
        delay,
      }}
    >
      {children}
    </motion.div>
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
  const reduce = useReducedMotionHook()

  if (reduce || !active) {
    return (
      <span className={className} style={style}>
        {children}
      </span>
    )
  }

  return (
    <motion.span
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
    </motion.span>
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
  const reduce = useReducedMotionHook()

  if (reduce || !active) {
    return (
      <span className={className} style={style}>
        {children}
      </span>
    )
  }

  return (
    <motion.span
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
    </motion.span>
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
  const reduce = useReducedMotionHook()

  if (reduce || !active) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    )
  }

  return (
    <motion.div
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
    </motion.div>
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
  const reduce = useReducedMotionHook()

  if (reduce || !active) {
    return (
      <span className={className} style={style}>
        {children}
      </span>
    )
  }

  return (
    <motion.span
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
    </motion.span>
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
  const reduce = useReducedMotionHook()

  if (reduce || !active) {
    return (
      <span className={className} style={style}>
        {children}
      </span>
    )
  }

  return (
    <motion.span
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
    </motion.span>
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
  const reduce = useReducedMotionHook()

  if (reduce || !active) return null

  return (
    <motion.span
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
    </motion.span>
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
  const reduce = useReducedMotionHook()

  if (reduce) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    )
  }

  return (
    <motion.div
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
    </motion.div>
  )
}

/**
 * WetInkSheet — the bottom-sheet entrance. Slides translateY 100% → 0. Replaces
 * the `w-sheet-up` keyframe.
 */
export function WetInkSheet({ children, className, style }: MotionBox) {
  const reduce = useReducedMotionHook()

  if (reduce) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    )
  }

  return (
    <motion.div
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
    </motion.div>
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
