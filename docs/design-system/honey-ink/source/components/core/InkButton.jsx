import React from "react"

const PALETTES = {
  primary: { background: "var(--w-accent)", color: "var(--w-accent-ink)" },
  dark: { background: "var(--w-ink)", color: "var(--w-paper)" },
  outline: { background: "var(--w-card)", color: "var(--w-ink)" },
}
const SIZES = {
  lg: { padding: "15px 24px", fontSize: 17, minHeight: 54 },
  md: { padding: "11px 18px", fontSize: 15, minHeight: 46 },
  sm: { padding: "7px 14px", fontSize: 13.5, minHeight: 38 },
}

/**
 * Wet Ink action control: 2px ink border, hard offset shadow that
 * collapses into the paper on press (translate 3px + shadow 1px).
 */
export function InkButton({ variant = "primary", size = "lg", full, onClick, children, style, disabled, ...props }) {
  const [down, setDown] = React.useState(false)
  const press = down && !disabled
  return (
    <button
      onClick={disabled ? undefined : onClick}
      onPointerDown={() => setDown(true)}
      onPointerUp={() => setDown(false)}
      onPointerLeave={() => setDown(false)}
      style={{
        fontFamily: "var(--w-display)", fontWeight: 700, letterSpacing: "0.01em",
        border: "2px solid var(--w-ink)", borderRadius: "var(--w-r)",
        cursor: disabled ? "default" : "pointer",
        width: full ? "100%" : undefined,
        boxShadow: press ? "var(--w-shadow-pressed)" : "var(--w-shadow)",
        transform: press ? "translate(3px,3px)" : "none",
        transition: "transform var(--w-dur-press), box-shadow var(--w-dur-press)",
        opacity: disabled ? 0.45 : 1,
        whiteSpace: "nowrap",
        touchAction: "manipulation",
        ...(PALETTES[variant] || PALETTES.primary), ...(SIZES[size] || SIZES.lg), ...style,
      }}
      {...props}
    >{children}</button>
  )
}
