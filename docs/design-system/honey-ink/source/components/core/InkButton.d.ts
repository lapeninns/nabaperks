import * as React from "react";

export interface InkButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "size"> {
  /** Visual style. `primary` is the accent ink; `dark` is solid ink; `outline` is card-on-paper. */
  variant?: "primary" | "dark" | "outline";
  /** Control height: lg 54px (customer primary), md 46px, sm 38px (merchant chrome). */
  size?: "lg" | "md" | "sm";
  /** Stretch to 100% width (customer column CTAs). */
  full?: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
}

/**
 * Hard-shadow action button — the shadow collapses into the paper on press.
 * @startingPoint section="Core" subtitle="Buttons in all variants & sizes" viewport="700x260"
 */
export function InkButton(props: InkButtonProps): React.JSX.Element;
