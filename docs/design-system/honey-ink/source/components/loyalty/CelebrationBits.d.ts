import * as React from "react";

export interface CelebrationBitsProps {
  /** `Slam` (ink splats), `Ripple` (soft rings), `Burst` (splats + confetti). */
  type?: "Slam" | "Ripple" | "Burst";
  /** Motion intensity multiplier (durations scale by it). Default 1. */
  mo?: number;
  /** Deterministic particle layout seed. */
  seed?: number;
}

/** One-shot particle layer for stamp & reward celebration moments. */
export function CelebrationBits(props: CelebrationBitsProps): React.JSX.Element;
