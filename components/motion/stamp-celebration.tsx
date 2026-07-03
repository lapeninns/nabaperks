"use client"

import { type ReactNode } from "react"
import { CheckmarkBadge04Icon } from "@hugeicons/core-free-icons"
import * as m from "motion/react-m"

import { Icon } from "@/components/brand"
import { useHydrated } from "@/lib/motion/use-hydrated"
import { useReducedMotionHook } from "@/lib/motion/use-reduced-motion"
import { wetInkTransition } from "@/lib/motion/tokens"

const burstDots = [
  { x: -54, y: -18, size: "size-2" },
  { x: -34, y: 28, size: "size-1.5" },
  { x: 0, y: -42, size: "size-2.5" },
  { x: 42, y: -26, size: "size-2" },
  { x: 56, y: 18, size: "size-1.5" },
]

function useCelebrationAnimationEnabled() {
  const shouldReduceMotion = useReducedMotionHook()
  return useHydrated() && !shouldReduceMotion
}

export function StampCelebration({ children }: { children: ReactNode }) {
  const shouldAnimate = useCelebrationAnimationEnabled()
  const entryTransition = wetInkTransition.celebration.entry
  const burstTransition = wetInkTransition.celebration.burst

  if (!shouldAnimate) {
    return <div>{children}</div>
  }

  return (
    <m.div
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
        <m.span
          className="absolute top-1/2 left-1/2 -mt-3.5 -ml-3.5 -rotate-6 leading-none text-primary select-none"
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: [0, 1, 0], scale: [0.4, 1.1, 0.9] }}
          transition={burstTransition}
        >
          <Icon icon={CheckmarkBadge04Icon} size={28} strokeWidth={2.5} />
        </m.span>
        {burstDots.map((dot, index) => (
          <m.span
            key={`${dot.x}-${dot.y}`}
            className={`absolute top-1/2 left-1/2 rounded-full bg-primary ${dot.size}`}
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
    </m.div>
  )
}
