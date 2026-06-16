# OtpBoxes

- **Surface:** shared (primitive)
- **Source module:** [extracted-source/10-primitives.jsx](../../extracted-source/10-primitives.jsx) (lines 314–332)
- **Export:** `window.OtpBoxes` (global)
- **Reuse verdict:** ⚠️ Reusable, needs refactor (inline styles, controlled-input contract, global export)

## Visual purpose

A one-time-code entry field rendered as a row of individual character boxes (default 6) backed by a single hidden full-width `<input>`. The active box (next to fill) shows the offset `--w-shadow-sm` as a focus cue. Used for the phone-first OTP verification step.

## Props / state

| Prop       | Type                     | Default | Notes                                                            |
| ---------- | ------------------------ | ------- | ---------------------------------------------------------------- |
| `length`   | `number`                 | `6`     | Number of visible boxes and the max accepted digits.             |
| `value`    | `string`                 | —       | Controlled value; the parent owns the digit string.              |
| `onChange` | `(next: string) => void` | —       | Receives the sanitised value (digits only, trimmed to `length`). |

**State:** none of its own. Uses `const ref = useRef(null)` to forward focus to the hidden input.

## UX behaviour

- A transparent, absolutely-positioned `<input>` (`opacity: 0`, covers the whole row) captures keystrokes; clicking anywhere on the row calls `ref.current.focus()`.
- Input config: `inputMode="numeric"`, `autoComplete="one-time-code"` (enables OS OTP autofill).
- `onChange` sanitises: `e.target.value.replace(/\D/g, "").slice(0, length)` — strips non-digits and caps length.
- Renders `length` boxes (`44×56`, `2px solid var(--w-ink)`, mono `fontSize: 24`). Box `i` shows `value[i] || ""`.
- Focus cue: the box at index `value.length` (the next empty box) gets `boxShadow: var(--w-shadow-sm)`; all others `none`.

## Dependencies

- **Shared primitives:** none.
- **CSS variables:** `--w-ink`, `--w-card`, `--w-r`, `--w-mono`, `--w-shadow-sm`.
- **Keyframes:** none.
- **localStorage:** none.
- **Globals / window:** reads `React` (destructured `useRef`); writes itself to `window.OtpBoxes`.

## Reuse notes

A solid OTP-entry pattern (hidden input + box overlay + OS autofill) worth keeping. For production: (1) move inline styles to the token/`data-slot` layer; (2) add visible focus/error states and `aria` labelling; (3) replace `window.*` with a module export. The controlled `value`/`onChange` contract is clean and portable; the sanitisation regex is correct. No internal state or timing mocks.

## Source snippet

```jsx
function OtpBoxes({ length = 6, value, onChange }) {
  const ref = useRef(null)
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        gap: 8,
        justifyContent: "center",
        cursor: "text",
      }}
      onClick={() => ref.current && ref.current.focus()}
    >
      <input
        ref={ref}
        value={value}
        inputMode="numeric"
        autoComplete="one-time-code"
        onChange={(e) =>
          onChange(e.target.value.replace(/\D/g, "").slice(0, length))
        }
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0,
          width: "100%",
          border: "none",
        }}
      />
      {Array.from({ length }, (_, i) => (
        <div
          key={i}
          style={{
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
            boxShadow: i === value.length ? "var(--w-shadow-sm)" : "none",
          }}
        >
          {value[i] || ""}
        </div>
      ))}
    </div>
  )
}
```
