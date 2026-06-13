import React from "react"

/**
 * Underlined text action for tertiary choices ("Maybe later", "Skip for now").
 */
export function GhostLink({ onClick, children, style, ...props }) {
  return (
    <button onClick={onClick} style={{
      background: "none", border: "none", cursor: "pointer",
      fontFamily: "var(--w-display)", fontWeight: 700, fontSize: 15,
      color: "var(--w-ink)", textDecoration: "underline", textUnderlineOffset: 4,
      padding: 8, minHeight: 44, ...style,
    }} {...props}>{children}</button>
  )
}
