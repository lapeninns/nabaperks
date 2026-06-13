import React from "react"

export function PinPad({ onDone, label = "Staff PIN", sublabel = "Use the paired counter station", note }) {
  const [digits, setDigits] = React.useState("")
  React.useEffect(() => {
    if (digits.length === 4) {
      const t = setTimeout(() => onDone && onDone(digits), 320)
      return () => clearTimeout(t)
    }
  }, [digits])
  const key = (k) => {
    if (k === "⌫") setDigits((d) => d.slice(0, -1))
    else if (digits.length < 4) setDigits((d) => d + k)
  }
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"]
  const monoLine = {
    fontFamily: "var(--w-mono)", fontSize: "var(--text-mono-meta)", letterSpacing: "0.06em",
    textTransform: "uppercase", color: "var(--w-ink-soft)",
  }
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ ...monoLine, color: "var(--w-ink)", fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 13.5, color: "var(--w-ink-soft)", marginTop: 4, fontFamily: "var(--w-display)" }}>{sublabel}</div>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", margin: "18px 0 20px" }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{
            width: 16, height: 16, borderRadius: "50%",
            border: "2px solid var(--w-ink)",
            background: i < digits.length ? "var(--w-accent)" : "transparent",
            transition: "background 120ms",
          }}></div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, maxWidth: 290, margin: "0 auto" }}>
        {keys.map((k, i) =>
          k === "" ? <div key={i}></div> : (
            <button key={i} onClick={() => key(k)} style={{
              height: 60, border: "2px solid var(--w-ink)", borderRadius: "var(--w-r)",
              background: "var(--w-card)", fontFamily: "var(--w-mono)", fontSize: 22, fontWeight: 700,
              cursor: "pointer", color: "var(--w-ink)", boxShadow: "var(--w-shadow-sm)",
              touchAction: "manipulation",
            }}
              onPointerDown={(e) => { e.currentTarget.style.transform = "translate(2px,2px)"; e.currentTarget.style.boxShadow = "var(--w-shadow-pressed)" }}
              onPointerUp={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "var(--w-shadow-sm)" }}
              onPointerLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "var(--w-shadow-sm)" }}
            >{k}</button>
          )
        )}
      </div>
      {note && <div style={{ ...monoLine, marginTop: 16, fontSize: 10 }}>{note}</div>}
    </div>
  )
}
