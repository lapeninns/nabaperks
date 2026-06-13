import React from "react"

/**
 * Bottom sheet — the counter-moment container (staff PIN pad), scrim +
 * paper panel sliding up. Max width 430px, centred.
 */
export function Sheet({ open, onClose, children, mo = 1 }) {
  if (!open) return null
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(33,28,22,0.5)" }}></div>
      <div style={{
        position: "absolute", left: "50%", bottom: 0, transform: "translateX(-50%)",
        width: "100%", maxWidth: 430,
        background: "var(--w-paper)", borderTop: "2px solid var(--w-ink)",
        borderLeft: "2px solid var(--w-ink)", borderRight: "2px solid var(--w-ink)",
        borderRadius: "var(--w-r-sheet) var(--w-r-sheet) 0 0", padding: "14px 22px 30px",
        animation: `w-sheet-up ${320 * mo}ms var(--w-ease)`,
      }}>
        <div style={{ width: 44, height: 5, borderRadius: 999, background: "var(--w-line)", margin: "0 auto 16px" }}></div>
        {children}
      </div>
    </div>
  )
}
