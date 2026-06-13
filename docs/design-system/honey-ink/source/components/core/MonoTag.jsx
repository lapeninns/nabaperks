import React from "react"

const TONES = {
  accent: { background: "var(--w-accent)", color: "var(--w-accent-ink)", border: "1.5px solid var(--w-ink)" },
  ink: { background: "var(--w-ink)", color: "var(--w-paper)", border: "1.5px solid var(--w-ink)" },
  plain: { background: "transparent", color: "var(--w-ink-soft)", border: "1.5px solid var(--w-line)" },
}

/**
 * Mono pill tag — status chips & kickers ("STAMPED", "Browser first").
 */
export function MonoTag({ children, tone = "plain", style }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      fontFamily: "var(--w-mono)", fontSize: 11, fontWeight: 700,
      textTransform: "uppercase", letterSpacing: "0.08em",
      borderRadius: 999, padding: "4px 11px", whiteSpace: "nowrap",
      ...(TONES[tone] || TONES.plain), ...style,
    }}>{children}</span>
  )
}

/**
 * Mono meta line — eyebrows, receipt metadata, footnotes.
 */
export function MonoLine({ children, style }) {
  return (
    <div style={{
      fontFamily: "var(--w-mono)", fontSize: "var(--text-mono-meta)", letterSpacing: "0.06em",
      textTransform: "uppercase", color: "var(--w-ink-soft)", ...style,
    }}>{children}</div>
  )
}
