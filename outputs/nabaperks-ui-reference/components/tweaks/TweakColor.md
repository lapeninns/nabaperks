# TweakColor

- **Surface:** tweaks (omelette-starter scaffold — form-control helper, NOT a Wet-Ink surface)
- **Source module:** [extracted-source/00-tweaks-panel.jsx](../../extracted-source/00-tweaks-panel.jsx) (lines 487–528; helpers `__twkIsLight` 464–471 and `__TwkCheck` 473–479; style classes `.twk-swatch` 146–151 and `.twk-chips`/`.twk-chip` 153–167)
- **Export:** `window.TweakColor` (global; `Object.assign(window, …)` lines 537–541). The `__twkIsLight` and `__TwkCheck` helpers are **module-private** (not exported).
- **Reuse verdict:** 🔒 Prototype-only (raw hex/px scaffold styling, global export — tooling layer by design)

## Visual purpose

A curated colour/palette picker — a row of swatch "chips", each a single colour or a whole 1–5 colour palette, with a contrast-aware checkmark on the active chip. The colour control of the panel, and the one the USAGE prose has the strongest opinion about: "For color tweaks always curate 3-4 options rather than a free picker; an option can also be a whole 2–5 color palette (the stored value is the array)." Without `options` it falls back to a native `<input type="color">` swatch (`.twk-swatch`) for back-compat. A palette chip renders `colors[0]` as the hero fill with the rest stacked in a sharp column on the right (`.twk-chip>span`). **Raw hex/px by design** (`@ds-adherence-ignore`) — naturally, since its whole job is choosing literal hex.

## Props / state

| Prop       | Type                              | Default | Notes                                                                                                            |
| ---------- | --------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------- |
| `label`    | `string`                          | —       | Passed to `TweakRow` (curated path) or rendered inline (native fallback).                                        |
| `value`    | `string \| string[]`              | —       | Active colour or palette. Compared against options via case-insensitive `JSON.stringify`.                        |
| `options`  | `Array<string \| string[]>`       | —       | Each option is a single hex string or an array of 1–5 hex strings. **If absent/empty ⇒ native picker fallback.** |
| `onChange` | `(o: string \| string[]) => void` | —       | Emits the option **in the shape it was passed** — string stays string, array stays array.                        |

**State:** none — fully controlled via `value`/`onChange`.

**Module-private helpers:**

- `__twkIsLight(hex)` — relative-luminance test (`r*299 + g*587 + b*114 > 148000`) so the checkmark reads on both dark and light swatches without per-option config. Accepts `#rgb` / `#rrggbb`; named or `rgb()`/`hsl()` colours fall through to "light" (returns `true` on `NaN`).
- `__TwkCheck({ light })` — the tick `<svg>`; stroke is `rgba(0,0,0,.78)` when `light`, else `#fff`.

## UX behaviour

- **Native fallback (no options):** renders an inline `'twk-row twk-row-h'` with a native `<input type="color" className="twk-swatch">` emitting `e.target.value`.
- **Curated path:** renders `.twk-chips` (a `role="radiogroup"`). For each option: normalises to a `colors` array, splits `[hero, ...rest]` and caps the supplementary stack at 4 (`rest.slice(0, 4)`). The chip's background is the hero; supplementary colours stack in the right `<span>`; the active chip shows `<__TwkCheck light={__twkIsLight(hero)} />`.
- **Active detection (case-insensitive):** `const key = (o) => String(JSON.stringify(o)).toLowerCase();` then `key(o) === key(value)`. The comment explains native `<input type=color>` emits **lowercase** hex per spec, so comparison must be case-insensitive; `String(...)` guards `JSON.stringify(undefined)` (which returns the primitive `undefined`, lacking `.toLowerCase`).
- **ARIA / affordances:** each chip is a `role="radio"` button with `aria-checked`, `data-on`, `aria-label={colors.join(', ')}` and `title={colors.join(' · ')}`. Active state is shown via the `data-on="1"` ring in CSS plus the drawn checkmark.

## Dependencies

- **Shared primitives:** `TweakRow` (curated path only; the native fallback inlines its own `.twk-row twk-row-h`).
- **CSS variables:** none — **raw hex/px by design**. Recorded representative values: `.twk-swatch{width:56px; height:22px; border-radius:6px}`, `.twk-chips{gap:6px}`, `.twk-chip{height:46px; border-radius:6px; box-shadow:0 0 0 .5px rgba(0,0,0,.12),0 1px 2px rgba(0,0,0,.06)}`, active `.twk-chip[data-on="1"]{box-shadow:0 0 0 1.5px rgba(0,0,0,.85),0 2px 6px rgba(0,0,0,.15)}`, palette column `.twk-chip>span{width:34%}`, tick `.twk-chip svg{width:13px; height:13px}`. The actual colour values shown are caller-supplied option hex (e.g. from the USAGE example: `#D97757`, `#29261b`, `#f6f4ef`, `#475569`, `#0f172a`, `#f1f5f9`).
- **Keyframes:** none (CSS `transition` only — chip hover lift `transform .12s` + `box-shadow .12s`).
- **localStorage:** none.
- **Globals / window:** reads `React`; writes itself to `window.TweakColor`. The `__twkIsLight` / `__TwkCheck` helpers are module-scoped (not on `window`). Styling depends on `__TWEAKS_STYLE` (injected by `TweaksPanel`).

## Reuse notes

The most opinionated control: it encodes a design rule (curate swatches; palettes are first-class; the stored value can be an array) rather than offering a raw picker, and it is shape-preserving on `onChange`. The luminance-based checkmark contrast (`__twkIsLight`) and case-insensitive `JSON.stringify` comparison are thoughtful, portable touches. Raw hex/px is intentional and especially apt here (`@ds-adherence-ignore`). For a product surface this would map curated options onto `--w-*` palette tokens, but the chip/palette UX and contrast logic are worth preserving as a reference.

## Source snippet

```jsx
function __twkIsLight(hex) {
  const h = String(hex).replace("#", "")
  const x = h.length === 3 ? h.replace(/./g, (c) => c + c) : h.padEnd(6, "0")
  const n = parseInt(x.slice(0, 6), 16)
  if (Number.isNaN(n)) return true
  const r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255
  return r * 299 + g * 587 + b * 114 > 148000
}

const __TwkCheck = ({ light }) => (
  <svg viewBox="0 0 14 14" aria-hidden="true">
    <path
      d="M3 7.2 5.8 10 11 4.2"
      fill="none"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      stroke={light ? "rgba(0,0,0,.78)" : "#fff"}
    />
  </svg>
)

function TweakColor({ label, value, options, onChange }) {
  if (!options || !options.length) {
    return (
      <div className="twk-row twk-row-h">
        <div className="twk-lbl">
          <span>{label}</span>
        </div>
        <input
          type="color"
          className="twk-swatch"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    )
  }
  const key = (o) => String(JSON.stringify(o)).toLowerCase()
  const cur = key(value)
  return (
    <TweakRow label={label}>
      <div className="twk-chips" role="radiogroup">
        {options.map((o, i) => {
          const colors = Array.isArray(o) ? o : [o]
          const [hero, ...rest] = colors
          const sup = rest.slice(0, 4)
          const on = key(o) === cur
          return (
            <button
              key={i}
              type="button"
              className="twk-chip"
              role="radio"
              aria-checked={on}
              data-on={on ? "1" : "0"}
              aria-label={colors.join(", ")}
              title={colors.join(" · ")}
              style={{ background: hero }}
              onClick={() => onChange(o)}
            >
              {sup.length > 0 && (
                <span>
                  {sup.map((c, j) => (
                    <i key={j} style={{ background: c }} />
                  ))}
                </span>
              )}
              {on && <__TwkCheck light={__twkIsLight(hero)} />}
            </button>
          )
        })}
      </div>
    </TweakRow>
  )
}
```
