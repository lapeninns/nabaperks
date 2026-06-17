"use client"

import type { ReactNode } from "react"
import { CheckmarkBadge04Icon } from "@hugeicons/core-free-icons"
import { motion } from "motion/react"

import { Icon } from "@/components/brand"
import { useReducedMotionHook } from "@/lib/motion/use-reduced-motion"
import { wetInkTransition } from "@/lib/motion/tokens"

const burstDots = [
  { x: -54, y: -18, size: "size-2" },
  { x: -34, y: 28, size: "size-1.5" },
  { x: 0, y: -42, size: "size-2.5" },
  { x: 42, y: -26, size: "size-2" },
  { x: 56, y: 18, size: "size-1.5" },
]

export function StampCelebration({ children }: { children: ReactNode }) {
  const shouldReduceMotion = useReducedMotionHook()
  const entryTransition = wetInkTransition.celebration.entry
  const burstTransition = wetInkTransition.celebration.burst

  if (shouldReduceMotion) {
    return <div>{children}</div>
  }

  return (
    <motion.div
      className="relative"
      initial={{ opacity: 0, y: 10, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={entryTransition}
    >
      {children}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-4 mx-auto block size-1"
      >
        <motion.span
          className="absolute left-1/2 top-1/2 -ml-3.5 -mt-3.5 -rotate-6 select-none leading-none text-primary"
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: [0, 1, 0], scale: [0.4, 1.1, 0.9] }}
          transition={burstTransition}
        >
          <Icon icon={CheckmarkBadge04Icon} size={28} strokeWidth={2.5} />
        </motion.span>
        {burstDots.map((dot, index) => (
          <motion.span
            key={`${dot.x}-${dot.y}`}
            className={`absolute left-1/2 top-1/2 rounded-full bg-primary ${dot.size}`}
            initial={{ opacity: 0, x: 0, y: 0, scale: 0.35 }}
            animate={{ opacity: [0, 1, 0], x: dot.x, y: dot.y, scale: 1 }}
            transition={{
              duration: burstTransition.duration,
              delay: burstTransition.dotStagger * index,
              ease: burstTransition.ease,
            }}
          />
        ))}
      </span>
    </motion.div>
  )
}
