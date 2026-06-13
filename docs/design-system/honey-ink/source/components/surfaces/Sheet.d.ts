import * as React from "react";

export interface SheetProps {
  open?: boolean;
  /** Scrim click handler. */
  onClose?: () => void;
  children?: React.ReactNode;
  /** Motion intensity multiplier. */
  mo?: number;
}

/** Bottom sheet — slides the counter moment (PIN pad) over the customer's card. */
export function Sheet(props: SheetProps): React.JSX.Element | null;
