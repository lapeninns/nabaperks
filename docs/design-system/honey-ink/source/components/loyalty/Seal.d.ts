import * as React from "react";

export interface SealProps {
  /** `Hold` (press-and-hold with progress ring, default) or `Tap` (instant). */
  mode?: "Hold" | "Tap";
  /** Called after the break animation completes. */
  onBroken?: () => void;
  /** Motion intensity multiplier. */
  mo?: number;
  /** Disc diameter in px. Default 104. */
  size?: number;
}

/**
 * The mystery reward seal — the emotional peak of the loyalty loop.
 * @startingPoint section="Loyalty" subtitle="Press-and-hold mystery seal" viewport="430x220"
 */
export function Seal(props: SealProps): React.JSX.Element;
