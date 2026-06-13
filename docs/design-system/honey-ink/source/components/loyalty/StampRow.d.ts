import * as React from "react";

export interface StampDiscProps {
  /** Filled (collected) or dashed empty slot. */
  filled?: boolean;
  /** Zero-based slot index — shown as the visit number on empty slots. */
  index?: number;
  /** Play the landing animation + celebration particles. */
  slammed?: boolean;
  /** Celebration particle style when slammed. */
  celebration?: "Slam" | "Ripple" | "Burst";
  /** Motion intensity multiplier. */
  mo?: number;
  /** Disc diameter in px. Default 64. */
  size?: number;
  /** Mono date stamped under the ✱, e.g. "12 JUN". */
  date?: string;
}

/** One rubber-stamp slot (accent disc rotated -6°, or dashed empty circle). */
export function StampDisc(props: StampDiscProps): React.JSX.Element;

export interface StampRowProps {
  /** Stamps collected. */
  current?: number;
  /** Total slots (the visit loop — 3 in the MVP). */
  total?: number;
  /** Index of the slot that just landed (-1 = none). */
  slamIndex?: number;
  celebration?: "Slam" | "Ripple" | "Burst";
  mo?: number;
  size?: number;
  /** Mono dates per filled slot. */
  dates?: string[];
}

/**
 * The stamp card row — the heart of the loyalty card.
 * @startingPoint section="Loyalty" subtitle="Stamp row with slam moment" viewport="430x180"
 */
export function StampRow(props: StampRowProps): React.JSX.Element;
