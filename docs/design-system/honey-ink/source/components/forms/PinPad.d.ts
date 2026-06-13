import * as React from "react";

export interface PinPadProps {
  /** Called with the 4-digit string ~320ms after the last digit. */
  onDone?: (pin: string) => void;
  /** Bold mono header, e.g. "Staff: stamp this card". */
  label?: string;
  /** Plain sentence under the label. */
  sublabel?: string;
  /** Optional mono footnote under the keys. */
  note?: string;
}

/**
 * 4-digit staff session PIN pad for the paired counter station.
 * @startingPoint section="Forms" subtitle="Staff PIN pad" viewport="430x520"
 */
export function PinPad(props: PinPadProps): React.JSX.Element;
