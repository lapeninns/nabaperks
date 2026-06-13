import React from "react"

/**
 * 6-digit OTP entry — boxes render the value, a hidden input takes
 * keyboard/paste/autofill (autoComplete="one-time-code").
 */
export function OtpBoxes({ length = 6, value = "", onChange }) {
  const ref = React.useRef(null)
  return (
    <div style={{ position: "relative", display: "flex", gap: 8, justifyContent: "center", cursor: "text" }}
      onClick={() => ref.current && ref.current.focus()}>
      <input ref={ref} value={value} inputMode="numeric" autoComplete="one-time-code"
        onChange={(e) => onChange && onChange(e.target.value.replace(/\D/g, "").slice(0, length))}
        style={{ position: "absolute", inset: 0, opacity: 0, width: "100%", border: "none" }} />
      {Array.from({ length }, (_, i) => (
        <div key={i} style={{
          width: 44, height: 56, border: "2px solid var(--w-ink)", borderRadius: "var(--w-r)",
          background: "var(--w-card)", display: "grid", placeItems: "center",
          fontFamily: "var(--w-mono)", fontSize: 24, fontWeight: 700,
          boxShadow: i === value.length ? "var(--w-shadow-sm)" : "none",
        }}>{value[i] || ""}</div>
      ))}
    </div>
  )
}
