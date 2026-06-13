/* @ds-bundle: {"format":3,"namespace":"NabaperksDesignSystemHoneyInk_4fb4ef","components":[{"name":"GhostLink","sourcePath":"components/core/GhostLink.jsx"},{"name":"InkButton","sourcePath":"components/core/InkButton.jsx"},{"name":"MonoTag","sourcePath":"components/core/MonoTag.jsx"},{"name":"MonoLine","sourcePath":"components/core/MonoTag.jsx"},{"name":"OtpBoxes","sourcePath":"components/forms/OtpBoxes.jsx"},{"name":"PinPad","sourcePath":"components/forms/PinPad.jsx"},{"name":"CelebrationBits","sourcePath":"components/loyalty/CelebrationBits.jsx"},{"name":"ProgressLine","sourcePath":"components/loyalty/ProgressLine.jsx"},{"name":"Seal","sourcePath":"components/loyalty/Seal.jsx"},{"name":"StampDisc","sourcePath":"components/loyalty/StampRow.jsx"},{"name":"StampRow","sourcePath":"components/loyalty/StampRow.jsx"},{"name":"VenueMark","sourcePath":"components/loyalty/VenueMark.jsx"},{"name":"ReceiptCard","sourcePath":"components/surfaces/ReceiptCard.jsx"},{"name":"ReceiptRule","sourcePath":"components/surfaces/ReceiptCard.jsx"},{"name":"Sheet","sourcePath":"components/surfaces/Sheet.jsx"}],"sourceHashes":{"components/core/GhostLink.jsx":"a4b138bfbffa","components/core/InkButton.jsx":"522537cc6ef1","components/core/MonoTag.jsx":"8678cbc32f81","components/forms/OtpBoxes.jsx":"6441168e00e7","components/forms/PinPad.jsx":"bd47e3b683f8","components/loyalty/CelebrationBits.jsx":"29d7b5526670","components/loyalty/ProgressLine.jsx":"3b42b5e49401","components/loyalty/Seal.jsx":"612396219a43","components/loyalty/StampRow.jsx":"16fd0d3fd4fa","components/loyalty/VenueMark.jsx":"db26c94354a2","components/surfaces/ReceiptCard.jsx":"afd9a6dfdf9e","components/surfaces/Sheet.jsx":"d9acd239fa21","v2/app.jsx":"303156a391a1","v2/customer.jsx":"e8ae5abd8f9b","v2/marketing.jsx":"5c2b8c08ad1c","v2/merchant.jsx":"46b990ae0905","v2/shared.jsx":"2eed19c3ca02","v2/tweaks-panel.jsx":"6591467622ed"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.NabaperksDesignSystemHoneyInk_4fb4ef = window.NabaperksDesignSystemHoneyInk_4fb4ef || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/GhostLink.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Underlined text action for tertiary choices ("Maybe later", "Skip for now").
 */
function GhostLink({
  onClick,
  children,
  style,
  ...props
}) {
  return /*#__PURE__*/React.createElement("button", _extends({
    onClick: onClick,
    style: {
      background: "none",
      border: "none",
      cursor: "pointer",
      fontFamily: "var(--w-display)",
      fontWeight: 700,
      fontSize: 15,
      color: "var(--w-ink)",
      textDecoration: "underline",
      textUnderlineOffset: 4,
      padding: 8,
      minHeight: 44,
      ...style
    }
  }, props), children);
}
Object.assign(__ds_scope, { GhostLink });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/GhostLink.jsx", error: String((e && e.message) || e) }); }

// components/core/InkButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const PALETTES = {
  primary: {
    background: "var(--w-accent)",
    color: "var(--w-accent-ink)"
  },
  dark: {
    background: "var(--w-ink)",
    color: "var(--w-paper)"
  },
  outline: {
    background: "var(--w-card)",
    color: "var(--w-ink)"
  }
};
const SIZES = {
  lg: {
    padding: "15px 24px",
    fontSize: 17,
    minHeight: 54
  },
  md: {
    padding: "11px 18px",
    fontSize: 15,
    minHeight: 46
  },
  sm: {
    padding: "7px 14px",
    fontSize: 13.5,
    minHeight: 38
  }
};

/**
 * Wet Ink action control: 2px ink border, hard offset shadow that
 * collapses into the paper on press (translate 3px + shadow 1px).
 */
function InkButton({
  variant = "primary",
  size = "lg",
  full,
  onClick,
  children,
  style,
  disabled,
  ...props
}) {
  const [down, setDown] = React.useState(false);
  const press = down && !disabled;
  return /*#__PURE__*/React.createElement("button", _extends({
    onClick: disabled ? undefined : onClick,
    onPointerDown: () => setDown(true),
    onPointerUp: () => setDown(false),
    onPointerLeave: () => setDown(false),
    style: {
      fontFamily: "var(--w-display)",
      fontWeight: 700,
      letterSpacing: "0.01em",
      border: "2px solid var(--w-ink)",
      borderRadius: "var(--w-r)",
      cursor: disabled ? "default" : "pointer",
      width: full ? "100%" : undefined,
      boxShadow: press ? "var(--w-shadow-pressed)" : "var(--w-shadow)",
      transform: press ? "translate(3px,3px)" : "none",
      transition: "transform var(--w-dur-press), box-shadow var(--w-dur-press)",
      opacity: disabled ? 0.45 : 1,
      whiteSpace: "nowrap",
      touchAction: "manipulation",
      ...(PALETTES[variant] || PALETTES.primary),
      ...(SIZES[size] || SIZES.lg),
      ...style
    }
  }, props), children);
}
Object.assign(__ds_scope, { InkButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/InkButton.jsx", error: String((e && e.message) || e) }); }

// components/core/MonoTag.jsx
try { (() => {
const TONES = {
  accent: {
    background: "var(--w-accent)",
    color: "var(--w-accent-ink)",
    border: "1.5px solid var(--w-ink)"
  },
  ink: {
    background: "var(--w-ink)",
    color: "var(--w-paper)",
    border: "1.5px solid var(--w-ink)"
  },
  plain: {
    background: "transparent",
    color: "var(--w-ink-soft)",
    border: "1.5px solid var(--w-line)"
  }
};

/**
 * Mono pill tag — status chips & kickers ("STAMPED", "Browser first").
 */
function MonoTag({
  children,
  tone = "plain",
  style
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      fontFamily: "var(--w-mono)",
      fontSize: 11,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      borderRadius: 999,
      padding: "4px 11px",
      whiteSpace: "nowrap",
      ...(TONES[tone] || TONES.plain),
      ...style
    }
  }, children);
}

/**
 * Mono meta line — eyebrows, receipt metadata, footnotes.
 */
function MonoLine({
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--w-mono)",
      fontSize: "var(--text-mono-meta)",
      letterSpacing: "0.06em",
      textTransform: "uppercase",
      color: "var(--w-ink-soft)",
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { MonoTag, MonoLine });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/MonoTag.jsx", error: String((e && e.message) || e) }); }

// components/forms/OtpBoxes.jsx
try { (() => {
/**
 * 6-digit OTP entry — boxes render the value, a hidden input takes
 * keyboard/paste/autofill (autoComplete="one-time-code").
 */
function OtpBoxes({
  length = 6,
  value = "",
  onChange
}) {
  const ref = React.useRef(null);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      display: "flex",
      gap: 8,
      justifyContent: "center",
      cursor: "text"
    },
    onClick: () => ref.current && ref.current.focus()
  }, /*#__PURE__*/React.createElement("input", {
    ref: ref,
    value: value,
    inputMode: "numeric",
    autoComplete: "one-time-code",
    onChange: e => onChange && onChange(e.target.value.replace(/\D/g, "").slice(0, length)),
    style: {
      position: "absolute",
      inset: 0,
      opacity: 0,
      width: "100%",
      border: "none"
    }
  }), Array.from({
    length
  }, (_, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      width: 44,
      height: 56,
      border: "2px solid var(--w-ink)",
      borderRadius: "var(--w-r)",
      background: "var(--w-card)",
      display: "grid",
      placeItems: "center",
      fontFamily: "var(--w-mono)",
      fontSize: 24,
      fontWeight: 700,
      boxShadow: i === value.length ? "var(--w-shadow-sm)" : "none"
    }
  }, value[i] || "")));
}
Object.assign(__ds_scope, { OtpBoxes });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/OtpBoxes.jsx", error: String((e && e.message) || e) }); }

// components/forms/PinPad.jsx
try { (() => {
/**
 * 4-digit staff session PIN pad for the paired counter station.
 * Auto-submits on the 4th digit.
 */
function PinPad({
  onDone,
  label = "Staff PIN",
  sublabel = "Use the paired counter station",
  note
}) {
  const [digits, setDigits] = React.useState("");
  React.useEffect(() => {
    if (digits.length === 4) {
      const t = setTimeout(() => onDone && onDone(digits), 320);
      return () => clearTimeout(t);
    }
  }, [digits]);
  const key = k => {
    if (k === "⌫") setDigits(d => d.slice(0, -1));else if (digits.length < 4) setDigits(d => d + k);
  };
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];
  const monoLine = {
    fontFamily: "var(--w-mono)",
    fontSize: "var(--text-mono-meta)",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--w-ink-soft)"
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...monoLine,
      color: "var(--w-ink)",
      fontWeight: 700
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13.5,
      color: "var(--w-ink-soft)",
      marginTop: 4,
      fontFamily: "var(--w-display)"
    }
  }, sublabel), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 12,
      justifyContent: "center",
      margin: "18px 0 20px"
    }
  }, [0, 1, 2, 3].map(i => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      width: 16,
      height: 16,
      borderRadius: "50%",
      border: "2px solid var(--w-ink)",
      background: i < digits.length ? "var(--w-accent)" : "transparent",
      transition: "background 120ms"
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: 10,
      maxWidth: 290,
      margin: "0 auto"
    }
  }, keys.map((k, i) => k === "" ? /*#__PURE__*/React.createElement("div", {
    key: i
  }) : /*#__PURE__*/React.createElement("button", {
    key: i,
    onClick: () => key(k),
    style: {
      height: 60,
      border: "2px solid var(--w-ink)",
      borderRadius: "var(--w-r)",
      background: "var(--w-card)",
      fontFamily: "var(--w-mono)",
      fontSize: 22,
      fontWeight: 700,
      cursor: "pointer",
      color: "var(--w-ink)",
      boxShadow: "var(--w-shadow-sm)",
      touchAction: "manipulation"
    },
    onPointerDown: e => {
      e.currentTarget.style.transform = "translate(2px,2px)";
      e.currentTarget.style.boxShadow = "var(--w-shadow-pressed)";
    },
    onPointerUp: e => {
      e.currentTarget.style.transform = "none";
      e.currentTarget.style.boxShadow = "var(--w-shadow-sm)";
    },
    onPointerLeave: e => {
      e.currentTarget.style.transform = "none";
      e.currentTarget.style.boxShadow = "var(--w-shadow-sm)";
    }
  }, k))), note && /*#__PURE__*/React.createElement("div", {
    style: {
      ...monoLine,
      marginTop: 16,
      fontSize: 10
    }
  }, note));
}
Object.assign(__ds_scope, { PinPad });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/PinPad.jsx", error: String((e && e.message) || e) }); }

// components/loyalty/CelebrationBits.jsx
try { (() => {
/**
 * Particle layer for stamp/reward celebrations. Render inside a
 * position:relative cell at the moment of celebration (keyed remount).
 */
function CelebrationBits({
  type = "Slam",
  mo = 1,
  seed = 1
}) {
  const bits = React.useMemo(() => {
    const rnd = (i, s) => {
      const x = Math.sin(seed * 997 + i * 131 + s * 17) * 10000;
      return x - Math.floor(x);
    };
    const splats = Array.from({
      length: 7
    }, (_, i) => ({
      sx: (rnd(i, 1) - 0.5) * 110,
      sy: (rnd(i, 2) - 0.5) * 110,
      size: 4 + rnd(i, 3) * 7,
      delay: rnd(i, 4) * 60
    }));
    const confetti = Array.from({
      length: 16
    }, (_, i) => ({
      cx: (rnd(i, 5) - 0.5) * 220,
      cy: -30 - rnd(i, 6) * 160,
      cr: (rnd(i, 7) - 0.5) * 540,
      w: 5 + rnd(i, 8) * 6,
      h: 8 + rnd(i, 9) * 8,
      color: ["var(--w-accent)", "var(--w-ink)", "var(--w-cobalt)", "var(--w-sun)"][i % 4],
      delay: rnd(i, 10) * 110
    }));
    return {
      splats,
      confetti
    };
  }, [seed]);
  const center = {
    position: "absolute",
    left: "50%",
    top: "50%"
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      overflow: "visible"
    }
  }, type === "Ripple" && [0, 1].map(i => /*#__PURE__*/React.createElement("div", {
    key: "r" + i,
    style: {
      ...center,
      width: 70,
      height: 70,
      marginLeft: -35,
      marginTop: -35,
      border: "3px solid var(--w-accent)",
      borderRadius: "50%",
      animation: `w-ripple ${(620 + i * 200) * mo}ms ${i * 120 * mo}ms var(--w-ease) forwards`,
      opacity: 0
    }
  })), (type === "Slam" || type === "Burst") && bits.splats.map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: "s" + i,
    style: {
      ...center,
      width: s.size,
      height: s.size,
      marginLeft: -s.size / 2,
      marginTop: -s.size / 2,
      background: "var(--w-accent)",
      borderRadius: "50%",
      "--sx": s.sx + "px",
      "--sy": s.sy + "px",
      animation: `w-splat ${480 * mo}ms ${s.delay * mo}ms var(--w-ease) forwards`,
      opacity: 0
    }
  })), type === "Burst" && bits.confetti.map((c, i) => /*#__PURE__*/React.createElement("div", {
    key: "c" + i,
    style: {
      ...center,
      width: c.w,
      height: c.h,
      marginLeft: -c.w / 2,
      marginTop: -c.h / 2,
      background: c.color,
      border: "1px solid var(--w-ink)",
      "--cx": c.cx + "px",
      "--cy": c.cy + "px",
      "--cr": c.cr + "deg",
      animation: `w-confetti ${900 * mo}ms ${c.delay * mo}ms var(--w-ease) forwards`,
      opacity: 0
    }
  })));
}
Object.assign(__ds_scope, { CelebrationBits });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/loyalty/CelebrationBits.jsx", error: String((e && e.message) || e) }); }

// components/loyalty/ProgressLine.jsx
try { (() => {
/**
 * Visits progress: mono label + count over a bordered track with accent fill.
 */
function ProgressLine({
  current = 0,
  total = 3,
  label = "Visits"
}) {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "baseline",
      marginBottom: 7
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--w-mono)",
      fontSize: "var(--text-mono-meta)",
      letterSpacing: "0.06em",
      textTransform: "uppercase",
      color: "var(--w-ink-soft)"
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--w-mono)",
      fontSize: 13,
      fontWeight: 700
    }
  }, current, "/", total)), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 12,
      border: "2px solid var(--w-ink)",
      borderRadius: 999,
      background: "var(--w-card)",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: "100%",
      width: `${Math.min(100, current / total * 100)}%`,
      background: "var(--w-accent)",
      borderRight: current > 0 && current < total ? "2px solid var(--w-ink)" : "none",
      transition: "width 500ms var(--w-ease)"
    }
  })));
}
Object.assign(__ds_scope, { ProgressLine });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/loyalty/ProgressLine.jsx", error: String((e && e.message) || e) }); }

// components/loyalty/Seal.jsx
try { (() => {
/**
 * The mystery reward seal — a gold disc with "?" the customer breaks at
 * 3 visits. `Hold` = press-and-hold ~850ms with a progress ring (default);
 * `Tap` = instant. Calls onBroken after the break animation.
 */
function Seal({
  mode = "Hold",
  onBroken,
  mo = 1,
  size = 104
}) {
  const [progress, setProgress] = React.useState(0);
  const [breaking, setBreaking] = React.useState(false);
  const timer = React.useRef(null);
  const finish = () => {
    setBreaking(true);
    setTimeout(() => onBroken && onBroken(), 360 * mo);
  };
  const start = () => {
    if (mode === "Tap") {
      finish();
      return;
    }
    const t0 = Date.now();
    timer.current = setInterval(() => {
      const p = Math.min(1, (Date.now() - t0) / (850 * mo));
      setProgress(p);
      if (p >= 1) {
        clearInterval(timer.current);
        finish();
      }
    }, 24);
  };
  const stop = () => {
    if (mode === "Tap") return;
    clearInterval(timer.current);
    if (!breaking) setProgress(0);
  };
  React.useEffect(() => () => clearInterval(timer.current), []);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    onPointerDown: start,
    onPointerUp: stop,
    onPointerLeave: stop,
    style: {
      width: size,
      height: size,
      margin: "0 auto",
      position: "relative",
      cursor: "pointer",
      userSelect: "none",
      touchAction: "none",
      animation: breaking ? `w-shake ${300 * mo}ms` : progress > 0 ? `w-wiggle ${420 * mo}ms infinite` : "none"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: -6,
      borderRadius: "50%",
      background: `conic-gradient(var(--w-ink) ${progress * 360}deg, transparent 0deg)`,
      WebkitMask: "radial-gradient(circle, transparent 64%, #000 65%)",
      mask: "radial-gradient(circle, transparent 64%, #000 65%)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      borderRadius: "50%",
      background: "var(--w-sun)",
      border: "2px solid var(--w-ink)",
      boxShadow: "var(--w-shadow-sm)",
      display: "grid",
      placeItems: "center",
      transform: "rotate(-6deg)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 7,
      border: "1.5px dashed rgba(33,28,22,0.5)",
      borderRadius: "50%"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--w-display)",
      fontWeight: 800,
      fontSize: size * 0.42
    }
  }, "?"))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14,
      fontFamily: "var(--w-mono)",
      fontSize: "var(--text-mono-meta)",
      letterSpacing: "0.06em",
      textTransform: "uppercase",
      color: "var(--w-ink-soft)"
    }
  }, mode === "Hold" ? "Press & hold to break the seal" : "Tap to break the seal"));
}
Object.assign(__ds_scope, { Seal });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/loyalty/Seal.jsx", error: String((e && e.message) || e) }); }

// components/loyalty/StampRow.jsx
try { (() => {
/**
 * One rubber-stamp slot. Filled = accent disc rotated -6° with ✱ + date;
 * empty = dashed circle with the visit number. `slammed` plays the landing.
 */
function StampDisc({
  filled,
  index = 0,
  slammed,
  celebration = "Slam",
  mo = 1,
  size = 64,
  date
}) {
  const anim = slammed ? celebration === "Ripple" ? `w-soft-stamp ${340 * mo}ms var(--w-ease) both` : `w-slam ${380 * mo}ms var(--w-ease-slam) both` : "none";
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      width: size,
      height: size
    }
  }, filled ? /*#__PURE__*/React.createElement("div", {
    style: {
      width: size,
      height: size,
      borderRadius: "50%",
      background: "var(--w-accent)",
      color: "var(--w-accent-ink)",
      border: "2px solid var(--w-ink)",
      display: "grid",
      placeItems: "center",
      transform: "rotate(-6deg)",
      animation: anim,
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 5,
      border: "1.5px dashed rgba(255,255,255,0.65)",
      borderRadius: "50%"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      lineHeight: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: size * 0.4,
      fontWeight: 800,
      fontFamily: "var(--w-display)"
    }
  }, "\u2731"), date && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--w-mono)",
      fontSize: Math.max(7, size * 0.11),
      letterSpacing: "0.04em",
      marginTop: 1
    }
  }, date))) : /*#__PURE__*/React.createElement("div", {
    style: {
      width: size,
      height: size,
      borderRadius: "50%",
      border: "2px dashed var(--w-line)",
      display: "grid",
      placeItems: "center",
      color: "var(--w-ink-soft)",
      fontFamily: "var(--w-mono)",
      fontSize: size * 0.26
    }
  }, index + 1), slammed && /*#__PURE__*/React.createElement(__ds_scope.CelebrationBits, {
    type: celebration,
    mo: mo,
    seed: index + 2
  }));
}

/**
 * The stamp card row: filled discs up to `current`, dashed slots to `total`.
 * Pass `slamIndex` for the slot that just landed.
 */
function StampRow({
  current = 0,
  total = 3,
  slamIndex = -1,
  celebration,
  mo,
  size = 64,
  dates = []
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 14,
      justifyContent: "center"
    }
  }, Array.from({
    length: total
  }, (_, i) => /*#__PURE__*/React.createElement(StampDisc, {
    key: i,
    index: i,
    filled: i < current,
    slammed: i === slamIndex,
    celebration: celebration,
    mo: mo,
    size: size,
    date: dates[i]
  })));
}
Object.assign(__ds_scope, { StampDisc, StampRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/loyalty/StampRow.jsx", error: String((e && e.message) || e) }); }

// components/loyalty/VenueMark.jsx
try { (() => {
/**
 * Circular rubber-stamp mark: double ring (solid + dashed), rotated,
 * with big initials/glyph and a tiny mono caption. The venue identity
 * mark, also used for reward (✱) and redeemed (✓) states.
 */
function VenueMark({
  initials = "OC",
  caption = "OLD CROWN",
  size = 72,
  color = "var(--w-accent)",
  angle = -8
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: size,
      height: size,
      borderRadius: "50%",
      flexShrink: 0,
      border: `2.5px solid ${color}`,
      color,
      display: "grid",
      placeItems: "center",
      position: "relative",
      transform: `rotate(${angle}deg)`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 4,
      borderRadius: "50%",
      border: `1.5px dashed ${color}`,
      opacity: 0.75
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      lineHeight: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--w-display)",
      fontWeight: 800,
      fontSize: size * 0.34
    }
  }, initials), size >= 58 && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--w-mono)",
      fontSize: Math.max(6.5, size * 0.082),
      letterSpacing: "0.02em",
      maxWidth: size * 0.74,
      overflow: "hidden",
      whiteSpace: "nowrap",
      margin: "3px auto 0"
    }
  }, caption)));
}
Object.assign(__ds_scope, { VenueMark });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/loyalty/VenueMark.jsx", error: String((e && e.message) || e) }); }

// components/surfaces/ReceiptCard.jsx
try { (() => {
/**
 * The receipt card — Wet Ink's primary surface. White-ish card lifted off
 * the paper with a 2px ink border, hard offset shadow, and a perforated
 * zigzag bottom edge. `shaking` plays the paper-shake (when a stamp lands).
 */
function ReceiptCard({
  children,
  style,
  shaking,
  mo = 1
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      filter: "drop-shadow(var(--w-shadow))",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--w-card)",
      border: "2px solid var(--w-ink)",
      borderBottom: "none",
      borderRadius: "var(--w-r) var(--w-r) 0 0",
      padding: "20px 20px 14px",
      animation: shaking ? `w-shake ${300 * mo}ms cubic-bezier(0.36,0.07,0.19,0.97)` : "none"
    }
  }, children), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 12,
      marginTop: -1,
      background: "linear-gradient(-45deg, transparent 8.5px, var(--w-ink) 8.5px, var(--w-ink) 11px, var(--w-card) 11px) 0 0 / 17px 100%, " + "linear-gradient(45deg, transparent 8.5px, var(--w-ink) 8.5px, var(--w-ink) 11px, var(--w-card) 11px) 0 0 / 17px 100%"
    }
  }));
}

/**
 * Dashed horizontal rule between receipt sections.
 */
function ReceiptRule({
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: "2px dashed var(--w-line)",
      margin: "14px 0",
      ...style
    }
  });
}
Object.assign(__ds_scope, { ReceiptCard, ReceiptRule });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/surfaces/ReceiptCard.jsx", error: String((e && e.message) || e) }); }

// components/surfaces/Sheet.jsx
try { (() => {
/**
 * Bottom sheet — the counter-moment container (staff PIN pad), scrim +
 * paper panel sliding up. Max width 430px, centred.
 */
function Sheet({
  open,
  onClose,
  children,
  mo = 1
}) {
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      zIndex: 60
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: "absolute",
      inset: 0,
      background: "rgba(33,28,22,0.5)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: "50%",
      bottom: 0,
      transform: "translateX(-50%)",
      width: "100%",
      maxWidth: 430,
      background: "var(--w-paper)",
      borderTop: "2px solid var(--w-ink)",
      borderLeft: "2px solid var(--w-ink)",
      borderRight: "2px solid var(--w-ink)",
      borderRadius: "var(--w-r-sheet) var(--w-r-sheet) 0 0",
      padding: "14px 22px 30px",
      animation: `w-sheet-up ${320 * mo}ms var(--w-ease)`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 44,
      height: 5,
      borderRadius: 999,
      background: "var(--w-line)",
      margin: "0 auto 16px"
    }
  }), children));
}
Object.assign(__ds_scope, { Sheet });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/surfaces/Sheet.jsx", error: String((e && e.message) || e) }); }

// v2/app.jsx
try { (() => {
// Nabaperks v2 — app shell: surface switcher + Tweaks wiring
const {
  useState: useStateA,
  useEffect: useEffectA
} = React;
const V2_TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "celebration": "Slam",
  "reveal": "Hold",
  "mo": 1,
  "ink": "#E8430F",
  "grain": true
} /*EDITMODE-END*/;
function V2App() {
  const [t, setTweak] = useTweaks(V2_TWEAK_DEFAULTS);
  const [surface, setSurface] = useStateA(localStorage.getItem("v2_surface") || "Customer");
  useEffectA(() => {
    localStorage.setItem("v2_surface", surface);
  }, [surface]);
  useEffectA(() => {
    document.documentElement.style.setProperty("--w-accent", t.ink);
    document.body.dataset.grain = String(t.grain);
  }, [t.ink, t.grain]);
  const surfaces = ["Customer", "Merchant", "Marketing"];
  return /*#__PURE__*/React.createElement("div", null, surface === "Customer" && /*#__PURE__*/React.createElement(CustomerFlow, {
    t: t
  }), surface === "Merchant" && /*#__PURE__*/React.createElement(MerchantApp, {
    t: t
  }), surface === "Marketing" && /*#__PURE__*/React.createElement(MarketingSite, {
    t: t
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      bottom: 16,
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: 50,
      display: "flex",
      gap: 4,
      background: "var(--w-ink)",
      border: "2px solid var(--w-ink)",
      borderRadius: 999,
      padding: 4,
      boxShadow: "0 6px 24px rgba(33,28,22,0.35)"
    }
  }, surfaces.map(s => /*#__PURE__*/React.createElement("button", {
    key: s,
    onClick: () => setSurface(s),
    style: {
      fontFamily: "var(--w-mono)",
      fontSize: 11.5,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.06em",
      padding: "9px 16px",
      borderRadius: 999,
      border: "none",
      cursor: "pointer",
      background: surface === s ? "var(--w-paper)" : "transparent",
      color: surface === s ? "var(--w-ink)" : "rgba(246,241,230,0.6)"
    }
  }, s))), /*#__PURE__*/React.createElement(TweaksPanel, null, /*#__PURE__*/React.createElement(TweakSection, {
    label: "Celebration"
  }), /*#__PURE__*/React.createElement(TweakRadio, {
    label: "Stamp moment",
    value: t.celebration,
    options: ["Slam", "Ripple", "Burst"],
    onChange: v => setTweak("celebration", v)
  }), /*#__PURE__*/React.createElement(TweakRadio, {
    label: "Seal reveal",
    value: t.reveal,
    options: ["Hold", "Tap"],
    onChange: v => setTweak("reveal", v)
  }), /*#__PURE__*/React.createElement(TweakSlider, {
    label: "Motion scale",
    value: t.mo,
    min: 0.5,
    max: 2,
    step: 0.1,
    onChange: v => setTweak("mo", v)
  }), /*#__PURE__*/React.createElement(TweakSection, {
    label: "Ink"
  }), /*#__PURE__*/React.createElement(TweakColor, {
    label: "Accent ink",
    value: t.ink,
    options: ["#E8430F", "#2B43C8", "#1E8A4C"],
    onChange: v => setTweak("ink", v)
  }), /*#__PURE__*/React.createElement(TweakToggle, {
    label: "Paper grain",
    value: t.grain,
    onChange: v => setTweak("grain", v)
  })));
}
ReactDOM.createRoot(document.getElementById("root")).render(/*#__PURE__*/React.createElement(V2App, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "v2/app.jsx", error: String((e && e.message) || e) }); }

// v2/customer.jsx
try { (() => {
// Nabaperks v2 — Customer journey (the star of the redesign)
// scan → value first → stamp at the counter → THEN save the card → mystery reveal
const {
  useState: useStateC,
  useEffect: useEffectC
} = React;
const C_LS_KEY = "v2_customer_state_v1";
function loadCState() {
  try {
    return JSON.parse(localStorage.getItem(C_LS_KEY)) || null;
  } catch (e) {
    return null;
  }
}
function CustomerFlow({
  t,
  fixedStep
}) {
  const init = fixedStep ? {
    step: fixedStep,
    visits: fixedStep === "card" ? 2 : 0,
    saved: true,
    dayReady: false
  } : loadCState() || {
    step: "landing",
    visits: 0,
    saved: false,
    dayReady: false
  };
  const [step, setStep] = useStateC(init.step);
  const [visits, setVisits] = useStateC(init.visits);
  const [saved, setSaved] = useStateC(init.saved);
  const [dayReady, setDayReady] = useStateC(init.dayReady);
  const [pinOpen, setPinOpen] = useStateC(false);
  const [pinPurpose, setPinPurpose] = useStateC("stamp"); // stamp | redeem
  const [slam, setSlam] = useStateC(-1);
  const [shake, setShake] = useStateC(false);
  const [phone, setPhone] = useStateC("");
  const [otp, setOtp] = useStateC("");
  useEffectC(() => {
    if (fixedStep) return;
    localStorage.setItem(C_LS_KEY, JSON.stringify({
      step,
      visits,
      saved,
      dayReady
    }));
  }, [step, visits, saved, dayReady]);
  const mo = t.mo;
  const doStamp = () => {
    setPinOpen(false);
    const next = visits + 1;
    setVisits(next);
    setSlam(next - 1);
    setShake(true);
    setTimeout(() => setShake(false), 360 * mo);
    setTimeout(() => setSlam(-1), 1400 * mo);
    if (step === "landing") setTimeout(() => setStep("firstStamp"), 950 * mo);
    if (next >= 3) setTimeout(() => setStep("sealed"), 1100 * mo);
  };
  const doRedeem = () => {
    setPinOpen(false);
    setStep("redeemed");
  };
  const reset = () => {
    localStorage.removeItem(C_LS_KEY);
    setStep("landing");
    setVisits(0);
    setSaved(false);
    setDayReady(false);
    setPhone("");
    setOtp("");
    setSlam(-1);
  };
  const dates = ["TODAY", "TODAY", "TODAY"];

  /* ---------- shared receipt body ---------- */
  const cardBody = extra => /*#__PURE__*/React.createElement(ReceiptCard, {
    shaking: shake,
    mo: mo
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(MonoLine, null, "The Old Crown \xB7 Bristol"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 800,
      fontSize: 21,
      lineHeight: 1.12,
      marginTop: 5
    }
  }, "Free hot drink after 3 visits")), /*#__PURE__*/React.createElement(VenueMark, {
    size: 62
  })), /*#__PURE__*/React.createElement(ReceiptRule, null), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      padding: "8px 0 4px"
    }
  }, /*#__PURE__*/React.createElement(StampRow, {
    current: visits,
    total: 3,
    slamIndex: slam,
    celebration: t.celebration,
    mo: mo,
    dates: dates
  })), /*#__PURE__*/React.createElement(ReceiptRule, null), /*#__PURE__*/React.createElement(ProgressLine, {
    current: visits,
    total: 3
  }), extra, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement(MonoLine, {
    style: {
      fontSize: 10
    }
  }, "CARD N\xBA OC-0248"), /*#__PURE__*/React.createElement(MonoLine, {
    style: {
      fontSize: 10
    }
  }, saved ? "SAVED TO 07123···89" : "UNSAVED · THIS BROWSER")));

  /* ---------- steps ---------- */

  let body = null;
  if (step === "landing") {
    body = /*#__PURE__*/React.createElement("div", {
      style: {
        animation: `w-rise ${380 * mo}ms cubic-bezier(0.2,0,0,1) both`
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: "center",
        margin: "6px 0 22px"
      }
    }, /*#__PURE__*/React.createElement(MonoTag, null, "Scanned at the counter"), /*#__PURE__*/React.createElement("h1", {
      style: {
        fontSize: 34,
        fontWeight: 800,
        lineHeight: 1.05,
        margin: "16px 0 10px"
      }
    }, "Your first stamp is waiting."), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 15.5,
        lineHeight: "23px",
        color: "var(--w-ink-soft)",
        margin: "0 auto",
        maxWidth: "30ch"
      }
    }, "The Old Crown stamps this card every visit. Three visits unseal a mystery reward. No app \u2014 it lives right here.")), cardBody(null), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 22,
        display: "grid",
        gap: 10
      }
    }, /*#__PURE__*/React.createElement(InkButton, {
      full: true,
      onClick: () => {
        setPinPurpose("stamp");
        setPinOpen(true);
      }
    }, "Collect my first stamp"), /*#__PURE__*/React.createElement(MonoLine, {
      style: {
        textAlign: "center",
        fontSize: 10
      }
    }, "No signup yet \xB7 takes ten seconds")));
  }
  if (step === "firstStamp") {
    body = /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: "center",
        margin: "6px 0 22px",
        animation: `w-rise ${380 * mo}ms both`
      }
    }, /*#__PURE__*/React.createElement(MonoTag, {
      tone: "accent"
    }, "Stamped"), /*#__PURE__*/React.createElement("h1", {
      style: {
        fontSize: 34,
        fontWeight: 800,
        lineHeight: 1.05,
        margin: "16px 0 10px"
      }
    }, "That's one."), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 15.5,
        lineHeight: "23px",
        color: "var(--w-ink-soft)",
        margin: "0 auto",
        maxWidth: "28ch"
      }
    }, "Two more visits and the seal breaks. Keep the card so it survives a closed tab.")), cardBody(null), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 22,
        display: "grid",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(InkButton, {
      full: true,
      onClick: () => setStep("save")
    }, "Keep my card"), /*#__PURE__*/React.createElement(GhostLink, {
      onClick: () => setStep("card")
    }, "Maybe later")));
  }
  if (step === "save") {
    body = /*#__PURE__*/React.createElement("div", {
      style: {
        animation: `w-rise ${380 * mo}ms both`
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: "center",
        margin: "6px 0 24px"
      }
    }, /*#__PURE__*/React.createElement("h1", {
      style: {
        fontSize: 30,
        fontWeight: 800,
        lineHeight: 1.08,
        margin: "10px 0"
      }
    }, "Keep your card"), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 15,
        lineHeight: "22px",
        color: "var(--w-ink-soft)",
        margin: "0 auto",
        maxWidth: "30ch"
      }
    }, "One text, no password. Your stamp is already on the card.")), /*#__PURE__*/React.createElement(ReceiptCard, {
      mo: mo
    }, /*#__PURE__*/React.createElement(MonoLine, {
      style: {
        marginBottom: 8
      }
    }, "Mobile number"), /*#__PURE__*/React.createElement("input", {
      value: phone,
      inputMode: "tel",
      placeholder: "07123 456789",
      onChange: e => setPhone(e.target.value),
      style: {
        width: "100%",
        padding: "14px 16px",
        fontSize: 18,
        fontFamily: "var(--w-mono)",
        color: "var(--w-ink)",
        background: "var(--w-paper)",
        border: "2px solid var(--w-ink)",
        borderRadius: "var(--w-r)",
        outline: "none"
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 14
      }
    }, /*#__PURE__*/React.createElement(InkButton, {
      full: true,
      onClick: () => setStep("otp")
    }, "Text me the code"))), /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: "center",
        marginTop: 12
      }
    }, /*#__PURE__*/React.createElement(GhostLink, {
      onClick: () => setStep("card")
    }, "Skip for now")));
  }
  if (step === "otp") {
    const done = otp.length === 6;
    body = /*#__PURE__*/React.createElement("div", {
      style: {
        animation: `w-rise ${380 * mo}ms both`
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: "center",
        margin: "6px 0 24px"
      }
    }, /*#__PURE__*/React.createElement("h1", {
      style: {
        fontSize: 30,
        fontWeight: 800,
        margin: "10px 0"
      }
    }, "Enter the code"), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 15,
        color: "var(--w-ink-soft)",
        margin: 0
      }
    }, "Sent to ", phone || "07123 456789", " \xB7 expires in 10 min")), /*#__PURE__*/React.createElement(OtpBoxes, {
      value: otp,
      onChange: setOtp
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gap: 10,
        marginTop: 24
      }
    }, /*#__PURE__*/React.createElement(InkButton, {
      full: true,
      disabled: !done,
      onClick: () => {
        setSaved(true);
        setStep("card");
      }
    }, "Save my card"), /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: "center"
      }
    }, /*#__PURE__*/React.createElement(DemoTag, {
      onClick: () => setOtp("482915")
    }, "Autofill code"))));
  }
  if (step === "card") {
    body = /*#__PURE__*/React.createElement("div", {
      style: {
        animation: `w-rise ${380 * mo}ms both`
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        margin: "4px 0 18px"
      }
    }, /*#__PURE__*/React.createElement("h1", {
      style: {
        fontSize: 26,
        fontWeight: 800,
        margin: 0
      }
    }, "Your card"), /*#__PURE__*/React.createElement(MonoTag, {
      tone: saved ? "ink" : "plain"
    }, saved ? "Saved" : "Unsaved")), cardBody(/*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 14,
        padding: "12px 14px",
        borderRadius: "var(--w-r)",
        border: "2px dashed var(--w-line)",
        display: "flex",
        gap: 12,
        alignItems: "center"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 40,
        height: 40,
        borderRadius: "50%",
        background: "var(--w-sun)",
        border: "2px solid var(--w-ink)",
        display: "grid",
        placeItems: "center",
        fontWeight: 800,
        fontSize: 19,
        transform: "rotate(-6deg)",
        flexShrink: 0
      }
    }, "?"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontWeight: 700,
        fontSize: 14.5
      }
    }, "Mystery reward, sealed"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: "var(--w-ink-soft)"
      }
    }, 3 - visits, " more ", 3 - visits === 1 ? "visit" : "visits", " to break it open.")))), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 22,
        display: "grid",
        gap: 10
      }
    }, /*#__PURE__*/React.createElement(InkButton, {
      full: true,
      variant: "dark",
      onClick: () => {
        setPinPurpose("stamp");
        setPinOpen(true);
      }
    }, "I'm at the counter \u2014 stamp it"), !saved && /*#__PURE__*/React.createElement(GhostLink, {
      onClick: () => setStep("save")
    }, "Save this card")));
  }
  if (step === "sealed") {
    body = /*#__PURE__*/React.createElement("div", {
      style: {
        animation: `w-rise ${380 * mo}ms both`
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: "center",
        margin: "6px 0 22px"
      }
    }, /*#__PURE__*/React.createElement(MonoTag, {
      tone: "accent"
    }, "Three visits"), /*#__PURE__*/React.createElement("h1", {
      style: {
        fontSize: 32,
        fontWeight: 800,
        lineHeight: 1.06,
        margin: "16px 0 8px"
      }
    }, "Something's under there."), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 15,
        color: "var(--w-ink-soft)",
        margin: 0
      }
    }, "You've earned the mystery reward.")), /*#__PURE__*/React.createElement(ReceiptCard, {
      mo: mo
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        padding: "16px 0 10px"
      }
    }, /*#__PURE__*/React.createElement(Seal, {
      mode: t.reveal,
      mo: mo,
      onBroken: () => setStep("revealed")
    }))));
  }
  if (step === "revealed" || step === "ready") {
    const isReady = step === "ready" || dayReady;
    body = /*#__PURE__*/React.createElement("div", {
      style: {
        animation: `w-pop ${420 * mo}ms cubic-bezier(0.16,1.2,0.3,1) both`,
        position: "relative"
      }
    }, step === "revealed" && /*#__PURE__*/React.createElement(CelebrationBits, {
      type: t.celebration === "Ripple" ? "Ripple" : "Burst",
      mo: mo,
      seed: 9
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: "center",
        margin: "6px 0 20px"
      }
    }, /*#__PURE__*/React.createElement(MonoTag, {
      tone: "accent"
    }, "Unsealed"), /*#__PURE__*/React.createElement("h1", {
      style: {
        fontSize: 36,
        fontWeight: 800,
        lineHeight: 1.02,
        margin: "16px 0 8px"
      }
    }, "Free flat white"), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 15,
        color: "var(--w-ink-soft)",
        margin: 0
      }
    }, "From the Old Crown, with thanks.")), /*#__PURE__*/React.createElement(ReceiptCard, {
      mo: mo
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: "center",
        padding: "6px 0"
      }
    }, /*#__PURE__*/React.createElement(VenueMark, {
      size: 84,
      caption: "N\xBA RW-8821",
      initials: "\u2731",
      color: isReady ? "var(--w-leaf)" : "var(--w-ink-soft)"
    }), /*#__PURE__*/React.createElement(ReceiptRule, null), isReady ? /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(MonoTag, {
      tone: "ink"
    }, "Ready to redeem"), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 14,
        color: "var(--w-ink-soft)",
        margin: "12px 0 0"
      }
    }, "Show this at the counter. Staff redeem it once with their PIN.")) : /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(MonoTag, null, "Redeemable from tomorrow"), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 14,
        color: "var(--w-ink-soft)",
        margin: "12px 0 0"
      }
    }, "Give it a day to breathe \u2014 it's yours from opening time tomorrow.")))), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 22,
        display: "grid",
        gap: 10
      }
    }, isReady ? /*#__PURE__*/React.createElement(InkButton, {
      full: true,
      onClick: () => {
        setPinPurpose("redeem");
        setPinOpen(true);
      }
    }, "Staff: redeem this reward") : /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: "center"
      }
    }, /*#__PURE__*/React.createElement(DemoTag, {
      onClick: () => {
        setDayReady(true);
        setStep("ready");
      }
    }, "Skip to tomorrow"))));
  }
  if (step === "redeemed") {
    body = /*#__PURE__*/React.createElement("div", {
      style: {
        animation: `w-pop ${420 * mo}ms both`,
        textAlign: "center"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        margin: "12px 0 20px"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "inline-block",
        animation: `w-slam ${420 * mo}ms cubic-bezier(0.16,1.2,0.3,1) both`
      }
    }, /*#__PURE__*/React.createElement(VenueMark, {
      size: 110,
      initials: "\u2713",
      caption: "12 JUN 2026",
      color: "var(--w-leaf)",
      angle: -6
    }))), /*#__PURE__*/React.createElement("h1", {
      style: {
        fontSize: 32,
        fontWeight: 800,
        margin: "0 0 8px"
      }
    }, "Enjoy."), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 15,
        color: "var(--w-ink-soft)",
        margin: "0 0 26px"
      }
    }, "The card starts again \u2014 same deal, next visit."), /*#__PURE__*/React.createElement(InkButton, {
      full: true,
      variant: "dark",
      onClick: () => {
        setVisits(0);
        setDayReady(false);
        setStep("card");
      }
    }, "Back to my card"));
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 410,
      margin: "0 auto",
      padding: "26px 20px 90px",
      minHeight: "100vh"
    },
    "data-screen-label": "Customer flow"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 22
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 9
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 26,
      height: 26,
      borderRadius: "50%",
      background: "var(--w-accent)",
      border: "2px solid var(--w-ink)",
      display: "inline-grid",
      placeItems: "center",
      color: "#fff",
      fontWeight: 800,
      fontSize: 13,
      transform: "rotate(-6deg)"
    }
  }, "\u2731"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 800,
      fontSize: 16.5,
      letterSpacing: "-0.01em"
    }
  }, "nabaperks")), /*#__PURE__*/React.createElement(DemoTag, {
    onClick: reset
  }, "Restart flow")), body, /*#__PURE__*/React.createElement(Sheet, {
    open: pinOpen,
    onClose: () => setPinOpen(false),
    mo: mo
  }, /*#__PURE__*/React.createElement(PinPad, {
    label: pinPurpose === "stamp" ? "Staff: stamp this card" : "Staff: redeem reward",
    sublabel: "Customer hands the phone across the counter",
    onDone: pinPurpose === "stamp" ? doStamp : doRedeem
  })));
}
window.CustomerFlow = CustomerFlow;
})(); } catch (e) { __ds_ns.__errors.push({ path: "v2/customer.jsx", error: String((e && e.message) || e) }); }

// v2/marketing.jsx
try { (() => {
// Nabaperks v2 — Marketing: a riso poster, not a SaaS page.
function MarketingSite({
  t
}) {
  const marqueeItems = "NO APP · NO PLASTIC · NO PASSWORD · STAMPED IN SECONDS · ";
  return /*#__PURE__*/React.createElement("div", {
    style: {
      paddingBottom: 110
    },
    "data-screen-label": "Marketing site"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--w-ink)",
      color: "var(--w-paper)",
      overflow: "hidden",
      borderBottom: "2px solid var(--w-ink)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      whiteSpace: "nowrap",
      width: "max-content",
      animation: `w-marquee ${22 / t.mo}s linear infinite`,
      fontFamily: "var(--w-mono)",
      fontSize: 12,
      letterSpacing: "0.12em",
      padding: "8px 0"
    }
  }, /*#__PURE__*/React.createElement("span", null, marqueeItems.repeat(6)), /*#__PURE__*/React.createElement("span", null, marqueeItems.repeat(6)))), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1100,
      margin: "0 auto",
      padding: "18px 28px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 30,
      height: 30,
      borderRadius: "50%",
      background: "var(--w-accent)",
      border: "2px solid var(--w-ink)",
      display: "inline-grid",
      placeItems: "center",
      color: "#fff",
      fontWeight: 800,
      fontSize: 15,
      transform: "rotate(-6deg)"
    }
  }, "\u2731"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 800,
      fontSize: 19
    }
  }, "nabaperks")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 12,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement(GhostLink, {
    style: {
      fontSize: 14
    }
  }, "Pricing"), /*#__PURE__*/React.createElement(InkButton, {
    size: "sm",
    variant: "outline"
  }, "Merchant login"), /*#__PURE__*/React.createElement(InkButton, {
    size: "sm"
  }, "Start free"))), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1100,
      margin: "0 auto",
      padding: "44px 28px 30px",
      display: "grid",
      gridTemplateColumns: "1.1fr 0.9fr",
      gap: 50,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(MonoTag, {
    tone: "accent"
  }, "For UK counters"), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: "clamp(44px, 6vw, 76px)",
      fontWeight: 800,
      lineHeight: 0.98,
      letterSpacing: "-0.02em",
      margin: "20px 0 18px"
    }
  }, "Loyalty, stamped before the coffee cools."), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 17,
      lineHeight: "27px",
      color: "var(--w-ink-soft)",
      maxWidth: "36ch",
      margin: "0 0 28px"
    }
  }, "A paper stamp card that lives in the customer's browser. They scan your till QR, you stamp with a PIN, a mystery reward unseals on visit three."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 14,
      flexWrap: "wrap",
      marginBottom: 26
    }
  }, /*#__PURE__*/React.createElement(InkButton, null, "Start a 30-day pilot"), /*#__PURE__*/React.createElement(InkButton, {
    variant: "outline"
  }, "Watch the counter moment")), /*#__PURE__*/React.createElement(MonoLine, null, "\xA329/month after the pilot \xB7 one price, one venue")), /*#__PURE__*/React.createElement("div", {
    style: {
      transform: "rotate(2deg)"
    }
  }, /*#__PURE__*/React.createElement(ReceiptCard, {
    mo: t.mo
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(MonoLine, null, "The Old Crown \xB7 Bristol"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 800,
      fontSize: 20,
      marginTop: 5
    }
  }, "Free hot drink after 3 visits")), /*#__PURE__*/React.createElement(VenueMark, {
    size: 58
  })), /*#__PURE__*/React.createElement(ReceiptRule, null), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "8px 0 4px"
    }
  }, /*#__PURE__*/React.createElement(StampRow, {
    current: 2,
    total: 3,
    celebration: t.celebration,
    mo: t.mo,
    dates: ["3 JUN", "9 JUN"]
  })), /*#__PURE__*/React.createElement(ReceiptRule, null), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement(MonoLine, {
    style: {
      fontSize: 10
    }
  }, "CARD N\xBA OC-0248"), /*#__PURE__*/React.createElement(MonoLine, {
    style: {
      fontSize: 10
    }
  }, "1 VISIT TO THE SEAL"))))), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1100,
      margin: "0 auto",
      padding: "30px 28px 0"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: 18
    }
  }, [{
    n: "01",
    t: "Scan",
    c: "Customers point a camera at your till card. The stamp card opens in the browser — nothing to install."
  }, {
    n: "02",
    t: "Stamp",
    c: "They show a code; staff approve it at the counter station. A rubber stamp slams down. That's the whole transaction."
  }, {
    n: "03",
    t: "Unseal",
    c: "Visit three breaks a wax seal on a mystery reward from your pool. Redeemable from the next day."
  }].map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: s.n,
    style: {
      border: "2px solid var(--w-ink)",
      borderRadius: "var(--w-r)",
      background: i === 1 ? "var(--w-accent)" : "var(--w-card)",
      color: i === 1 ? "#fff" : "var(--w-ink)",
      boxShadow: "var(--w-shadow)",
      padding: "22px 22px 24px",
      transform: `rotate(${i === 1 ? -1 : i === 0 ? 0.6 : 0.8}deg)`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--w-mono)",
      fontSize: 12,
      fontWeight: 700,
      opacity: 0.65
    }
  }, s.n), /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 800,
      fontSize: 26,
      margin: "8px 0 10px"
    }
  }, s.t), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 14.5,
      lineHeight: "22px",
      margin: 0,
      opacity: i === 1 ? 0.95 : 0.7
    }
  }, s.c)))), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      marginTop: 46
    }
  }, /*#__PURE__*/React.createElement(MonoLine, null, "Built for cafes, barbers, bakeries & bars \xB7 UK pilot now open"))));
}
window.MarketingSite = MarketingSite;
})(); } catch (e) { __ds_ns.__errors.push({ path: "v2/marketing.jsx", error: String((e && e.message) || e) }); }

// v2/merchant.jsx
try { (() => {
// Nabaperks v2 — Merchant: a "Today" screen, not a dashboard.
const {
  useState: useStateM
} = React;
function MStat({
  value,
  label,
  tone
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: tone === "accent" ? "var(--w-accent)" : "var(--w-card)",
      color: tone === "accent" ? "#fff" : "var(--w-ink)",
      border: "2px solid var(--w-ink)",
      borderRadius: "var(--w-r)",
      boxShadow: "var(--w-shadow-sm)",
      padding: "16px 18px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--w-display)",
      fontWeight: 800,
      fontSize: 38,
      lineHeight: 1
    }
  }, value), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--w-mono)",
      fontSize: 10.5,
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      marginTop: 8,
      opacity: tone === "accent" ? 0.9 : 0.6
    }
  }, label));
}
function FeedLine({
  time,
  what,
  tone
}) {
  const dot = {
    stamp: "var(--w-accent)",
    reward: "var(--w-sun)",
    join: "var(--w-cobalt)",
    redeem: "var(--w-leaf)"
  }[tone];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "10px 0",
      borderBottom: "2px dashed var(--w-line)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 11,
      height: 11,
      borderRadius: "50%",
      background: dot,
      border: "1.5px solid var(--w-ink)",
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14.5,
      fontWeight: 600,
      flex: 1
    }
  }, what), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--w-mono)",
      fontSize: 11,
      color: "var(--w-ink-soft)"
    }
  }, time));
}
function QrBlock({
  size = 148
}) {
  // deterministic fake QR
  const cells = [];
  for (let y = 0; y < 13; y++) for (let x = 0; x < 13; x++) {
    const v = Math.sin(x * 13.7 + y * 7.3) * 43758.5453;
    if (v - Math.floor(v) > 0.52) cells.push([x, y]);
  }
  const finder = (cx, cy) => /*#__PURE__*/React.createElement("g", {
    key: cx + "-" + cy
  }, /*#__PURE__*/React.createElement("rect", {
    x: cx,
    y: cy,
    width: 3,
    height: 3,
    fill: "none",
    stroke: "#111",
    strokeWidth: 0.55
  }), /*#__PURE__*/React.createElement("rect", {
    x: cx + 1,
    y: cy + 1,
    width: 1,
    height: 1,
    fill: "#111"
  }));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: "#fff",
      border: "2px solid var(--w-ink)",
      borderRadius: "var(--w-r)",
      padding: 12,
      display: "inline-block"
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 13 13"
  }, cells.filter(([x, y]) => !(x < 4 && y < 4 || x > 8 && y < 4 || x < 4 && y > 8)).map(([x, y], i) => /*#__PURE__*/React.createElement("rect", {
    key: i,
    x: x,
    y: y,
    width: 1,
    height: 1,
    fill: "#111"
  })), finder(0, 0), finder(10, 0), finder(0, 10)));
}
function MerchantToday({
  t
}) {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-end",
      marginBottom: 18,
      flexWrap: "wrap",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(MonoLine, null, "Thursday 12 June \xB7 Bristol"), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 34,
      fontWeight: 800,
      margin: "6px 0 0"
    }
  }, "Today at the counter")), /*#__PURE__*/React.createElement(MonoTag, {
    tone: "ink"
  }, "Pilot \xB7 day 23 of 30")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
      gap: 14,
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement(MStat, {
    value: "14",
    label: "Stamps today",
    tone: "accent"
  }), /*#__PURE__*/React.createElement(MStat, {
    value: "3",
    label: "Rewards ready"
  }), /*#__PURE__*/React.createElement(MStat, {
    value: "5",
    label: "New members"
  }), /*#__PURE__*/React.createElement(MStat, {
    value: "41%",
    label: "Come back twice"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1.5fr 1fr",
      gap: 18,
      alignItems: "start"
    }
  }, /*#__PURE__*/React.createElement(ReceiptCard, {
    mo: t.mo
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 800,
      fontSize: 18
    }
  }, "Live from the till"), /*#__PURE__*/React.createElement(MonoTag, null, "Auto-refreshing")), /*#__PURE__*/React.createElement(ReceiptRule, null), /*#__PURE__*/React.createElement(FeedLine, {
    time: "11:02",
    what: "Tom R. unsealed a mystery reward",
    tone: "reward"
  }), /*#__PURE__*/React.createElement(FeedLine, {
    time: "10:48",
    what: "Asha K. \u2014 stamp 2 of 3",
    tone: "stamp"
  }), /*#__PURE__*/React.createElement(FeedLine, {
    time: "10:31",
    what: "New member joined from the till QR",
    tone: "join"
  }), /*#__PURE__*/React.createElement(FeedLine, {
    time: "09:14",
    what: "Priya S. \u2014 stamp 1 of 3",
    tone: "stamp"
  }), /*#__PURE__*/React.createElement(FeedLine, {
    time: "09:02",
    what: "Dan W. redeemed: free flat white",
    tone: "redeem"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement(MonoLine, {
    style: {
      fontSize: 10
    }
  }, "Weekly digest lands Monday 08:00 \u2014 analytics live there, not here."))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 18
    }
  }, /*#__PURE__*/React.createElement(ReceiptCard, {
    mo: t.mo
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 800,
      fontSize: 18,
      marginBottom: 4
    }
  }, "Your till QR"), /*#__PURE__*/React.createElement(MonoLine, {
    style: {
      marginBottom: 14
    }
  }, "One permanent code"), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement(QrBlock, null)), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement(InkButton, {
    full: true,
    size: "sm",
    variant: "outline"
  }, "Reprint poster & till card"))), /*#__PURE__*/React.createElement(ReceiptCard, {
    mo: t.mo
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 800,
      fontSize: 18
    }
  }, "Staff PIN"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--w-mono)",
      fontSize: 30,
      fontWeight: 700,
      letterSpacing: "0.3em",
      margin: "10px 0 4px"
    }
  }, "7 3 \u25CF \u25CF"), /*#__PURE__*/React.createElement(MonoLine, {
    style: {
      fontSize: 10
    }
  }, "Rotates nightly \xB7 tap to reveal")))));
}
function MerchantSetup({
  t
}) {
  const [step, setStep] = useStateM(2);
  const steps = [{
    n: 1,
    title: "Name your venue",
    done: "The Old Crown · Bristol"
  }, {
    n: 2,
    title: "Stock the reward pool",
    done: null
  }, {
    n: 3,
    title: "Print your QR",
    done: null
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 620
    }
  }, /*#__PURE__*/React.createElement(MonoLine, null, "Setup \xB7 about 5 minutes"), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 34,
      fontWeight: 800,
      margin: "6px 0 22px"
    }
  }, "Three steps, then you're live."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 14
    }
  }, steps.map(s => {
    const state = s.n < step ? "done" : s.n === step ? "now" : "next";
    return /*#__PURE__*/React.createElement("div", {
      key: s.n,
      style: {
        border: "2px solid " + (state === "next" ? "var(--w-line)" : "var(--w-ink)"),
        borderRadius: "var(--w-r)",
        background: "var(--w-card)",
        boxShadow: state === "now" ? "var(--w-shadow)" : "none",
        padding: "18px 20px",
        opacity: state === "next" ? 0.6 : 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 14
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 34,
        height: 34,
        borderRadius: "50%",
        flexShrink: 0,
        border: "2px solid var(--w-ink)",
        display: "grid",
        placeItems: "center",
        background: state === "done" ? "var(--w-leaf)" : state === "now" ? "var(--w-accent)" : "transparent",
        color: state === "next" ? "var(--w-ink)" : "#fff",
        fontWeight: 800,
        transform: "rotate(-6deg)"
      }
    }, state === "done" ? "✓" : s.n), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontWeight: 800,
        fontSize: 17
      }
    }, s.title), s.done && /*#__PURE__*/React.createElement(MonoLine, {
      style: {
        fontSize: 10,
        marginTop: 2
      }
    }, s.done)), state === "now" && s.n < 3 && /*#__PURE__*/React.createElement(InkButton, {
      size: "sm",
      onClick: () => setStep(step + 1)
    }, "Done \u2014 next")), state === "now" && s.n === 2 && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 16,
        display: "grid",
        gap: 8
      }
    }, ["Free flat white — weight 3", "Slice of cake — weight 2", "20% off next visit — weight 1"].map(r => /*#__PURE__*/React.createElement("div", {
      key: r,
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        border: "2px dashed var(--w-line)",
        borderRadius: 8,
        padding: "9px 13px",
        fontFamily: "var(--w-mono)",
        fontSize: 12.5
      }
    }, /*#__PURE__*/React.createElement("span", null, r), /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--w-leaf)",
        fontWeight: 700
      }
    }, "ACTIVE"))), /*#__PURE__*/React.createElement(DemoTag, {
      onClick: () => {}
    }, "Add another reward")), state === "now" && s.n === 3 && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 16,
        display: "flex",
        gap: 18,
        alignItems: "center",
        flexWrap: "wrap"
      }
    }, /*#__PURE__*/React.createElement(QrBlock, {
      size: 110
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(InkButton, {
      size: "md"
    }, "Print poster + till card"), /*#__PURE__*/React.createElement(MonoLine, {
      style: {
        fontSize: 10
      }
    }, "This is the moment you go live."))));
  })));
}
function MerchantCounter({
  t
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--w-ink)",
      color: "var(--w-paper)",
      border: "2px solid var(--w-ink)",
      borderRadius: 16,
      padding: "34px 30px",
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement(MonoLine, {
    style: {
      color: "rgba(246,241,230,0.55)"
    }
  }, "Counter mode \xB7 pin this tab"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--w-mono)",
      fontSize: 15,
      margin: "16px 0 4px",
      color: "rgba(246,241,230,0.55)"
    }
  }, "STAMPS TODAY"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 110,
      fontWeight: 800,
      lineHeight: 1,
      fontFamily: "var(--w-display)"
    }
  }, "14"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "inline-flex",
      gap: 10,
      alignItems: "center",
      margin: "22px 0",
      border: "2px solid rgba(246,241,230,0.3)",
      borderRadius: 999,
      padding: "8px 18px"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 10,
      height: 10,
      borderRadius: "50%",
      background: "var(--w-leaf)"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--w-mono)",
      fontSize: 12.5
    }
  }, "LAST: ASHA K. \xB7 10:48 \xB7 STAMP 2/3")), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 15,
      color: "rgba(246,241,230,0.7)",
      maxWidth: "38ch",
      margin: "0 auto"
    }
  }, "Customers hand you their phone with the PIN pad already open. Type today's PIN \u2014 that's the whole job."));
}
function MerchantApp({
  t
}) {
  const [tab, setTab] = useStateM("Today");
  const tabs = ["Today", "Setup", "Counter mode"];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1060,
      margin: "0 auto",
      padding: "26px 28px 110px"
    },
    "data-screen-label": "Merchant app"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 26,
      flexWrap: "wrap",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 28,
      height: 28,
      borderRadius: "50%",
      background: "var(--w-accent)",
      border: "2px solid var(--w-ink)",
      display: "inline-grid",
      placeItems: "center",
      color: "#fff",
      fontWeight: 800,
      fontSize: 14,
      transform: "rotate(-6deg)"
    }
  }, "\u2731"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 800,
      fontSize: 17
    }
  }, "nabaperks"), /*#__PURE__*/React.createElement(MonoTag, {
    style: {
      marginLeft: 6
    }
  }, "The Old Crown")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6
    }
  }, tabs.map(tb => /*#__PURE__*/React.createElement("button", {
    key: tb,
    onClick: () => setTab(tb),
    style: {
      fontFamily: "var(--w-display)",
      fontWeight: 700,
      fontSize: 14,
      padding: "9px 16px",
      borderRadius: 999,
      cursor: "pointer",
      border: "2px solid " + (tab === tb ? "var(--w-ink)" : "transparent"),
      background: tab === tb ? "var(--w-ink)" : "transparent",
      color: tab === tb ? "var(--w-paper)" : "var(--w-ink-soft)"
    }
  }, tb)))), tab === "Today" && /*#__PURE__*/React.createElement(MerchantToday, {
    t: t
  }), tab === "Setup" && /*#__PURE__*/React.createElement(MerchantSetup, {
    t: t
  }), tab === "Counter mode" && /*#__PURE__*/React.createElement(MerchantCounter, {
    t: t
  }));
}
window.MerchantApp = MerchantApp;
window.QrBlock = QrBlock;
})(); } catch (e) { __ds_ns.__errors.push({ path: "v2/merchant.jsx", error: String((e && e.message) || e) }); }

// v2/shared.jsx
try { (() => {
// Nabaperks v2 "Wet Ink" — shared primitives
// Exposed on window at the end of file.
const {
  useState,
  useEffect,
  useMemo,
  useRef
} = React;

/* ---------- buttons ---------- */

function InkButton({
  variant = "primary",
  size = "lg",
  full,
  onClick,
  children,
  style,
  disabled
}) {
  const [down, setDown] = useState(false);
  const palettes = {
    primary: {
      background: "var(--w-accent)",
      color: "#fff"
    },
    dark: {
      background: "var(--w-ink)",
      color: "var(--w-paper)"
    },
    outline: {
      background: "var(--w-card)",
      color: "var(--w-ink)"
    }
  };
  const sizes = {
    lg: {
      padding: "15px 24px",
      fontSize: 17,
      minHeight: 54
    },
    md: {
      padding: "11px 18px",
      fontSize: 15,
      minHeight: 46
    },
    sm: {
      padding: "7px 14px",
      fontSize: 13.5,
      minHeight: 38
    }
  };
  const press = down && !disabled;
  return /*#__PURE__*/React.createElement("button", {
    onClick: disabled ? undefined : onClick,
    onPointerDown: () => setDown(true),
    onPointerUp: () => setDown(false),
    onPointerLeave: () => setDown(false),
    style: {
      fontFamily: "var(--w-display)",
      fontWeight: 700,
      letterSpacing: "0.01em",
      border: "2px solid var(--w-ink)",
      borderRadius: "var(--w-r)",
      cursor: disabled ? "default" : "pointer",
      width: full ? "100%" : undefined,
      boxShadow: press ? "1px 1px 0 var(--w-ink)" : "var(--w-shadow)",
      transform: press ? "translate(3px,3px)" : "none",
      transition: "transform 90ms, box-shadow 90ms",
      whiteSpace: "nowrap",
      opacity: disabled ? 0.45 : 1,
      touchAction: "manipulation",
      ...palettes[variant],
      ...sizes[size],
      ...style
    }
  }, children);
}
function GhostLink({
  onClick,
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    style: {
      background: "none",
      border: "none",
      cursor: "pointer",
      fontFamily: "var(--w-display)",
      fontWeight: 700,
      fontSize: 15,
      color: "var(--w-ink)",
      textDecoration: "underline",
      textUnderlineOffset: 4,
      padding: 8,
      minHeight: 44,
      ...style
    }
  }, children);
}

/* ---------- mono chrome ---------- */

function MonoTag({
  children,
  tone,
  style
}) {
  const t = {
    accent: {
      background: "var(--w-accent)",
      color: "#fff",
      border: "1.5px solid var(--w-ink)"
    },
    ink: {
      background: "var(--w-ink)",
      color: "var(--w-paper)",
      border: "1.5px solid var(--w-ink)"
    },
    plain: {
      background: "transparent",
      color: "var(--w-ink-soft)",
      border: "1.5px solid var(--w-line)"
    }
  }[tone || "plain"];
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      fontFamily: "var(--w-mono)",
      fontSize: 11,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      borderRadius: 999,
      padding: "4px 11px",
      whiteSpace: "nowrap",
      ...t,
      ...style
    }
  }, children);
}
function MonoLine({
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--w-mono)",
      fontSize: 11.5,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
      color: "var(--w-ink-soft)",
      ...style
    }
  }, children);
}
function DemoTag({
  onClick,
  children
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    style: {
      background: "transparent",
      border: "1.5px dashed var(--w-ink-soft)",
      borderRadius: 8,
      fontFamily: "var(--w-mono)",
      fontSize: 10.5,
      fontWeight: 700,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: "var(--w-ink-soft)",
      cursor: "pointer",
      padding: "6px 10px",
      minHeight: 32
    }
  }, "\u25B8 ", children);
}

/* ---------- venue mark (rubber-stamp logo) ---------- */

function VenueMark({
  initials = "OC",
  caption = "OLD CROWN",
  size = 72,
  color = "var(--w-accent)",
  angle = -8
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: size,
      height: size,
      borderRadius: "50%",
      flexShrink: 0,
      border: `2.5px solid ${color}`,
      color,
      display: "grid",
      placeItems: "center",
      position: "relative",
      transform: `rotate(${angle}deg)`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 4,
      borderRadius: "50%",
      border: `1.5px dashed ${color}`,
      opacity: 0.75
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      lineHeight: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--w-display)",
      fontWeight: 800,
      fontSize: size * 0.34
    }
  }, initials), size >= 58 && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--w-mono)",
      fontSize: Math.max(6.5, size * 0.082),
      letterSpacing: "0.02em",
      marginTop: 3,
      maxWidth: size * 0.74,
      overflow: "hidden",
      whiteSpace: "nowrap",
      margin: "3px auto 0"
    }
  }, caption)));
}

/* ---------- receipt card ---------- */

function ReceiptCard({
  children,
  style,
  shaking,
  mo = 1
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      filter: "drop-shadow(var(--w-shadow))",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--w-card)",
      border: "2px solid var(--w-ink)",
      borderBottom: "none",
      borderRadius: "var(--w-r) var(--w-r) 0 0",
      padding: "20px 20px 14px",
      animation: shaking ? `w-shake ${300 * mo}ms cubic-bezier(0.36,0.07,0.19,0.97)` : "none"
    }
  }, children), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 12,
      marginTop: -1,
      background: "linear-gradient(-45deg, transparent 8.5px, var(--w-ink) 8.5px, var(--w-ink) 11px, var(--w-card) 11px) 0 0 / 17px 100%, " + "linear-gradient(45deg, transparent 8.5px, var(--w-ink) 8.5px, var(--w-ink) 11px, var(--w-card) 11px) 0 0 / 17px 100%"
    }
  }));
}
function ReceiptRule({
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: "2px dashed var(--w-line)",
      margin: "14px 0",
      ...style
    }
  });
}

/* ---------- celebration bits ---------- */

function CelebrationBits({
  type = "Slam",
  mo = 1,
  seed = 1
}) {
  const bits = useMemo(() => {
    const rnd = (i, s) => {
      const x = Math.sin(seed * 997 + i * 131 + s * 17) * 10000;
      return x - Math.floor(x);
    };
    const splats = Array.from({
      length: 7
    }, (_, i) => ({
      sx: (rnd(i, 1) - 0.5) * 110,
      sy: (rnd(i, 2) - 0.5) * 110,
      size: 4 + rnd(i, 3) * 7,
      delay: rnd(i, 4) * 60
    }));
    const confetti = Array.from({
      length: 16
    }, (_, i) => ({
      cx: (rnd(i, 5) - 0.5) * 220,
      cy: -30 - rnd(i, 6) * 160,
      cr: (rnd(i, 7) - 0.5) * 540,
      w: 5 + rnd(i, 8) * 6,
      h: 8 + rnd(i, 9) * 8,
      color: ["var(--w-accent)", "var(--w-ink)", "var(--w-cobalt)", "var(--w-sun)"][i % 4],
      delay: rnd(i, 10) * 110
    }));
    return {
      splats,
      confetti
    };
  }, [seed]);
  const center = {
    position: "absolute",
    left: "50%",
    top: "50%"
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      overflow: "visible"
    }
  }, type === "Ripple" && [0, 1].map(i => /*#__PURE__*/React.createElement("div", {
    key: "r" + i,
    style: {
      ...center,
      width: 70,
      height: 70,
      marginLeft: -35,
      marginTop: -35,
      border: "3px solid var(--w-accent)",
      borderRadius: "50%",
      animation: `w-ripple ${(620 + i * 200) * mo}ms ${i * 120 * mo}ms cubic-bezier(0.2,0,0,1) forwards`,
      opacity: 0
    }
  })), (type === "Slam" || type === "Burst") && bits.splats.map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: "s" + i,
    style: {
      ...center,
      width: s.size,
      height: s.size,
      marginLeft: -s.size / 2,
      marginTop: -s.size / 2,
      background: "var(--w-accent)",
      borderRadius: "50%",
      "--sx": s.sx + "px",
      "--sy": s.sy + "px",
      animation: `w-splat ${480 * mo}ms ${s.delay * mo}ms cubic-bezier(0.2,0,0,1) forwards`,
      opacity: 0
    }
  })), type === "Burst" && bits.confetti.map((c, i) => /*#__PURE__*/React.createElement("div", {
    key: "c" + i,
    style: {
      ...center,
      width: c.w,
      height: c.h,
      marginLeft: -c.w / 2,
      marginTop: -c.h / 2,
      background: c.color,
      border: "1px solid var(--w-ink)",
      "--cx": c.cx + "px",
      "--cy": c.cy + "px",
      "--cr": c.cr + "deg",
      animation: `w-confetti ${900 * mo}ms ${c.delay * mo}ms cubic-bezier(0.2,0,0,1) forwards`,
      opacity: 0
    }
  })));
}

/* ---------- stamps ---------- */

function StampDisc({
  filled,
  index,
  slammed,
  celebration = "Slam",
  mo = 1,
  size = 64,
  date
}) {
  const anim = slammed ? celebration === "Ripple" ? `w-soft-stamp ${340 * mo}ms cubic-bezier(0.2,0,0,1) both` : `w-slam ${380 * mo}ms cubic-bezier(0.16,1.2,0.3,1) both` : "none";
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      width: size,
      height: size
    }
  }, filled ? /*#__PURE__*/React.createElement("div", {
    style: {
      width: size,
      height: size,
      borderRadius: "50%",
      background: "var(--w-accent)",
      color: "#fff",
      border: "2px solid var(--w-ink)",
      display: "grid",
      placeItems: "center",
      transform: "rotate(-6deg)",
      animation: anim,
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 5,
      border: "1.5px dashed rgba(255,255,255,0.65)",
      borderRadius: "50%"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      lineHeight: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: size * 0.4,
      fontWeight: 800,
      fontFamily: "var(--w-display)"
    }
  }, "\u2731"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--w-mono)",
      fontSize: Math.max(7, size * 0.11),
      letterSpacing: "0.04em",
      marginTop: 1
    }
  }, date || "12 JUN"))) : /*#__PURE__*/React.createElement("div", {
    style: {
      width: size,
      height: size,
      borderRadius: "50%",
      border: "2px dashed var(--w-line)",
      display: "grid",
      placeItems: "center",
      color: "var(--w-ink-soft)",
      fontFamily: "var(--w-mono)",
      fontSize: size * 0.26
    }
  }, index + 1), slammed && /*#__PURE__*/React.createElement(CelebrationBits, {
    type: celebration,
    mo: mo,
    seed: index + 2
  }));
}
function StampRow({
  current,
  total,
  slamIndex = -1,
  celebration,
  mo,
  size = 64,
  dates = []
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 14,
      justifyContent: "center"
    }
  }, Array.from({
    length: total
  }, (_, i) => /*#__PURE__*/React.createElement(StampDisc, {
    key: i,
    index: i,
    filled: i < current,
    slammed: i === slamIndex,
    celebration: celebration,
    mo: mo,
    size: size,
    date: dates[i]
  })));
}
function ProgressLine({
  current,
  total,
  label = "Visits"
}) {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "baseline",
      marginBottom: 7
    }
  }, /*#__PURE__*/React.createElement(MonoLine, null, label), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--w-mono)",
      fontSize: 13,
      fontWeight: 700
    }
  }, current, "/", total)), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 12,
      border: "2px solid var(--w-ink)",
      borderRadius: 999,
      background: "var(--w-card)",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: "100%",
      width: `${current / total * 100}%`,
      background: "var(--w-accent)",
      borderRight: current > 0 && current < total ? "2px solid var(--w-ink)" : "none",
      transition: "width 500ms cubic-bezier(0.2,0,0,1)"
    }
  })));
}

/* ---------- staff PIN pad ---------- */

function PinPad({
  onDone,
  label = "Staff PIN",
  sublabel = "Use the paired counter station"
}) {
  const [digits, setDigits] = useState("");
  useEffect(() => {
    if (digits.length === 4) {
      const t = setTimeout(() => onDone && onDone(digits), 320);
      return () => clearTimeout(t);
    }
  }, [digits]);
  const key = k => {
    if (k === "⌫") setDigits(d => d.slice(0, -1));else if (digits.length < 4) setDigits(d => d + k);
  };
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement(MonoLine, {
    style: {
      color: "var(--w-ink)",
      fontWeight: 700
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13.5,
      color: "var(--w-ink-soft)",
      marginTop: 4,
      fontFamily: "var(--w-display)"
    }
  }, sublabel), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 12,
      justifyContent: "center",
      margin: "18px 0 20px"
    }
  }, [0, 1, 2, 3].map(i => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      width: 16,
      height: 16,
      borderRadius: "50%",
      border: "2px solid var(--w-ink)",
      background: i < digits.length ? "var(--w-accent)" : "transparent",
      transition: "background 120ms"
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: 10,
      maxWidth: 290,
      margin: "0 auto"
    }
  }, keys.map((k, i) => k === "" ? /*#__PURE__*/React.createElement("div", {
    key: i
  }) : /*#__PURE__*/React.createElement("button", {
    key: i,
    onClick: () => key(k),
    style: {
      height: 60,
      border: "2px solid var(--w-ink)",
      borderRadius: "var(--w-r)",
      background: "var(--w-card)",
      fontFamily: "var(--w-mono)",
      fontSize: 22,
      fontWeight: 700,
      cursor: "pointer",
      color: "var(--w-ink)",
      boxShadow: "var(--w-shadow-sm)",
      touchAction: "manipulation"
    },
    onPointerDown: e => {
      e.currentTarget.style.transform = "translate(2px,2px)";
      e.currentTarget.style.boxShadow = "1px 1px 0 var(--w-ink)";
    },
    onPointerUp: e => {
      e.currentTarget.style.transform = "none";
      e.currentTarget.style.boxShadow = "var(--w-shadow-sm)";
    },
    onPointerLeave: e => {
      e.currentTarget.style.transform = "none";
      e.currentTarget.style.boxShadow = "var(--w-shadow-sm)";
    }
  }, k))), /*#__PURE__*/React.createElement(MonoLine, {
    style: {
      marginTop: 16,
      fontSize: 10
    }
  }, "Any 4 digits work in this prototype"));
}

/* ---------- OTP boxes ---------- */

function OtpBoxes({
  length = 6,
  value,
  onChange
}) {
  const ref = useRef(null);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      display: "flex",
      gap: 8,
      justifyContent: "center",
      cursor: "text"
    },
    onClick: () => ref.current && ref.current.focus()
  }, /*#__PURE__*/React.createElement("input", {
    ref: ref,
    value: value,
    inputMode: "numeric",
    autoComplete: "one-time-code",
    onChange: e => onChange(e.target.value.replace(/\D/g, "").slice(0, length)),
    style: {
      position: "absolute",
      inset: 0,
      opacity: 0,
      width: "100%",
      border: "none"
    }
  }), Array.from({
    length
  }, (_, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      width: 44,
      height: 56,
      border: "2px solid var(--w-ink)",
      borderRadius: "var(--w-r)",
      background: "var(--w-card)",
      display: "grid",
      placeItems: "center",
      fontFamily: "var(--w-mono)",
      fontSize: 24,
      fontWeight: 700,
      boxShadow: i === value.length ? "var(--w-shadow-sm)" : "none"
    }
  }, value[i] || "")));
}

/* ---------- bottom sheet ---------- */

function Sheet({
  open,
  onClose,
  children,
  mo = 1
}) {
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      zIndex: 60
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: "absolute",
      inset: 0,
      background: "rgba(33,28,22,0.5)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: "50%",
      bottom: 0,
      transform: "translateX(-50%)",
      width: "100%",
      maxWidth: 430,
      background: "var(--w-paper)",
      borderTop: "2px solid var(--w-ink)",
      borderLeft: "2px solid var(--w-ink)",
      borderRight: "2px solid var(--w-ink)",
      borderRadius: "18px 18px 0 0",
      padding: "14px 22px 30px",
      animation: `w-sheet-up ${320 * mo}ms cubic-bezier(0.2,0,0,1)`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 44,
      height: 5,
      borderRadius: 999,
      background: "var(--w-line)",
      margin: "0 auto 16px"
    }
  }), children));
}

/* ---------- mystery seal ---------- */

function Seal({
  mode = "Hold",
  onBroken,
  mo = 1,
  size = 104
}) {
  const [progress, setProgress] = useState(0);
  const [breaking, setBreaking] = useState(false);
  const timer = useRef(null);
  const finish = () => {
    setBreaking(true);
    setTimeout(() => onBroken && onBroken(), 360 * mo);
  };
  const start = () => {
    if (mode === "Tap") {
      finish();
      return;
    }
    const t0 = Date.now();
    timer.current = setInterval(() => {
      const p = Math.min(1, (Date.now() - t0) / (850 * mo));
      setProgress(p);
      if (p >= 1) {
        clearInterval(timer.current);
        finish();
      }
    }, 24);
  };
  const stop = () => {
    if (mode === "Tap") return;
    clearInterval(timer.current);
    if (!breaking) setProgress(0);
  };
  useEffect(() => () => clearInterval(timer.current), []);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    onPointerDown: start,
    onPointerUp: stop,
    onPointerLeave: stop,
    style: {
      width: size,
      height: size,
      margin: "0 auto",
      position: "relative",
      cursor: "pointer",
      userSelect: "none",
      touchAction: "none",
      animation: breaking ? `w-shake ${300 * mo}ms` : progress > 0 ? `w-wiggle ${420 * mo}ms infinite` : "none"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: -6,
      borderRadius: "50%",
      background: `conic-gradient(var(--w-ink) ${progress * 360}deg, transparent 0deg)`,
      WebkitMask: "radial-gradient(circle, transparent 64%, #000 65%)",
      mask: "radial-gradient(circle, transparent 64%, #000 65%)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      borderRadius: "50%",
      background: "var(--w-sun)",
      border: "2px solid var(--w-ink)",
      boxShadow: "var(--w-shadow-sm)",
      display: "grid",
      placeItems: "center",
      transform: "rotate(-6deg)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 7,
      border: "1.5px dashed rgba(33,28,22,0.5)",
      borderRadius: "50%"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--w-display)",
      fontWeight: 800,
      fontSize: size * 0.42
    }
  }, "?"))), /*#__PURE__*/React.createElement(MonoLine, {
    style: {
      marginTop: 14
    }
  }, mode === "Hold" ? "Press & hold to break the seal" : "Tap to break the seal"));
}

/* ---------- GPS check-in (alternative to staff PIN) ---------- */

function GpsCheck({
  onDone,
  venue = "The Old Crown",
  mo = 1
}) {
  const [phase, setPhase] = useState("locating");
  useEffect(() => {
    const a = setTimeout(() => setPhase("found"), 1600 * mo);
    const b = setTimeout(() => onDone && onDone(), 2500 * mo);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, []);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "6px 0 10px"
    }
  }, /*#__PURE__*/React.createElement(MonoLine, {
    style: {
      color: "var(--w-ink)",
      fontWeight: 700
    }
  }, phase === "locating" ? "Checking you're at the venue" : "You're here"), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      width: 150,
      height: 150,
      margin: "22px auto"
    }
  }, phase === "locating" && [0, 1, 2].map(i => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      position: "absolute",
      left: "50%",
      top: "50%",
      width: 70,
      height: 70,
      marginLeft: -35,
      marginTop: -35,
      border: "2.5px solid var(--w-cobalt)",
      borderRadius: "50%",
      animation: `w-ripple ${1500 * mo}ms ${i * 450 * mo}ms cubic-bezier(0.2,0,0,1) infinite`,
      opacity: 0
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: "50%",
      top: "50%",
      transform: "translate(-50%,-50%)",
      animation: phase === "found" ? `w-pop ${360 * mo}ms cubic-bezier(0.16,1.2,0.3,1) both` : "none"
    }
  }, phase === "locating" ? /*#__PURE__*/React.createElement("div", {
    style: {
      width: 22,
      height: 22,
      borderRadius: "50%",
      background: "var(--w-cobalt)",
      border: "2px solid var(--w-ink)"
    }
  }) : /*#__PURE__*/React.createElement(VenueMark, {
    size: 92,
    initials: "\u2713",
    caption: "12 M AWAY",
    color: "var(--w-leaf)",
    angle: -6
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: "var(--w-ink-soft)",
      fontFamily: "var(--w-display)"
    }
  }, phase === "locating" ? `Looking for ${venue}…` : `${venue} confirmed — stamping your card.`), /*#__PURE__*/React.createElement(MonoLine, {
    style: {
      marginTop: 16,
      fontSize: 10
    }
  }, "One stamp per day \xB7 location simulated in this prototype"));
}

/* ---------- exports ---------- */
Object.assign(window, {
  InkButton,
  GhostLink,
  MonoTag,
  MonoLine,
  DemoTag,
  VenueMark,
  ReceiptCard,
  ReceiptRule,
  CelebrationBits,
  StampDisc,
  StampRow,
  ProgressLine,
  PinPad,
  OtpBoxes,
  Sheet,
  Seal,
  GpsCheck
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "v2/shared.jsx", error: String((e && e.message) || e) }); }

// v2/tweaks-panel.jsx
try { (() => {
// @ds-adherence-ignore -- omelette starter scaffold (raw elements/hex/px by design)

/* BEGIN USAGE */
// tweaks-panel.jsx
// Reusable Tweaks shell + form-control helpers.
// Exports (to window): useTweaks, TweaksPanel, TweakSection, TweakRow, TweakSlider,
//   TweakToggle, TweakRadio, TweakSelect, TweakText, TweakNumber, TweakColor, TweakButton.
//
// Owns the host protocol (listens for __activate_edit_mode / __deactivate_edit_mode,
// posts __edit_mode_available / __edit_mode_set_keys / __edit_mode_dismissed) so
// individual prototypes don't re-roll it. Ships a consistent set of controls so you
// don't hand-draw <input type="range">, segmented radios, steppers, etc.
//
// Usage (in an HTML file that loads React + Babel):
//
//   const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
//     "primaryColor": "#D97757",
//     "palette": ["#D97757", "#29261b", "#f6f4ef"],
//     "fontSize": 16,
//     "density": "regular",
//     "dark": false
//   }/*EDITMODE-END*/;
//
//   function App() {
//     const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
//     return (
//       <div style={{ fontSize: t.fontSize, color: t.primaryColor }}>
//         Hello
//         <TweaksPanel>
//           <TweakSection label="Typography" />
//           <TweakSlider label="Font size" value={t.fontSize} min={10} max={32} unit="px"
//                        onChange={(v) => setTweak('fontSize', v)} />
//           <TweakRadio  label="Density" value={t.density}
//                        options={['compact', 'regular', 'comfy']}
//                        onChange={(v) => setTweak('density', v)} />
//           <TweakSection label="Theme" />
//           <TweakColor  label="Primary" value={t.primaryColor}
//                        options={['#D97757', '#2A6FDB', '#1F8A5B', '#7A5AE0']}
//                        onChange={(v) => setTweak('primaryColor', v)} />
//           <TweakColor  label="Palette" value={t.palette}
//                        options={[['#D97757', '#29261b', '#f6f4ef'],
//                                  ['#475569', '#0f172a', '#f1f5f9']]}
//                        onChange={(v) => setTweak('palette', v)} />
//           <TweakToggle label="Dark mode" value={t.dark}
//                        onChange={(v) => setTweak('dark', v)} />
//         </TweaksPanel>
//       </div>
//     );
//   }
//
// TweakRadio is the segmented control for 2–3 short options (auto-falls-back to
// TweakSelect past ~16/~10 chars per label); reach for TweakSelect directly when
// options are many or long. For color tweaks always curate 3-4 options rather than
// a free picker; an option can also be a whole 2–5 color palette (the stored value
// is the array). The Tweak* controls are a floor, not a ceiling — build custom
// controls inside the panel if a tweak calls for UI they don't cover.
/* END USAGE */
// ─────────────────────────────────────────────────────────────────────────────

const __TWEAKS_STYLE = `
  .twk-panel{position:fixed;right:16px;bottom:16px;z-index:2147483646;width:280px;
    max-height:calc(100vh - 32px);display:flex;flex-direction:column;
    transform:scale(var(--dc-inv-zoom,1));transform-origin:bottom right;
    background:rgba(250,249,247,.78);color:#29261b;
    -webkit-backdrop-filter:blur(24px) saturate(160%);backdrop-filter:blur(24px) saturate(160%);
    border:.5px solid rgba(255,255,255,.6);border-radius:14px;
    box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 12px 40px rgba(0,0,0,.18);
    font:11.5px/1.4 ui-sans-serif,system-ui,-apple-system,sans-serif;overflow:hidden}
  .twk-hd{display:flex;align-items:center;justify-content:space-between;
    padding:10px 8px 10px 14px;cursor:move;user-select:none}
  .twk-hd b{font-size:12px;font-weight:600;letter-spacing:.01em}
  .twk-x{appearance:none;border:0;background:transparent;color:rgba(41,38,27,.55);
    width:22px;height:22px;border-radius:6px;cursor:default;font-size:13px;line-height:1}
  .twk-x:hover{background:rgba(0,0,0,.06);color:#29261b}
  .twk-body{padding:2px 14px 14px;display:flex;flex-direction:column;gap:10px;
    overflow-y:auto;overflow-x:hidden;min-height:0;
    scrollbar-width:thin;scrollbar-color:rgba(0,0,0,.15) transparent}
  .twk-body::-webkit-scrollbar{width:8px}
  .twk-body::-webkit-scrollbar-track{background:transparent;margin:2px}
  .twk-body::-webkit-scrollbar-thumb{background:rgba(0,0,0,.15);border-radius:4px;
    border:2px solid transparent;background-clip:content-box}
  .twk-body::-webkit-scrollbar-thumb:hover{background:rgba(0,0,0,.25);
    border:2px solid transparent;background-clip:content-box}
  .twk-row{display:flex;flex-direction:column;gap:5px}
  .twk-row-h{flex-direction:row;align-items:center;justify-content:space-between;gap:10px}
  .twk-lbl{display:flex;justify-content:space-between;align-items:baseline;
    color:rgba(41,38,27,.72)}
  .twk-lbl>span:first-child{font-weight:500}
  .twk-val{color:rgba(41,38,27,.5);font-variant-numeric:tabular-nums}

  .twk-sect{font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;
    color:rgba(41,38,27,.45);padding:10px 0 0}
  .twk-sect:first-child{padding-top:0}

  .twk-field{appearance:none;box-sizing:border-box;width:100%;min-width:0;height:26px;padding:0 8px;
    border:.5px solid rgba(0,0,0,.1);border-radius:7px;
    background:rgba(255,255,255,.6);color:inherit;font:inherit;outline:none}
  .twk-field:focus{border-color:rgba(0,0,0,.25);background:rgba(255,255,255,.85)}
  select.twk-field{padding-right:22px;
    background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path fill='rgba(0,0,0,.5)' d='M0 0h10L5 6z'/></svg>");
    background-repeat:no-repeat;background-position:right 8px center}

  .twk-slider{appearance:none;-webkit-appearance:none;width:100%;height:4px;margin:6px 0;
    border-radius:999px;background:rgba(0,0,0,.12);outline:none}
  .twk-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;
    width:14px;height:14px;border-radius:50%;background:#fff;
    border:.5px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:default}
  .twk-slider::-moz-range-thumb{width:14px;height:14px;border-radius:50%;
    background:#fff;border:.5px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:default}

  .twk-seg{position:relative;display:flex;padding:2px;border-radius:8px;
    background:rgba(0,0,0,.06);user-select:none}
  .twk-seg-thumb{position:absolute;top:2px;bottom:2px;border-radius:6px;
    background:rgba(255,255,255,.9);box-shadow:0 1px 2px rgba(0,0,0,.12);
    transition:left .15s cubic-bezier(.3,.7,.4,1),width .15s}
  .twk-seg.dragging .twk-seg-thumb{transition:none}
  .twk-seg button{appearance:none;position:relative;z-index:1;flex:1;border:0;
    background:transparent;color:inherit;font:inherit;font-weight:500;min-height:22px;
    border-radius:6px;cursor:default;padding:4px 6px;line-height:1.2;
    overflow-wrap:anywhere}

  .twk-toggle{position:relative;width:32px;height:18px;border:0;border-radius:999px;
    background:rgba(0,0,0,.15);transition:background .15s;cursor:default;padding:0}
  .twk-toggle[data-on="1"]{background:#34c759}
  .twk-toggle i{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;
    background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .15s}
  .twk-toggle[data-on="1"] i{transform:translateX(14px)}

  .twk-num{display:flex;align-items:center;box-sizing:border-box;min-width:0;height:26px;padding:0 0 0 8px;
    border:.5px solid rgba(0,0,0,.1);border-radius:7px;background:rgba(255,255,255,.6)}
  .twk-num-lbl{font-weight:500;color:rgba(41,38,27,.6);cursor:ew-resize;
    user-select:none;padding-right:8px}
  .twk-num input{flex:1;min-width:0;height:100%;border:0;background:transparent;
    font:inherit;font-variant-numeric:tabular-nums;text-align:right;padding:0 8px 0 0;
    outline:none;color:inherit;-moz-appearance:textfield}
  .twk-num input::-webkit-inner-spin-button,.twk-num input::-webkit-outer-spin-button{
    -webkit-appearance:none;margin:0}
  .twk-num-unit{padding-right:8px;color:rgba(41,38,27,.45)}

  .twk-btn{appearance:none;height:26px;padding:0 12px;border:0;border-radius:7px;
    background:rgba(0,0,0,.78);color:#fff;font:inherit;font-weight:500;cursor:default}
  .twk-btn:hover{background:rgba(0,0,0,.88)}
  .twk-btn.secondary{background:rgba(0,0,0,.06);color:inherit}
  .twk-btn.secondary:hover{background:rgba(0,0,0,.1)}

  .twk-swatch{appearance:none;-webkit-appearance:none;width:56px;height:22px;
    border:.5px solid rgba(0,0,0,.1);border-radius:6px;padding:0;cursor:default;
    background:transparent;flex-shrink:0}
  .twk-swatch::-webkit-color-swatch-wrapper{padding:0}
  .twk-swatch::-webkit-color-swatch{border:0;border-radius:5.5px}
  .twk-swatch::-moz-color-swatch{border:0;border-radius:5.5px}

  .twk-chips{display:flex;gap:6px}
  .twk-chip{position:relative;appearance:none;flex:1;min-width:0;height:46px;
    padding:0;border:0;border-radius:6px;overflow:hidden;cursor:default;
    box-shadow:0 0 0 .5px rgba(0,0,0,.12),0 1px 2px rgba(0,0,0,.06);
    transition:transform .12s cubic-bezier(.3,.7,.4,1),box-shadow .12s}
  .twk-chip:hover{transform:translateY(-1px);
    box-shadow:0 0 0 .5px rgba(0,0,0,.18),0 4px 10px rgba(0,0,0,.12)}
  .twk-chip[data-on="1"]{box-shadow:0 0 0 1.5px rgba(0,0,0,.85),
    0 2px 6px rgba(0,0,0,.15)}
  .twk-chip>span{position:absolute;top:0;bottom:0;right:0;width:34%;
    display:flex;flex-direction:column;box-shadow:-1px 0 0 rgba(0,0,0,.1)}
  .twk-chip>span>i{flex:1;box-shadow:0 -1px 0 rgba(0,0,0,.1)}
  .twk-chip>span>i:first-child{box-shadow:none}
  .twk-chip svg{position:absolute;top:6px;left:6px;width:13px;height:13px;
    filter:drop-shadow(0 1px 1px rgba(0,0,0,.3))}
`;

// ── useTweaks ───────────────────────────────────────────────────────────────
// Single source of truth for tweak values. setTweak persists via the host
// (__edit_mode_set_keys → host rewrites the EDITMODE block on disk).
function useTweaks(defaults) {
  const [values, setValues] = React.useState(defaults);
  // Accepts either setTweak('key', value) or setTweak({ key: value, ... }) so a
  // useState-style call doesn't write a "[object Object]" key into the persisted
  // JSON block.
  const setTweak = React.useCallback((keyOrEdits, val) => {
    const edits = typeof keyOrEdits === 'object' && keyOrEdits !== null ? keyOrEdits : {
      [keyOrEdits]: val
    };
    setValues(prev => ({
      ...prev,
      ...edits
    }));
    window.parent.postMessage({
      type: '__edit_mode_set_keys',
      edits
    }, '*');
    // Same-window signal so in-page listeners (deck-stage rail thumbnails)
    // can react — the parent message only reaches the host, not peers.
    window.dispatchEvent(new CustomEvent('tweakchange', {
      detail: edits
    }));
  }, []);
  return [values, setTweak];
}

// ── TweaksPanel ─────────────────────────────────────────────────────────────
// Floating shell. Registers the protocol listener BEFORE announcing
// availability — if the announce ran first, the host's activate could land
// before our handler exists and the toolbar toggle would silently no-op.
// The close button posts __edit_mode_dismissed so the host's toolbar toggle
// flips off in lockstep; the host echoes __deactivate_edit_mode back which
// is what actually hides the panel.
function TweaksPanel({
  title = 'Tweaks',
  children
}) {
  const [open, setOpen] = React.useState(false);
  const dragRef = React.useRef(null);
  const offsetRef = React.useRef({
    x: 16,
    y: 16
  });
  const PAD = 16;
  const clampToViewport = React.useCallback(() => {
    const panel = dragRef.current;
    if (!panel) return;
    const w = panel.offsetWidth,
      h = panel.offsetHeight;
    const maxRight = Math.max(PAD, window.innerWidth - w - PAD);
    const maxBottom = Math.max(PAD, window.innerHeight - h - PAD);
    offsetRef.current = {
      x: Math.min(maxRight, Math.max(PAD, offsetRef.current.x)),
      y: Math.min(maxBottom, Math.max(PAD, offsetRef.current.y))
    };
    panel.style.right = offsetRef.current.x + 'px';
    panel.style.bottom = offsetRef.current.y + 'px';
  }, []);
  React.useEffect(() => {
    if (!open) return;
    clampToViewport();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', clampToViewport);
      return () => window.removeEventListener('resize', clampToViewport);
    }
    const ro = new ResizeObserver(clampToViewport);
    ro.observe(document.documentElement);
    return () => ro.disconnect();
  }, [open, clampToViewport]);
  React.useEffect(() => {
    const onMsg = e => {
      const t = e?.data?.type;
      if (t === '__activate_edit_mode') setOpen(true);else if (t === '__deactivate_edit_mode') setOpen(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({
      type: '__edit_mode_available'
    }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);
  const dismiss = () => {
    setOpen(false);
    window.parent.postMessage({
      type: '__edit_mode_dismissed'
    }, '*');
  };
  const onDragStart = e => {
    const panel = dragRef.current;
    if (!panel) return;
    const r = panel.getBoundingClientRect();
    const sx = e.clientX,
      sy = e.clientY;
    const startRight = window.innerWidth - r.right;
    const startBottom = window.innerHeight - r.bottom;
    const move = ev => {
      offsetRef.current = {
        x: startRight - (ev.clientX - sx),
        y: startBottom - (ev.clientY - sy)
      };
      clampToViewport();
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };
  if (!open) return null;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("style", null, __TWEAKS_STYLE), /*#__PURE__*/React.createElement("div", {
    ref: dragRef,
    className: "twk-panel",
    "data-omelette-chrome": "",
    style: {
      right: offsetRef.current.x,
      bottom: offsetRef.current.y
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-hd",
    onMouseDown: onDragStart
  }, /*#__PURE__*/React.createElement("b", null, title), /*#__PURE__*/React.createElement("button", {
    className: "twk-x",
    "aria-label": "Close tweaks",
    onMouseDown: e => e.stopPropagation(),
    onClick: dismiss
  }, "\u2715")), /*#__PURE__*/React.createElement("div", {
    className: "twk-body"
  }, children)));
}

// ── Layout helpers ──────────────────────────────────────────────────────────

function TweakSection({
  label,
  children
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "twk-sect"
  }, label), children);
}
function TweakRow({
  label,
  value,
  children,
  inline = false
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: inline ? 'twk-row twk-row-h' : 'twk-row'
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-lbl"
  }, /*#__PURE__*/React.createElement("span", null, label), value != null && /*#__PURE__*/React.createElement("span", {
    className: "twk-val"
  }, value)), children);
}

// ── Controls ────────────────────────────────────────────────────────────────

function TweakSlider({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  unit = '',
  onChange
}) {
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label,
    value: `${value}${unit}`
  }, /*#__PURE__*/React.createElement("input", {
    type: "range",
    className: "twk-slider",
    min: min,
    max: max,
    step: step,
    value: value,
    onChange: e => onChange(Number(e.target.value))
  }));
}
function TweakToggle({
  label,
  value,
  onChange
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "twk-row twk-row-h"
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-lbl"
  }, /*#__PURE__*/React.createElement("span", null, label)), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "twk-toggle",
    "data-on": value ? '1' : '0',
    role: "switch",
    "aria-checked": !!value,
    onClick: () => onChange(!value)
  }, /*#__PURE__*/React.createElement("i", null)));
}
function TweakRadio({
  label,
  value,
  options,
  onChange
}) {
  const trackRef = React.useRef(null);
  const [dragging, setDragging] = React.useState(false);
  // The active value is read by pointer-move handlers attached for the lifetime
  // of a drag — ref it so a stale closure doesn't fire onChange for every move.
  const valueRef = React.useRef(value);
  valueRef.current = value;

  // Segments wrap mid-word once per-segment width runs out. The track is
  // ~248px (280 panel − 28 body pad − 4 seg pad), each button loses 12px
  // to its own padding, and 11.5px system-ui averages ~6.3px/char — so 2
  // options fit ~16 chars each, 3 fit ~10. Past that (or >3 options), fall
  // back to a dropdown rather than wrap.
  const labelLen = o => String(typeof o === 'object' ? o.label : o).length;
  const maxLen = options.reduce((m, o) => Math.max(m, labelLen(o)), 0);
  const fitsAsSegments = maxLen <= ({
    2: 16,
    3: 10
  }[options.length] ?? 0);
  if (!fitsAsSegments) {
    // <select> emits strings — map back to the original option value so the
    // fallback stays type-preserving (numbers, booleans) like the segment path.
    const resolve = s => {
      const m = options.find(o => String(typeof o === 'object' ? o.value : o) === s);
      return m === undefined ? s : typeof m === 'object' ? m.value : m;
    };
    return /*#__PURE__*/React.createElement(TweakSelect, {
      label: label,
      value: value,
      options: options,
      onChange: s => onChange(resolve(s))
    });
  }
  const opts = options.map(o => typeof o === 'object' ? o : {
    value: o,
    label: o
  });
  const idx = Math.max(0, opts.findIndex(o => o.value === value));
  const n = opts.length;
  const segAt = clientX => {
    const r = trackRef.current.getBoundingClientRect();
    const inner = r.width - 4;
    const i = Math.floor((clientX - r.left - 2) / inner * n);
    return opts[Math.max(0, Math.min(n - 1, i))].value;
  };
  const onPointerDown = e => {
    setDragging(true);
    const v0 = segAt(e.clientX);
    if (v0 !== valueRef.current) onChange(v0);
    const move = ev => {
      if (!trackRef.current) return;
      const v = segAt(ev.clientX);
      if (v !== valueRef.current) onChange(v);
    };
    const up = () => {
      setDragging(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("div", {
    ref: trackRef,
    role: "radiogroup",
    onPointerDown: onPointerDown,
    className: dragging ? 'twk-seg dragging' : 'twk-seg'
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-seg-thumb",
    style: {
      left: `calc(2px + ${idx} * (100% - 4px) / ${n})`,
      width: `calc((100% - 4px) / ${n})`
    }
  }), opts.map(o => /*#__PURE__*/React.createElement("button", {
    key: o.value,
    type: "button",
    role: "radio",
    "aria-checked": o.value === value
  }, o.label))));
}
function TweakSelect({
  label,
  value,
  options,
  onChange
}) {
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("select", {
    className: "twk-field",
    value: value,
    onChange: e => onChange(e.target.value)
  }, options.map(o => {
    const v = typeof o === 'object' ? o.value : o;
    const l = typeof o === 'object' ? o.label : o;
    return /*#__PURE__*/React.createElement("option", {
      key: v,
      value: v
    }, l);
  })));
}
function TweakText({
  label,
  value,
  placeholder,
  onChange
}) {
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("input", {
    className: "twk-field",
    type: "text",
    value: value,
    placeholder: placeholder,
    onChange: e => onChange(e.target.value)
  }));
}
function TweakNumber({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange
}) {
  const clamp = n => {
    if (min != null && n < min) return min;
    if (max != null && n > max) return max;
    return n;
  };
  const startRef = React.useRef({
    x: 0,
    val: 0
  });
  const onScrubStart = e => {
    e.preventDefault();
    startRef.current = {
      x: e.clientX,
      val: value
    };
    const decimals = (String(step).split('.')[1] || '').length;
    const move = ev => {
      const dx = ev.clientX - startRef.current.x;
      const raw = startRef.current.val + dx * step;
      const snapped = Math.round(raw / step) * step;
      onChange(clamp(Number(snapped.toFixed(decimals))));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "twk-num"
  }, /*#__PURE__*/React.createElement("span", {
    className: "twk-num-lbl",
    onPointerDown: onScrubStart
  }, label), /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: value,
    min: min,
    max: max,
    step: step,
    onChange: e => onChange(clamp(Number(e.target.value)))
  }), unit && /*#__PURE__*/React.createElement("span", {
    className: "twk-num-unit"
  }, unit));
}

// Relative-luminance contrast pick — checkmarks drawn over a swatch need to
// read on both #111 and #fafafa without per-option configuration. Hex input
// only (#rgb / #rrggbb); named or rgb()/hsl() colors fall through to "light".
function __twkIsLight(hex) {
  const h = String(hex).replace('#', '');
  const x = h.length === 3 ? h.replace(/./g, c => c + c) : h.padEnd(6, '0');
  const n = parseInt(x.slice(0, 6), 16);
  if (Number.isNaN(n)) return true;
  const r = n >> 16 & 255,
    g = n >> 8 & 255,
    b = n & 255;
  return r * 299 + g * 587 + b * 114 > 148000;
}
const __TwkCheck = ({
  light
}) => /*#__PURE__*/React.createElement("svg", {
  viewBox: "0 0 14 14",
  "aria-hidden": "true"
}, /*#__PURE__*/React.createElement("path", {
  d: "M3 7.2 5.8 10 11 4.2",
  fill: "none",
  strokeWidth: "2.2",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  stroke: light ? 'rgba(0,0,0,.78)' : '#fff'
}));

// TweakColor — curated color/palette picker. Each option is either a single
// hex string or an array of 1-5 hex strings; the card adapts — a lone color
// renders solid, a palette renders colors[0] as the hero (left ~2/3) with the
// rest stacked in a sharp column on the right. onChange emits the
// option in the shape it was passed (string stays string, array stays array).
// Without options it falls back to the native color input for back-compat.
function TweakColor({
  label,
  value,
  options,
  onChange
}) {
  if (!options || !options.length) {
    return /*#__PURE__*/React.createElement("div", {
      className: "twk-row twk-row-h"
    }, /*#__PURE__*/React.createElement("div", {
      className: "twk-lbl"
    }, /*#__PURE__*/React.createElement("span", null, label)), /*#__PURE__*/React.createElement("input", {
      type: "color",
      className: "twk-swatch",
      value: value,
      onChange: e => onChange(e.target.value)
    }));
  }
  // Native <input type=color> emits lowercase hex per the HTML spec, so
  // compare case-insensitively. String() guards JSON.stringify(undefined),
  // which returns the primitive undefined (no .toLowerCase).
  const key = o => String(JSON.stringify(o)).toLowerCase();
  const cur = key(value);
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-chips",
    role: "radiogroup"
  }, options.map((o, i) => {
    const colors = Array.isArray(o) ? o : [o];
    const [hero, ...rest] = colors;
    const sup = rest.slice(0, 4);
    const on = key(o) === cur;
    return /*#__PURE__*/React.createElement("button", {
      key: i,
      type: "button",
      className: "twk-chip",
      role: "radio",
      "aria-checked": on,
      "data-on": on ? '1' : '0',
      "aria-label": colors.join(', '),
      title: colors.join(' · '),
      style: {
        background: hero
      },
      onClick: () => onChange(o)
    }, sup.length > 0 && /*#__PURE__*/React.createElement("span", null, sup.map((c, j) => /*#__PURE__*/React.createElement("i", {
      key: j,
      style: {
        background: c
      }
    }))), on && /*#__PURE__*/React.createElement(__TwkCheck, {
      light: __twkIsLight(hero)
    }));
  })));
}
function TweakButton({
  label,
  onClick,
  secondary = false
}) {
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: secondary ? 'twk-btn secondary' : 'twk-btn',
    onClick: onClick
  }, label);
}
Object.assign(window, {
  useTweaks,
  TweaksPanel,
  TweakSection,
  TweakRow,
  TweakSlider,
  TweakToggle,
  TweakRadio,
  TweakSelect,
  TweakText,
  TweakNumber,
  TweakColor,
  TweakButton
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "v2/tweaks-panel.jsx", error: String((e && e.message) || e) }); }

__ds_ns.GhostLink = __ds_scope.GhostLink;

__ds_ns.InkButton = __ds_scope.InkButton;

__ds_ns.MonoTag = __ds_scope.MonoTag;

__ds_ns.MonoLine = __ds_scope.MonoLine;

__ds_ns.OtpBoxes = __ds_scope.OtpBoxes;

__ds_ns.PinPad = __ds_scope.PinPad;

__ds_ns.CelebrationBits = __ds_scope.CelebrationBits;

__ds_ns.ProgressLine = __ds_scope.ProgressLine;

__ds_ns.Seal = __ds_scope.Seal;

__ds_ns.StampDisc = __ds_scope.StampDisc;

__ds_ns.StampRow = __ds_scope.StampRow;

__ds_ns.VenueMark = __ds_scope.VenueMark;

__ds_ns.ReceiptCard = __ds_scope.ReceiptCard;

__ds_ns.ReceiptRule = __ds_scope.ReceiptRule;

__ds_ns.Sheet = __ds_scope.Sheet;

})();
