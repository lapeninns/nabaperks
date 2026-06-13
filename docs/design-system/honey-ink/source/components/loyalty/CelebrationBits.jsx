import React from "react"

/**
 * Particle layer for stamp/reward celebrations. Render inside a
 * position:relative cell at the moment of celebration (keyed remount).
 */
export function CelebrationBits({ type = "Slam", mo = 1, seed = 1 }) {
  const bits = React.useMemo(() => {
    const rnd = (i, s) => {
      const x = Math.sin(seed * 997 + i * 131 + s * 17) * 10000
      return x - Math.floor(x)
    }
    const splats = Array.from({ length: 7 }, (_, i) => ({
      sx: (rnd(i, 1) - 0.5) * 110, sy: (rnd(i, 2) - 0.5) * 110,
      size: 4 + rnd(i, 3) * 7, delay: rnd(i, 4) * 60,
    }))
    const confetti = Array.from({ length: 16 }, (_, i) => ({
      cx: (rnd(i, 5) - 0.5) * 220, cy: -30 - rnd(i, 6) * 160,
      cr: (rnd(i, 7) - 0.5) * 540, w: 5 + rnd(i, 8) * 6, h: 8 + rnd(i, 9) * 8,
      color: ["var(--w-accent)", "var(--w-ink)", "var(--w-cobalt)", "var(--w-sun)"][i % 4],
      delay: rnd(i, 10) * 110,
    }))
    return { splats, confetti }
  }, [seed])

  const center = { position: "absolute", left: "50%", top: "50%" }
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "visible" }}>
      {(type === "Ripple") && [0, 1].map((i) => (
        <div key={"r" + i} style={{
          ...center, width: 70, height: 70, marginLeft: -35, marginTop: -35,
          border: "3px solid var(--w-accent)", borderRadius: "50%",
          animation: `w-ripple ${(620 + i * 200) * mo}ms ${i * 120 * mo}ms var(--w-ease) forwards`,
          opacity: 0,
        }}></div>
      ))}
      {(type === "Slam" || type === "Burst") && bits.splats.map((s, i) => (
        <div key={"s" + i} style={{
          ...center, width: s.size, height: s.size, marginLeft: -s.size / 2, marginTop: -s.size / 2,
          background: "var(--w-accent)", borderRadius: "50%",
          "--sx": s.sx + "px", "--sy": s.sy + "px",
          animation: `w-splat ${480 * mo}ms ${s.delay * mo}ms var(--w-ease) forwards`,
          opacity: 0,
        }}></div>
      ))}
      {type === "Burst" && bits.confetti.map((c, i) => (
        <div key={"c" + i} style={{
          ...center, width: c.w, height: c.h, marginLeft: -c.w / 2, marginTop: -c.h / 2,
          background: c.color, border: "1px solid var(--w-ink)",
          "--cx": c.cx + "px", "--cy": c.cy + "px", "--cr": c.cr + "deg",
          animation: `w-confetti ${900 * mo}ms ${c.delay * mo}ms var(--w-ease) forwards`,
          opacity: 0,
        }}></div>
      ))}
    </div>
  )
}
