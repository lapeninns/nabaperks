// Nabaperks v2 "Wet Ink" — shared primitives
// Exposed on window at the end of file.
const { useState, useEffect, useMemo, useRef } = React;

/* ---------- buttons ---------- */

function InkButton({ variant = "primary", size = "lg", full, onClick, children, style, disabled }) {
  const [down, setDown] = useState(false);
  const palettes = {
    primary: { background: "var(--w-accent)", color: "#fff" },
    dark: { background: "var(--w-ink)", color: "var(--w-paper)" },
    outline: { background: "var(--w-card)", color: "var(--w-ink)" },
  };
  const sizes = {
    lg: { padding: "15px 24px", fontSize: 17, minHeight: 54 },
    md: { padding: "11px 18px", fontSize: 15, minHeight: 46 },
    sm: { padding: "7px 14px", fontSize: 13.5, minHeight: 38 },
  };
  const press = down && !disabled;
  return (
    <button
      onClick={disabled ? undefined : onClick}
      onPointerDown={() => setDown(true)}
      onPointerUp={() => setDown(false)}
      onPointerLeave={() => setDown(false)}
      style={{
        fontFamily: "var(--w-display)", fontWeight: 700, letterSpacing: "0.01em",
        border: "2px solid var(--w-ink)", borderRadius: "var(--w-r)",
        cursor: disabled ? "default" : "pointer",
        width: full ? "100%" : undefined,
        boxShadow: press ? "1px 1px 0 var(--w-ink)" : "var(--w-shadow)",
        transform: press ? "translate(3px,3px)" : "none",
        transition: "transform 90ms, box-shadow 90ms",
        whiteSpace: "nowrap",
        opacity: disabled ? 0.45 : 1,
        touchAction: "manipulation",
        ...palettes[variant], ...sizes[size], ...style,
      }}
    >{children}</button>
  );
}

function GhostLink({ onClick, children, style }) {
  return (
    <button onClick={onClick} style={{
      background: "none", border: "none", cursor: "pointer",
      fontFamily: "var(--w-display)", fontWeight: 700, fontSize: 15,
      color: "var(--w-ink)", textDecoration: "underline", textUnderlineOffset: 4,
      padding: 8, minHeight: 44, ...style,
    }}>{children}</button>
  );
}

/* ---------- mono chrome ---------- */

function MonoTag({ children, tone, style }) {
  const t = {
    accent: { background: "var(--w-accent)", color: "#fff", border: "1.5px solid var(--w-ink)" },
    ink: { background: "var(--w-ink)", color: "var(--w-paper)", border: "1.5px solid var(--w-ink)" },
    plain: { background: "transparent", color: "var(--w-ink-soft)", border: "1.5px solid var(--w-line)" },
  }[tone || "plain"];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      fontFamily: "var(--w-mono)", fontSize: 11, fontWeight: 700,
      textTransform: "uppercase", letterSpacing: "0.08em",
      borderRadius: 999, padding: "4px 11px", whiteSpace: "nowrap", ...t, ...style,
    }}>{children}</span>
  );
}

function MonoLine({ children, style }) {
  return (
    <div style={{
      fontFamily: "var(--w-mono)", fontSize: 11.5, letterSpacing: "0.06em",
      textTransform: "uppercase", color: "var(--w-ink-soft)", ...style,
    }}>{children}</div>
  );
}

function DemoTag({ onClick, children }) {
  return (
    <button onClick={onClick} style={{
      background: "transparent", border: "1.5px dashed var(--w-ink-soft)", borderRadius: 8,
      fontFamily: "var(--w-mono)", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em",
      textTransform: "uppercase", color: "var(--w-ink-soft)", cursor: "pointer",
      padding: "6px 10px", minHeight: 32,
    }}>▸ {children}</button>
  );
}

/* ---------- venue mark (rubber-stamp logo) ---------- */

function VenueMark({ initials = "OC", caption = "OLD CROWN", size = 72, color = "var(--w-accent)", angle = -8 }) {
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
        {size >= 58 && <div style={{ fontFamily: "var(--w-mono)", fontSize: Math.max(6.5, size * 0.082), letterSpacing: "0.02em", marginTop: 3, maxWidth: size * 0.74, overflow: "hidden", whiteSpace: "nowrap", margin: "3px auto 0" }}>{caption}</div>}
      </div>
    </div>
  );
}

/* ---------- receipt card ---------- */

function ReceiptCard({ children, style, shaking, mo = 1 }) {
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
  );
}

function ReceiptRule({ style }) {
  return <div style={{ borderTop: "2px dashed var(--w-line)", margin: "14px 0", ...style }}></div>;
}

/* ---------- celebration bits ---------- */

function CelebrationBits({ type = "Slam", mo = 1, seed = 1 }) {
  const bits = useMemo(() => {
    const rnd = (i, s) => {
      const x = Math.sin(seed * 997 + i * 131 + s * 17) * 10000;
      return x - Math.floor(x);
    };
    const splats = Array.from({ length: 7 }, (_, i) => ({
      sx: (rnd(i, 1) - 0.5) * 110, sy: (rnd(i, 2) - 0.5) * 110,
      size: 4 + rnd(i, 3) * 7, delay: rnd(i, 4) * 60,
    }));
    const confetti = Array.from({ length: 16 }, (_, i) => ({
      cx: (rnd(i, 5) - 0.5) * 220, cy: -30 - rnd(i, 6) * 160,
      cr: (rnd(i, 7) - 0.5) * 540, w: 5 + rnd(i, 8) * 6, h: 8 + rnd(i, 9) * 8,
      color: ["var(--w-accent)", "var(--w-ink)", "var(--w-cobalt)", "var(--w-sun)"][i % 4],
      delay: rnd(i, 10) * 110,
    }));
    return { splats, confetti };
  }, [seed]);

  const center = { position: "absolute", left: "50%", top: "50%" };
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "visible" }}>
      {(type === "Ripple") && [0, 1].map((i) => (
        <div key={"r" + i} style={{
          ...center, width: 70, height: 70, marginLeft: -35, marginTop: -35,
          border: "3px solid var(--w-accent)", borderRadius: "50%",
          animation: `w-ripple ${(620 + i * 200) * mo}ms ${i * 120 * mo}ms cubic-bezier(0.2,0,0,1) forwards`,
          opacity: 0,
        }}></div>
      ))}
      {(type === "Slam" || type === "Burst") && bits.splats.map((s, i) => (
        <div key={"s" + i} style={{
          ...center, width: s.size, height: s.size, marginLeft: -s.size / 2, marginTop: -s.size / 2,
          background: "var(--w-accent)", borderRadius: "50%",
          "--sx": s.sx + "px", "--sy": s.sy + "px",
          animation: `w-splat ${480 * mo}ms ${s.delay * mo}ms cubic-bezier(0.2,0,0,1) forwards`,
          opacity: 0,
        }}></div>
      ))}
      {type === "Burst" && bits.confetti.map((c, i) => (
        <div key={"c" + i} style={{
          ...center, width: c.w, height: c.h, marginLeft: -c.w / 2, marginTop: -c.h / 2,
          background: c.color, border: "1px solid var(--w-ink)",
          "--cx": c.cx + "px", "--cy": c.cy + "px", "--cr": c.cr + "deg",
          animation: `w-confetti ${900 * mo}ms ${c.delay * mo}ms cubic-bezier(0.2,0,0,1) forwards`,
          opacity: 0,
        }}></div>
      ))}
    </div>
  );
}

/* ---------- stamps ---------- */

function StampDisc({ filled, index, slammed, celebration = "Slam", mo = 1, size = 64, date }) {
  const anim = slammed
    ? (celebration === "Ripple"
      ? `w-soft-stamp ${340 * mo}ms cubic-bezier(0.2,0,0,1) both`
      : `w-slam ${380 * mo}ms cubic-bezier(0.16,1.2,0.3,1) both`)
    : "none";
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      {filled ? (
        <div style={{
          width: size, height: size, borderRadius: "50%",
          background: "var(--w-accent)", color: "#fff",
          border: "2px solid var(--w-ink)",
          display: "grid", placeItems: "center",
          transform: "rotate(-6deg)", animation: anim,
          position: "relative",
        }}>
          <div style={{ position: "absolute", inset: 5, border: "1.5px dashed rgba(255,255,255,0.65)", borderRadius: "50%" }}></div>
          <div style={{ textAlign: "center", lineHeight: 1 }}>
            <div style={{ fontSize: size * 0.4, fontWeight: 800, fontFamily: "var(--w-display)" }}>✱</div>
            <div style={{ fontFamily: "var(--w-mono)", fontSize: Math.max(7, size * 0.11), letterSpacing: "0.04em", marginTop: 1 }}>{date || "12 JUN"}</div>
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
  );
}

function StampRow({ current, total, slamIndex = -1, celebration, mo, size = 64, dates = [] }) {
  return (
    <div style={{ display: "flex", gap: 14, justifyContent: "center" }}>
      {Array.from({ length: total }, (_, i) => (
        <StampDisc key={i} index={i} filled={i < current} slammed={i === slamIndex}
          celebration={celebration} mo={mo} size={size} date={dates[i]} />
      ))}
    </div>
  );
}

function ProgressLine({ current, total, label = "Visits" }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7 }}>
        <MonoLine>{label}</MonoLine>
        <span style={{ fontFamily: "var(--w-mono)", fontSize: 13, fontWeight: 700 }}>{current}/{total}</span>
      </div>
      <div style={{ height: 12, border: "2px solid var(--w-ink)", borderRadius: 999, background: "var(--w-card)", overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${(current / total) * 100}%`,
          background: "var(--w-accent)",
          borderRight: current > 0 && current < total ? "2px solid var(--w-ink)" : "none",
          transition: "width 500ms cubic-bezier(0.2,0,0,1)",
        }}></div>
      </div>
    </div>
  );
}

/* ---------- staff PIN pad ---------- */

function PinPad({ onDone, label = "Staff PIN", sublabel = "Use the paired counter station" }) {
  const [digits, setDigits] = useState("");
  useEffect(() => {
    if (digits.length === 4) {
      const t = setTimeout(() => onDone && onDone(digits), 320);
      return () => clearTimeout(t);
    }
  }, [digits]);
  const key = (k) => {
    if (k === "⌫") setDigits((d) => d.slice(0, -1));
    else if (digits.length < 4) setDigits((d) => d + k);
  };
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];
  return (
    <div style={{ textAlign: "center" }}>
      <MonoLine style={{ color: "var(--w-ink)", fontWeight: 700 }}>{label}</MonoLine>
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
              onPointerDown={(e) => { e.currentTarget.style.transform = "translate(2px,2px)"; e.currentTarget.style.boxShadow = "1px 1px 0 var(--w-ink)"; }}
              onPointerUp={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "var(--w-shadow-sm)"; }}
              onPointerLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "var(--w-shadow-sm)"; }}
            >{k}</button>
          )
        )}
      </div>
      <MonoLine style={{ marginTop: 16, fontSize: 10 }}>Any 4 digits work in this prototype</MonoLine>
    </div>
  );
}

/* ---------- OTP boxes ---------- */

function OtpBoxes({ length = 6, value, onChange }) {
  const ref = useRef(null);
  return (
    <div style={{ position: "relative", display: "flex", gap: 8, justifyContent: "center", cursor: "text" }}
      onClick={() => ref.current && ref.current.focus()}>
      <input ref={ref} value={value} inputMode="numeric" autoComplete="one-time-code"
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, length))}
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
  );
}

/* ---------- bottom sheet ---------- */

function Sheet({ open, onClose, children, mo = 1 }) {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(33,28,22,0.5)" }}></div>
      <div style={{
        position: "absolute", left: "50%", bottom: 0, transform: "translateX(-50%)",
        width: "100%", maxWidth: 430,
        background: "var(--w-paper)", borderTop: "2px solid var(--w-ink)",
        borderLeft: "2px solid var(--w-ink)", borderRight: "2px solid var(--w-ink)",
        borderRadius: "18px 18px 0 0", padding: "14px 22px 30px",
        animation: `w-sheet-up ${320 * mo}ms cubic-bezier(0.2,0,0,1)`,
      }}>
        <div style={{ width: 44, height: 5, borderRadius: 999, background: "var(--w-line)", margin: "0 auto 16px" }}></div>
        {children}
      </div>
    </div>
  );
}

/* ---------- mystery seal ---------- */

function Seal({ mode = "Hold", onBroken, mo = 1, size = 104 }) {
  const [progress, setProgress] = useState(0);
  const [breaking, setBreaking] = useState(false);
  const timer = useRef(null);

  const finish = () => {
    setBreaking(true);
    setTimeout(() => onBroken && onBroken(), 360 * mo);
  };
  const start = () => {
    if (mode === "Tap") { finish(); return; }
    const t0 = Date.now();
    timer.current = setInterval(() => {
      const p = Math.min(1, (Date.now() - t0) / (850 * mo));
      setProgress(p);
      if (p >= 1) { clearInterval(timer.current); finish(); }
    }, 24);
  };
  const stop = () => {
    if (mode === "Tap") return;
    clearInterval(timer.current);
    if (!breaking) setProgress(0);
  };
  useEffect(() => () => clearInterval(timer.current), []);

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
      <MonoLine style={{ marginTop: 14 }}>{mode === "Hold" ? "Press & hold to break the seal" : "Tap to break the seal"}</MonoLine>
    </div>
  );
}

/* ---------- GPS check-in (alternative to staff PIN) ---------- */

function GpsCheck({ onDone, venue = "The Old Crown", mo = 1 }) {
  const [phase, setPhase] = useState("locating");
  useEffect(() => {
    const a = setTimeout(() => setPhase("found"), 1600 * mo);
    const b = setTimeout(() => onDone && onDone(), 2500 * mo);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);
  return (
    <div style={{ textAlign: "center", padding: "6px 0 10px" }}>
      <MonoLine style={{ color: "var(--w-ink)", fontWeight: 700 }}>
        {phase === "locating" ? "Checking you're at the venue" : "You're here"}
      </MonoLine>
      <div style={{ position: "relative", width: 150, height: 150, margin: "22px auto" }}>
        {phase === "locating" && [0, 1, 2].map((i) => (
          <div key={i} style={{
            position: "absolute", left: "50%", top: "50%",
            width: 70, height: 70, marginLeft: -35, marginTop: -35,
            border: "2.5px solid var(--w-cobalt)", borderRadius: "50%",
            animation: `w-ripple ${1500 * mo}ms ${i * 450 * mo}ms cubic-bezier(0.2,0,0,1) infinite`,
            opacity: 0,
          }}></div>
        ))}
        <div style={{
          position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)",
          animation: phase === "found" ? `w-pop ${360 * mo}ms cubic-bezier(0.16,1.2,0.3,1) both` : "none",
        }}>
          {phase === "locating" ? (
            <div style={{
              width: 22, height: 22, borderRadius: "50%",
              background: "var(--w-cobalt)", border: "2px solid var(--w-ink)",
            }}></div>
          ) : (
            <VenueMark size={92} initials="✓" caption="12 M AWAY" color="var(--w-leaf)" angle={-6} />
          )}
        </div>
      </div>
      <div style={{ fontSize: 14, color: "var(--w-ink-soft)", fontFamily: "var(--w-display)" }}>
        {phase === "locating" ? `Looking for ${venue}…` : `${venue} confirmed — stamping your card.`}
      </div>
      <MonoLine style={{ marginTop: 16, fontSize: 10 }}>One stamp per day · location simulated in this prototype</MonoLine>
    </div>
  );
}

/* ---------- exports ---------- */
Object.assign(window, {
  InkButton, GhostLink, MonoTag, MonoLine, DemoTag, VenueMark,
  ReceiptCard, ReceiptRule, CelebrationBits, StampDisc, StampRow,
  ProgressLine, PinPad, OtpBoxes, Sheet, Seal, GpsCheck,
});
