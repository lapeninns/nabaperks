# MoField

- **Surface:** merchant (local sub-primitive)
- **Source module:** [extracted-source/21-merchant-ops.jsx](../../extracted-source/21-merchant-ops.jsx) (lines 73–94)
- **Export:** local to module (not on `window`)
- **Reuse verdict:** ⚠️ Reusable, needs refactor (inline styles, no `id`/`htmlFor` label wiring)

## Visual purpose

A labelled text input in the Wet Ink style. A mono-uppercase label sits above a hard-bordered mono input. An optional `prefix` chip butts up against the left edge (e.g. `nabaperks.app/m/`), with the shared border seam removed and the radii adjusted so the prefix and input read as one control. Used for the venue-details form in Settings.

## Props / state

| Prop       | Type                      | Default | Notes                                                                                 |
| ---------- | ------------------------- | ------- | ------------------------------------------------------------------------------------- |
| `label`    | `ReactNode`               | —       | Rendered inside `MonoLine` above the field.                                           |
| `value`    | `string`                  | —       | Controlled input value.                                                               |
| `onChange` | `(value: string) => void` | —       | Called with `e.target.value` (the **string**, not the event).                         |
| `prefix`   | `ReactNode`               | —       | Optional left-hand static prefix chip; when present, the input loses its left radius. |

**State:** none (controlled; value lives in the parent).

## UX behaviour

- Label: `MonoLine` with `marginBottom: 7`.
- Row: `display: flex, alignItems: stretch` so prefix and input are equal height.
- Prefix chip: mono, `--w-ink-soft` text, `--w-paper-2` background, ink border with `borderRight: "none"`, radius `var(--w-r) 0 0 var(--w-r)`, `whiteSpace: "nowrap"`.
- Input: full width, `fontSize: 16` (mono), `--w-paper` background, ink border, `outline: "none"`. Radius is `0 var(--w-r) var(--w-r) 0` when prefixed, else `var(--w-r)`.

## Dependencies

- **Shared primitives:** `MonoLine` (window global).
- **CSS variables:** `--w-mono`, `--w-ink`, `--w-ink-soft`, `--w-paper`, `--w-paper-2`, `--w-r`.
- **Keyframes:** none.
- **localStorage:** none.
- **Globals / window:** reads `React` indirectly (JSX); reads `window.MonoLine`. Not exported.

## Reuse notes

A clean prefixed-input pattern. For production: associate the label with the input via `id`/`htmlFor` (currently the `MonoLine` label is not programmatically linked), move styling to `data-slot`, add focus styling (only `outline: none` is set), and consider passing the raw event rather than the string for flexibility. `fontSize: 16` is deliberately set to avoid iOS zoom-on-focus — keep it.

## Source snippet

```jsx
function MoField({ label, value, onChange, prefix }) {
  return (
    <div>
      <MonoLine style={{ marginBottom: 7 }}>{label}</MonoLine>
      <div style={{ display: "flex", alignItems: "stretch" }}>
        {prefix && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "0 10px",
              fontFamily: "var(--w-mono)",
              fontSize: 12.5,
              color: "var(--w-ink-soft)",
              border: "2px solid var(--w-ink)",
              borderRight: "none",
              borderRadius: "var(--w-r) 0 0 var(--w-r)",
              background: "var(--w-paper-2)",
              whiteSpace: "nowrap",
            }}
          >
            {prefix}
          </span>
        )}
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: "100%",
            padding: "12px 14px",
            fontSize: 16,
            fontFamily: "var(--w-mono)",
            color: "var(--w-ink)",
            background: "var(--w-paper)",
            border: "2px solid var(--w-ink)",
            borderRadius: prefix ? "0 var(--w-r) var(--w-r) 0" : "var(--w-r)",
            outline: "none",
          }}
        />
      </div>
    </div>
  )
}
```
