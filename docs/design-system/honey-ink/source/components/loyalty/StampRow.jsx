import React from "react"
import { CelebrationBits } from "./CelebrationBits.jsx"

/**
 * One rubber-stamp slot. Filled = accent disc rotated -6° with ✱ + date;
 * empty = dashed circle with the visit number. `slammed` plays the landing.
 */
export function StampDisc({ filled, index = 0, slammed, celebration = "Slam", mo = 1, size = 64, date }) {
  const anim = slammed
    ? (celebration === "Ripple"
      ? `w-soft-stamp ${340 * mo}ms var(--w-ease) both`
      : `w-slam ${380 * mo}ms var(--w-ease-slam) both`)
    : "none"
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      {filled ? (
        <div style={{
          width: size, height: size, borderRadius: "50%",
          background: "var(--w-accent)", color: "var(--w-accent-ink)",
          border: "2px solid var(--w-ink)",
          display: "grid", placeItems: "center",
          transform: "rotate(-6deg)", animation: anim,
          position: "relative",
        }}>
          <div style={{ position: "absolute", inset: 5, border: "1.5px dashed rgba(255,255,255,0.65)", borderRadius: "50%" }}></div>
          <div style={{ textAlign: "center", lineHeight: 1 }}>
            <div style={{ fontSize: size * 0.4, fontWeight: 800, fontFamily: "var(--w-display)" }}>✱</div>
            {date && <div style={{ fontFamily: "var(--w-mono)", fontSize: Math.max(7, size * 0.11), letterSpacing: "0.04em", marginTop: 1 }}>{date}</div>}
          </div>
        </div>
      ) : (
        <div style={{
          width: size, height: size, borderRadius: "50%",
          border: "2px dashed var(--w-line)",
          display: "grid", placeItems: "center",
          color: "var(--w-ink-soft)", fontFamily: "var(--w-mono)", fontSize: size * 0.26,
        }}>{index + 1}</div>
      )}
      {slammed && <CelebrationBits type={celebration} mo={mo} seed={index + 2} />}
    </div>
  )
}

/**
 * The stamp card row: filled discs up to `current`, dashed slots to `total`.
 * Pass `slamIndex` for the slot that just landed.
 */
export function StampRow({ current = 0, total = 3, slamIndex = -1, celebration, mo, size = 64, dates = [] }) {
  return (
    <div style={{ display: "flex", gap: 14, justifyContent: "center" }}>
      {Array.from({ length: total }, (_, i) => (
        <StampDisc key={i} index={i} filled={i < current} slammed={i === slamIndex}
          celebration={celebration} mo={mo} size={size} date={dates[i]} />
      ))}
    </div>
  )
}
