# MkFaqItem

- **Surface:** marketing (content sub-component)
- **Source module:** [extracted-source/50-marketing.jsx](../../extracted-source/50-marketing.jsx) (lines 104–127)
- **Export:** none (module-local function, rendered by `MkPricing` from the `MK_FAQS` array)
- **Reuse verdict:** ⚠️ Reusable, needs refactor (inline styles, controlled open-state lifted to parent, `✱`-style `+`/`–` disc, motion via `mo` multiplier)

## Visual purpose

One row of the pricing-page accordion. A dashed top rule, a full-width toggle button with the question in display type, and a round `+`/`–` indicator disc on the right. Open: the disc flips to the accent palette (white glyph on `--w-accent`) and rotates `-6deg`; the answer paragraph reveals below with a `w-rise` entrance.

## Props / state

| Prop       | Type         | Default | Notes                                                                                                                      |
| ---------- | ------------ | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| `q`        | `string`     | —       | Question text. Also used as the React `key` at the call site.                                                              |
| `a`        | `string`     | —       | Answer paragraph; only rendered while `open`.                                                                              |
| `open`     | `boolean`    | —       | Controlled by parent (`openFaq === i`). Drives glyph (`–`/`+`), disc palette, rotation, and answer visibility.             |
| `onToggle` | `() => void` | —       | Parent toggles single-open behaviour: `() => setOpenFaq(openFaq === i ? -1 : i)`.                                          |
| `mo`       | `number`     | —       | Motion multiplier (`t.mo`). Scales the disc `transition` (`160 * mo` ms) and the answer `w-rise` duration (`260 * mo` ms). |

**State:** none locally — open/closed is a controlled prop lifted to `MkPricing`'s `openFaq`.

## UX behaviour

- Whole header is a `<button onClick={onToggle}>`, `textAlign: "left"`, padding `16px 2px`.
- Indicator disc, when `open`: `color:#fff`, `background: var(--w-accent)`, `transform: rotate(-6deg)`; when closed: `color: var(--w-ink)`, `background: var(--w-card)`, no rotation. Transition `transform ${160 * mo}ms`.
- Glyph is `open ? "–" : "+"` (en-dash minus, not a hyphen-minus).
- Answer paragraph appears only when `open`, with `animation: w-rise ${260 * mo}ms cubic-bezier(0.2,0,0,1) both`, constrained to `maxWidth: "62ch"`.

## Dependencies

- **Shared primitives:** none.
- **CSS variables:** `--w-line`, `--w-display`, `--w-mono`, `--w-ink`, `--w-card`, `--w-accent`, `--w-ink-soft`.
- **Keyframes:** `w-rise` (answer reveal).
- **localStorage:** none.
- **Globals / window:** none. Not exported.

## Reuse notes

A solid single-open accordion row. For production: (1) inline styles → token layer; (2) the `mo`-multiplier timing pattern should defer to `prefers-reduced-motion` rather than a JS-threaded multiplier; (3) accessibility is missing — needs `aria-expanded`, `aria-controls`, and a region id linking button to panel; (4) the bespoke disc should reuse the brand indicator treatment. Controlled-open via a parent index is a clean pattern and worth keeping.

## Source snippet

```jsx
function MkFaqItem({ q, a, open, onToggle, mo }) {
  return (
    <div style={{ borderTop: "2px dashed var(--w-line)" }}>
      <button
        onClick={onToggle}
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 14,
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "16px 2px",
          textAlign: "left",
        }}
      >
        <span
          style={{
            fontFamily: "var(--w-display)",
            fontWeight: 800,
            fontSize: 17.5,
            color: "var(--w-ink)",
          }}
        >
          {q}
        </span>
        <span
          style={{
            fontFamily: "var(--w-mono)",
            fontSize: 17,
            fontWeight: 700,
            color: open ? "#fff" : "var(--w-ink)",
            width: 30,
            height: 30,
            borderRadius: "50%",
            border: "2px solid var(--w-ink)",
            flexShrink: 0,
            display: "grid",
            placeItems: "center",
            background: open ? "var(--w-accent)" : "var(--w-card)",
            transform: open ? "rotate(-6deg)" : "none",
            transition: `transform ${160 * mo}ms`,
          }}
        >
          {open ? "–" : "+"}
        </span>
      </button>
      {open && (
        <p
          style={{
            margin: "0 0 18px",
            maxWidth: "62ch",
            fontSize: 15,
            lineHeight: "23px",
            color: "var(--w-ink-soft)",
            animation: `w-rise ${260 * mo}ms cubic-bezier(0.2,0,0,1) both`,
          }}
        >
          {a}
        </p>
      )}
    </div>
  )
}
```
