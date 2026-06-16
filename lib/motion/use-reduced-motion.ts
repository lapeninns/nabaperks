"use client"

/**
 * Hook to detect and respect prefers-reduced-motion.
 *
 * Wrapper over motion/react's useReducedMotion() for consistent naming
 * and to centralize the import. All WetInk* primitives check this hook
 * and render static children when true.
 */

import { useReducedMotion as useMotionReduced } from "motion/react"

/**
 * Returns true if the user has set prefers-reduced-motion: reduce.
 *
 * @returns true if reduced motion is preferred; false (or null) otherwise
 */
export function useReducedMotionHook(): boolean {
  // motion/react's useReducedMotion returns boolean | null.
  // Treat null as false (motion is acceptable).
  return useMotionReduced() ?? false
}

/**
 * Type helper for reduced-motion checks.
 */
export type ReducedMotion = boolean
