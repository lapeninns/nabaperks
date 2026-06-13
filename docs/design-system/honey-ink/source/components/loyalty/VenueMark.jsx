import React from "react"

/**
 * Circular rubber-stamp mark: double ring (solid + dashed), rotated,
 * with big initials/glyph and a tiny mono caption. The venue identity
 * mark, also used for reward (✱) and redeemed (✓) states.
 */
export function VenueMark({ initials = "OC", caption = "OLD CROWN", size = 72, color = "var(--w-accent)", angle = -8 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      border: `2.5px solid ${color}`, color,
      display: "grid", placeItems: "center", position: "relative",
      transform: `rotate(${angle}deg)`,
    }}>
      <div style={{
        position: "absolute", inset: 4, borderRadius: "50%",
        border: `1.5px dashed ${color}`, opacity: 0.75,
      }}></div>
      <div style={{ textAlign: "center", lineHeight: 1 }}>
        <div style={{ fontFamily: "var(--w-display)", fontWeight: 800, fontSize: size * 0.34 }}>{initials}</div>
        {size >= 58 && <div style={{ fontFamily: "var(--w-mono)", fontSize: Math.max(6.5, size * 0.082), letterSpacing: "0.02em", maxWidth: size * 0.74, overflow: "hidden", whiteSpace: "nowrap", margin: "3px auto 0" }}>{caption}</div>}
      </div>
    </div>
  )
}
