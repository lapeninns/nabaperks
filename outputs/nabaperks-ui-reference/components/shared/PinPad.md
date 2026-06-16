# PinPad

- **Surface:** shared (primitive)
- **Source module:** [extracted-source/10-primitives.jsx](../../extracted-source/10-primitives.jsx) (lines 264–310)
- **Export:** `window.PinPad` (global)
- **Reuse verdict:** 🔒 Prototype-only (staff-PIN mechanic retired in v3; "any 4 digits work" fake, inline styles, global export)

## Visual purpose

A 4-digit numeric keypad with a row of fill dots, used for the legacy **staff PIN** verification ("hand the phone to staff"). Hard-bordered mono keys with the offset-shadow press effect; auto-submits on the fourth digit.

> **Prototype-ism / retired mechanic.** Per the project design notes, the handed-phone staff PIN was replaced in v3 by a counter handshake (code → paired station). The footer copy "Any 4 digits work in this prototype" confirms there is no real validation here.

## Props / state

| Prop       | Type                       | Default                     | Notes                                                       |
| ---------- | -------------------------- | --------------------------- | ----------------------------------------------------------- |
| `onDone`   | `(digits: string) => void` | —                           | Called ~320ms after the 4th digit, with the entered string. |
| `label`    | `string`                   | `"Staff PIN"`               | Strong mono heading.                                        |
| `sublabel` | `string`                   | `"Hand the phone to staff"` | Display-font subheading.                                    |

**State:** `const [digits, setDigits] = useState("")` — the accumulated entry (max length 4).

## UX behaviour

- `key(k)`: `⌫` removes the last char; any other key appends while `digits.length < 4`.
- `useEffect` on `[digits]`: when `digits.length === 4`, sets a `setTimeout(() => onDone(digits), 320)` (a short confirm delay) and clears it on cleanup.
- Fill dots: four 16px circles; dot `i` fills accent when `i < digits.length`, with a `120ms` background transition.
- Keypad: 3-column grid of `["1".."9", "", "0", "⌫"]`; the empty string slot renders a spacer `div`. Keys are `60px` tall, mono `fontSize: 22`, with `var(--w-shadow-sm)`.
- Per-key press feedback is imperative: `onPointerDown/Up/Leave` mutate `e.currentTarget.style.transform` / `boxShadow` directly (translate `2px,2px` + `1px 1px 0 var(--w-ink)` on press).
- Footer `MonoLine`: "Any 4 digits work in this prototype".

## Dependencies

- **Shared primitives:** `MonoLine` (heading + footer).
- **CSS variables:** `--w-ink`, `--w-ink-soft`, `--w-accent`, `--w-card`, `--w-r`, `--w-display`, `--w-mono`, `--w-shadow-sm`.
- **Keyframes:** none (press feedback is imperative inline style mutation, not a keyframe).
- **localStorage:** none.
- **Globals / window:** reads `React` (destructured `useState`, `useEffect`); writes itself to `window.PinPad`.

## Reuse notes

Prototype-only and tied to a **retired** mechanic — do not carry into production as a primary verification path. The `setTimeout(onDone, 320)` is a cosmetic confirm delay, and there is no PIN validation at all. If a numeric-entry pad is needed elsewhere, the keypad layout and fill-dot pattern are reusable, but: (1) replace imperative `e.currentTarget.style` mutation with CSS `:active`; (2) add real validation + error feedback; (3) move inline styles to tokens; (4) replace `window.*` with a module export.

## Source snippet

```jsx
function PinPad({
  onDone,
  label = "Staff PIN",
  sublabel = "Hand the phone to staff",
}) {
  const [digits, setDigits] = useState("")
  useEffect(() => {
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
  return (
    <div style={{ textAlign: "center" }}>
      <MonoLine style={{ color: "var(--w-ink)", fontWeight: 700 }}>
        {label}
      </MonoLine>
      <div
        style={{
          fontSize: 13.5,
          color: "var(--w-ink-soft)",
          marginTop: 4,
          fontFamily: "var(--w-display)",
        }}
      >
        {sublabel}
      </div>
      <div
        style={{
          display: "flex",
          gap: 12,
          justifyContent: "center",
          margin: "18px 0 20px",
        }}
      >
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              width: 16,
              height: 16,
              borderRadius: "50%",
              border: "2px solid var(--w-ink)",
              background: i < digits.length ? "var(--w-accent)" : "transparent",
              transition: "background 120ms",
            }}
          ></div>
        ))}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 10,
          maxWidth: 290,
          margin: "0 auto",
        }}
      >
        {keys.map((k, i) =>
          k === "" ? (
            <div key={i}></div>
          ) : (
            <button
              key={i}
              onClick={() => key(k)}
              style={{
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
                touchAction: "manipulation",
              }}
              onPointerDown={(e) => {
                e.currentTarget.style.transform = "translate(2px,2px)"
                e.currentTarget.style.boxShadow = "1px 1px 0 var(--w-ink)"
              }}
              onPointerUp={(e) => {
                e.currentTarget.style.transform = "none"
                e.currentTarget.style.boxShadow = "var(--w-shadow-sm)"
              }}
              onPointerLeave={(e) => {
                e.currentTarget.style.transform = "none"
                e.currentTarget.style.boxShadow = "var(--w-shadow-sm)"
              }}
            >
              {k}
            </button>
          )
        )}
      </div>
      <MonoLine style={{ marginTop: 16, fontSize: 10 }}>
        Any 4 digits work in this prototype
      </MonoLine>
    </div>
  )
}
```
