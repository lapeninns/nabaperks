"use client"

import type { ReactNode } from "react"
import { motion, useReducedMotion } from "motion/react"

const stampEase = [0.2, 0, 0, 1] as const

export function MotionReveal({
  children,
  className,
  delay = 0,
  distance = 14,
}: {
  children: ReactNode
  className?: string
  delay?: number
  distance?: number
}) {
  const shouldReduceMotion = useReducedMotion()

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>
  }

  // Animate position/scale only — never opacity — so wrapped content stays
  // legible even if the entrance never runs (pre-hydration, a throttled
  // background tab that pauses rAF, or JS disabled). Content must not blank out.
  return (
    <motion.div
      initial={{ y: distance, scale: 0.98 }}
      animate={{ y: 0, scale: 1 }}
      transition={{ duration: 0.4, delay, ease: stampEase }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
