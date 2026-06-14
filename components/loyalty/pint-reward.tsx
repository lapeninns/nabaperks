"use client"

import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"

const ease = [0.2, 0, 0, 1] as const

/**
 * Pint glass illustration in the Wet Ink palette — amber fill (`--seal`), a cream
 * foam head, and an ink outline. With `pour`, the beer rises from the base and the
 * foam pops on mount; `prefers-reduced-motion` renders the full pint statically.
 *
 * This is the *optional* beverage flourish only — the default reward hero is the
 * merchant-agnostic {@link RewardTicket}. Use a pint pour only when the reward is
 * a drink, never as the generic reward visual.
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

/** Optional captioned pint — beverage rewards only, never the default hero. */
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
