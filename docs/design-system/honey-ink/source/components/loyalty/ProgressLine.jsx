import React from "react"

/**
 * Visits progress: mono label + count over a bordered track with accent fill.
 */
export function ProgressLine({ current = 0, total = 3, label = "Visits" }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7 }}>
        <div style={{
          fontFamily: "var(--w-mono)", fontSize: "var(--text-mono-meta)", letterSpacing: "0.06em",
          textTransform: "uppercase", color: "var(--w-ink-soft)",
        }}>{label}</div>
        <span style={{ fontFamily: "var(--w-mono)", fontSize: 13, fontWeight: 700 }}>{current}/{total}</span>
      </div>
      <div style={{ height: 12, border: "2px solid var(--w-ink)", borderRadius: 999, background: "var(--w-card)", overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${Math.min(100, (current / total) * 100)}%`,
          background: "var(--w-accent)",
          borderRight: current > 0 && current < total ? "2px solid var(--w-ink)" : "none",
          transition: "width 500ms var(--w-ease)",
        }}></div>
      </div>
    </div>
  )
}
