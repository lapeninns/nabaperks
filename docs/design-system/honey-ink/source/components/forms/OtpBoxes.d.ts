import * as React from "react";

export interface OtpBoxesProps {
  /** Number of digits. Default 6. */
  length?: number;
  /** Current digits (controlled). */
  value?: string;
  onChange?: (digits: string) => void;
}

/** 6-digit verification code entry for the "Keep your card" step. */
export function OtpBoxes(props: OtpBoxesProps): React.JSX.Element;
