# McField

- **Surface:** merchant (module-local helper)
- **Source module:** [extracted-source/20-merchant-core.jsx](../../extracted-source/20-merchant-core.jsx) (lines 120–129)
- **Export:** none (module-local; not on `window`)
- **Reuse verdict:** ⚠️ Reusable, needs refactor (uncontrolled label, inline `MC_INPUT` style spread, no `<label>`/`id` association)

## Visual purpose

The standard labelled text input for merchant forms: a `MonoLine` caption above a hard-bordered mono input (the shared `MC_INPUT` style). Used for the auth venue email and the onboarding venue-name / city fields.

## Props / state

| Prop          | Type                      | Default | Notes                                                           |
| ------------- | ------------------------- | ------- | --------------------------------------------------------------- |
| `label`       | `ReactNode`               | —       | Rendered in a `MonoLine` above the input.                       |
| `value`       | `string`                  | —       | Controlled input value.                                         |
| `onChange`    | `(value: string) => void` | —       | Receives the raw string (`e.target.value`), not the event.      |
| `placeholder` | `string`                  | —       | Native placeholder.                                             |
| `inputStyle`  | `CSSProperties`           | —       | Spread after `MC_INPUT`, so callers can override input styling. |

**State:** none (fully controlled by the parent).

## UX behaviour

- Pure controlled input; `onChange` is called with the unwrapped string value.
- Base input styling comes from the module-level `MC_INPUT` constant (full-width, `14px 16px` padding, mono font, ink border, paper background); `inputStyle` overrides it.

## Dependencies

- **Shared primitives:** `MonoLine`.
- **CSS variables:** via `MC_INPUT` — `--w-mono`, `--w-ink`, `--w-paper`, `--w-r`.
- **Keyframes:** none.
- **localStorage:** none.
- **Globals / window:** reads `MonoLine` from `window`; references the module-local `MC_INPUT` constant. Not itself exported.

## Reuse notes

Faithful Wet Ink field. For production: associate the label with the input via `htmlFor`/`id` (currently the `MonoLine` is not a real `<label>`, an accessibility gap), move `MC_INPUT` into the token layer, and consider passing the event rather than the unwrapped value if you need richer handlers. The mono-input visual treatment is portable.

## Source snippet

```jsx
function McField({ label, value, onChange, placeholder, inputStyle }) {
  return (
    <div>
      <MonoLine style={{ marginBottom: 8 }}>{label}</MonoLine>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...MC_INPUT, ...inputStyle }}
      />
    </div>
  )
}
```

The shared input style (`MC_INPUT`, lines 35–40) consumed above, verbatim:

```jsx
const MC_INPUT = {
  width: "100%",
  padding: "14px 16px",
  fontSize: 18,
  fontFamily: "var(--w-mono)",
  color: "var(--w-ink)",
  background: "var(--w-paper)",
  border: "2px solid var(--w-ink)",
  borderRadius: "var(--w-r)",
  outline: "none",
}
```
