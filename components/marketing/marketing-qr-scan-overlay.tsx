"use client"

import { motion } from "motion/react"

import { useReducedMotionHook } from "@/lib/motion/use-reduced-motion"
import { cn } from "@/lib/utils"

/** Animated scan line for marketing QR vignettes. */
export function MarketingQrScanOverlay({
  active,
  className,
}: {
  active: boolean
  className?: string
}) {
  const shouldReduceMotion = useReducedMotionHook()
  if (!active || shouldReduceMotion) return null

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden rounded-sm",
        className
      )}
    >
      <motion.div
        className="absolute inset-x-0 h-0.5 bg-primary shadow-[0_0_8px_var(--primary)]"
        animate={{ top: ["10%", "90%", "10%"] }}
        transition={{
          duration: 1.35,
          ease: "easeInOut",
          repeat: Number.POSITIVE_INFINITY,
        }}
      />
    </div>
  )
}
