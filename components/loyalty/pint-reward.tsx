"use client"

import type { ReactNode } from "react"
import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"

const ease = [0.2, 0, 0, 1] as const

/**
 * Pint glass illustration in the Wet Ink palette — amber fill (`--seal`), a cream
 * foam head, and an ink outline. With `pour`, the beer rises from the base and the
 * foam pops on mount; `prefers-reduced-motion` renders the full pint statically.
 */
export function PintGlass({
  size = 96,
  pour = false,
  className,
}: {
  size?: number
  pour?: boolean
  className?: string
}) {
  const reduce = useReducedMotion()
  const animate = pour && !reduce

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 72 96"
      fill="none"
      role="img"
      aria-label="A pint of beer"
      className={cn("block", className)}
    >
      <defs>
        <clipPath id="pint-interior">
          <path d="M19 15 H53 L48.5 80 Q48 84.5 43 84.5 H29 Q24 84.5 23.5 80 Z" />
        </clipPath>
      </defs>

      {/* Amber fill, clipped to the glass interior and grown from the base. */}
      <g clipPath="url(#pint-interior)">
        <motion.rect
          x="0"
          y="0"
          width="72"
          height="96"
          className="fill-seal"
          style={{ transformBox: "fill-box", transformOrigin: "bottom" }}
          initial={animate ? { scaleY: 0 } : false}
          animate={animate ? { scaleY: 1 } : undefined}
          transition={{ duration: 0.85, ease }}
        />
      </g>

      {/* Glass outline (drawn over the fill so the rim stays crisp). */}
      <path
        d="M16 12 H56 L51 82 Q50 88 44 88 H28 Q22 88 21 82 Z"
        className="stroke-ink"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />

      {/* Foam head — pops up just after the fill reaches the rim. */}
      <motion.path
        d="M18 16 Q18 6 36 6 Q54 6 54 16 Z"
        className="fill-card stroke-ink"
        strokeWidth="2.5"
        strokeLinejoin="round"
        initial={animate ? { opacity: 0, y: -6 } : false}
        animate={animate ? { opacity: 1, y: 0 } : undefined}
        transition={{ duration: 0.4, delay: 0.55, ease }}
      />
    </svg>
  )
}

/** Pint glass with a mono caption — the reward visual on the reward screens. */
export function PintReward({
  caption,
  pour = false,
  size = 92,
  className,
}: {
  caption: string
  pour?: boolean
  size?: number
  className?: string
}) {
  return (
    <div className={cn("grid justify-items-center gap-3", className)}>
      <PintGlass size={size} pour={pour} />
      <span className="font-mono text-[0.68rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
        {caption}
      </span>
    </div>
  )
}

const confetti = [
  { x: -58, y: -8, tone: "bg-primary", size: "size-2" },
  { x: -40, y: -38, tone: "bg-seal", size: "size-2.5" },
  { x: -14, y: -52, tone: "bg-reward", size: "size-2" },
  { x: 16, y: -50, tone: "bg-primary", size: "size-2.5" },
  { x: 42, y: -36, tone: "bg-seal", size: "size-2" },
  { x: 58, y: -6, tone: "bg-reward", size: "size-2.5" },
]

/**
 * Card-complete celebration — the "all stamps collected" moment. The pint pours
 * and a short confetti burst fires once on mount. Reduced-motion shows the
 * finished pint and copy without animation.
 */
export function PintRewardCelebration({
  title,
  message,
}: {
  title: ReactNode
  message: ReactNode
}) {
  const reduce = useReducedMotion()

  return (
    <motion.section
      aria-label="Card complete"
      className="relative grid justify-items-center gap-3 rounded-2xl border-2 border-ink bg-reward/12 px-5 py-6 text-center"
      initial={reduce ? false : { opacity: 0, scale: 0.95 }}
      animate={reduce ? undefined : { opacity: 1, scale: 1 }}
      transition={{ duration: 0.34, ease }}
    >
      {reduce ? null : (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-10 left-1/2 block size-0"
        >
          {confetti.map((dot, index) => (
            <motion.span
              key={index}
              className={cn("absolute rounded-full", dot.tone, dot.size)}
              initial={{ opacity: 0, x: 0, y: 0, scale: 0.3 }}
              animate={{ opacity: [0, 1, 0], x: dot.x, y: dot.y, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.5 + 0.04 * index, ease }}
            />
          ))}
        </span>
      )}
      <PintGlass size={104} pour />
      <div className="grid gap-1">
        <p className="text-lg leading-tight font-extrabold">{title}</p>
        <p className="text-sm leading-6 text-muted-foreground">{message}</p>
      </div>
    </motion.section>
  )
}
