/**
 * Motion tokens — single source of truth for Framer Motion timing.
 *
 * Reads CSS variables from app/globals.css and exports Framer-compatible
 * transition configs (duration in seconds, easing as cubic-bezier arrays).
 * All motion primitives in components/motion/ use these tokens.
 */

/**
 * Framer Motion transition configs keyed by motion type.
 * Duration is in seconds (Framer Motion standard); CSS vars are in ms.
 */
export const wetInkTransition = {
  /**
   * Standard entrance: rise up 14px, standard ease, 0.32s.
   * Used by WetInkRise.
   */
  rise: {
    duration: 0.32,
    ease: [0.2, 0, 0, 1], // --w-ease
  },

  /**
   * Stamp slam: scale 2.6 → 1, rotate to --stamp-rot, overshoot ease, 0.38s.
   * Used by WetInkSlam on earned stamps.
   */
  slam: {
    duration: 0.38, // --w-dur-slam: 380ms
    ease: [0.16, 1.2, 0.3, 1], // --w-ease-slam (overshoot)
  },

  /**
   * Softer stamp for previews: scale 1.18 → 1, 0.38s, no overshoot.
   * Used by WetInkSoftStamp on join previews.
   */
  softStamp: {
    duration: 0.38, // --w-dur-slam: 380ms (same as slam)
    ease: [0.2, 0, 0, 1], // --w-ease (standard, not overshoot)
  },

  /**
   * Paper shake: x/y translate + tiny rotation jitter, 0.3s.
   * Used by WetInkShake on receipt cards after stamp slam.
   */
  shake: {
    duration: 0.3, // --w-dur-shake: 300ms
    ease: "easeInOut", // JS-friendly easing for jitter
  },

  /**
   * Reward pop: scale 0.6 → 1, overshoot ease, 0.42s.
   * Used by WetInkPop on reward seals and confetti dots.
   */
  pop: {
    duration: 0.42, // 420ms (from existing CSS keyframes)
    ease: [0.16, 1.2, 0.3, 1], // --w-ease-slam (overshoot)
  },

  /**
   * Reward wiggle: infinite rotate ±3°, 2.6s.
   * Used by WetInkWiggle on sealed mysteries (no tap-to-earn yet).
   */
  wiggle: {
    duration: 2.6,
    ease: "easeInOut",
    repeat: Infinity,
  },

  /**
   * Ripple expand: scale 0.4 → 2.1, fade out, 0.4s.
   * Used by WetInkRipple on stamp celebration.
   */
  ripple: {
    duration: 0.4,
    ease: "easeOut",
  },

  /**
   * Marquee scroll: infinite horizontal loop, 26s.
   * Used by WetInkMarquee on marketing strip.
   */
  marquee: {
    duration: 26,
    ease: "linear",
    repeat: Infinity,
  },

  /**
   * Sheet enter/exit: translateY from 100% → 0 or 0 → 100%, 0.32s.
   * Used by WetInkSheet on bottom sheets (legal, rewards).
   */
  sheet: {
    duration: 0.32, // --w-dur-move: 320ms
    ease: [0.2, 0, 0, 1], // --w-ease
  },

  /**
   * Button press: shadow collapse + 2px translate, 90ms instant.
   * NOT used by Framer — stays in globals.css Wet Ink layer.
   */
  press: {
    duration: 0.09, // --w-dur-press: 90ms
    ease: "easeOut",
  },

  celebration: {
    entry: {
      duration: 0.32,
      ease: [0.2, 0, 0, 1],
    },
    burst: {
      duration: 0.38,
      ease: [0.16, 1.2, 0.3, 1],
      dotStagger: 0.04,
    },
  },

  /**
   * General move/transition: 320ms standard ease.
   * Used by WetInkRise and other entrance animations.
   */
  move: {
    duration: 0.32, // --w-dur-move: 320ms
    ease: [0.2, 0, 0, 1], // --w-ease
  },
} as const

/**
 * Easings as cubic-bezier arrays for manual use.
 * Standard and overshoot variants align with DESIGN.md.
 */
export const easings = {
  /** Standard easing: --w-ease cubic-bezier(0.2, 0, 0, 1) */
  standard: [0.2, 0, 0, 1] as const,

  /** Slam easing with overshoot: --w-ease-slam cubic-bezier(0.16, 1.2, 0.3, 1) */
  slam: [0.16, 1.2, 0.3, 1] as const,
} as const
