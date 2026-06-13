import * as React from "react";

export interface ReceiptCardProps {
  children?: React.ReactNode;
  style?: React.CSSProperties;
  /** Play the paper-shake (the instant a stamp lands on the card). */
  shaking?: boolean;
  /** Motion intensity multiplier. */
  mo?: number;
}

/**
 * The receipt surface — perforated zigzag edge, ink border, hard shadow.
 * @startingPoint section="Surfaces" subtitle="Receipt card with stamp row" viewport="430x420"
 */
export function ReceiptCard(props: ReceiptCardProps): React.JSX.Element;

export interface ReceiptRuleProps {
  style?: React.CSSProperties;
}

/** Dashed rule between receipt sections. */
export function ReceiptRule(props: ReceiptRuleProps): React.JSX.Element;
