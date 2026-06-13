import * as React from "react";

export interface VenueMarkProps {
  /** Big glyph in the centre — venue initials, ✱ (reward), ✓ (redeemed). */
  initials?: string;
  /** Tiny mono caption — venue name, reward Nº, date. Hidden below 58px. */
  caption?: string;
  /** Diameter in px. Default 72. */
  size?: number;
  /** Ink colour (CSS value). Accent by default; leaf for success states. */
  color?: string;
  /** Rotation in degrees. Default -8. */
  angle?: number;
}

/** Circular rubber-stamp identity mark (venue logo, reward seal, redeemed mark). */
export function VenueMark(props: VenueMarkProps): React.JSX.Element;
