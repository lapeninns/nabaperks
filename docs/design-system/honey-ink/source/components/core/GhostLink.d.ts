import * as React from "react";

export interface GhostLinkProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
}

/** Underlined tertiary text action — the polite escape hatch. */
export function GhostLink(props: GhostLinkProps): React.JSX.Element;
