import React from "react"

/**
 * The mystery reward seal — a gold disc with "?" the customer breaks at
 * 3 visits. `Hold` = press-and-hold ~850ms with a progress ring (default);
 * `Tap` = instant. Calls onBroken after the break animation.
 */
export function Seal({ mode = "Hold", onBroken, mo = 1, size = 104 }) {
  const [progress, setProgress] = React.useState(0)
  const [breaking, setBreaking] = React.useState(false)
  const timer = React.useRef(null)

  const finish = () => {
    setBreaking(true)
    setTimeout(() => onBroken && onBroken(), 360 * mo)
  }
  const start = () => {
    if (mode === "Tap") { finish(); return }
    const t0 = Date.now()
    timer.current = setInterval(() => {
      const p = Math.min(1, (Date.now() - t0) / (850 * mo))
      setProgress(p)
      if (p >= 1) { clearInterval(timer.current); finish() }
    }, 24)
  }
  const stop = () => {
    if (mode === "Tap") return
    clearInterval(timer.current)
    if (!breaking) setProgress(0)
  }
  React.useEffect(() => () => clearInterval(timer.current), [])

  return (
    <div style={{ textAlign: "center" }}>
      <div
        onPointerDown={start} onPointerUp={stop} onPointerLeave={stop}
        style={{
          width: size, height: size, margin: "0 auto", position: "relative",
          cursor: "pointer", userSelect: "none", touchAction: "none",
          animation: breaking ? `w-shake ${300 * mo}ms` : (progress > 0 ? `w-wiggle ${420 * mo}ms infinite` : "none"),
        }}>
        <div style={{
          position: "absolute", inset: -6, borderRadius: "50%",
          background: `conic-gradient(var(--w-ink) ${progress * 360}deg, transparent 0deg)`,
          WebkitMask: "radial-gradient(circle, transparent 64%, #000 65%)",
          mask: "radial-gradient(circle, transparent 64%, #000 65%)",
        }}></div>
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: "var(--w-sun)", border: "2px solid var(--w-ink)",
          boxShadow: "var(--w-shadow-sm)", display: "grid", placeItems: "center",
          transform: "rotate(-6deg)",
        }}>
          <div style={{ position: "absolute", inset: 7, border: "1.5px dashed rgba(33,28,22,0.5)", borderRadius: "50%" }}></div>
          <div style={{ fontFamily: "var(--w-display)", fontWeight: 800, fontSize: size * 0.42 }}>?</div>
        </div>
      </div>
      <div style={{
        marginTop: 14, fontFamily: "var(--w-mono)", fontSize: "var(--text-mono-meta)",
        letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--w-ink-soft)",
      }}>{mode === "Hold" ? "Press & hold to break the seal" : "Tap to break the seal"}</div>
    </div>
  )
}
