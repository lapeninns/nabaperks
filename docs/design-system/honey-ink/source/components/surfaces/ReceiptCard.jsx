import React from "react"

/**
 * The receipt card — Wet Ink's primary surface. White-ish card lifted off
 * the paper with a 2px ink border, hard offset shadow, and a perforated
 * zigzag bottom edge. `shaking` plays the paper-shake (when a stamp lands).
 */
export function ReceiptCard({ children, style, shaking, mo = 1 }) {
  return (
    <div style={{ filter: "drop-shadow(var(--w-shadow))", ...style }}>
      <div style={{
        background: "var(--w-card)", border: "2px solid var(--w-ink)", borderBottom: "none",
        borderRadius: "var(--w-r) var(--w-r) 0 0", padding: "20px 20px 14px",
        animation: shaking ? `w-shake ${300 * mo}ms cubic-bezier(0.36,0.07,0.19,0.97)` : "none",
      }}>
        {children}
      </div>
      <div style={{
        height: 12, marginTop: -1,
        background:
          "linear-gradient(-45deg, transparent 8.5px, var(--w-ink) 8.5px, var(--w-ink) 11px, var(--w-card) 11px) 0 0 / 17px 100%, " +
          "linear-gradient(45deg, transparent 8.5px, var(--w-ink) 8.5px, var(--w-ink) 11px, var(--w-card) 11px) 0 0 / 17px 100%",
      }}></div>
    </div>
  )
}

/**
 * Dashed horizontal rule between receipt sections.
 */
export function ReceiptRule({ style }) {
  return <div style={{ borderTop: "2px dashed var(--w-line)", margin: "14px 0", ...style }}></div>
}
