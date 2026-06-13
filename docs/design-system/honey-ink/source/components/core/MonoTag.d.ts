import * as React from "react";

export interface MonoTagProps {
  /** `plain` (quiet outline), `accent` (hot ink — celebration states), `ink` (solid — saved/ready). */
  tone?: "plain" | "accent" | "ink";
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

/** Uppercase mono pill tag for statuses and kickers. */
export function MonoTag(props: MonoTagProps): React.JSX.Element;

export interface MonoLineProps {
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

/** Uppercase mono meta line — eyebrows, receipt metadata, footnotes. */
export function MonoLine(props: MonoLineProps): React.JSX.Element;
