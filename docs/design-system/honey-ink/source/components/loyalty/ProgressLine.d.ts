import * as React from "react";

export interface ProgressLineProps {
  current?: number;
  total?: number;
  /** Mono label, e.g. "Visits". */
  label?: string;
}

/** Bordered progress track with accent fill — visits toward the reward. */
export function ProgressLine(props: ProgressLineProps): React.JSX.Element;
