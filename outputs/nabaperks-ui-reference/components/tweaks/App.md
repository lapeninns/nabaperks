# App

- **Surface:** tweaks (omelette-starter scaffold — demo harness, NOT the real Nabaperks app shell)
- **Source module:** [extracted-source/00-tweaks-panel.jsx](../../extracted-source/00-tweaks-panel.jsx) (lines 16–49, inside the `/* BEGIN USAGE */ … /* END USAGE */` comment block)
- **Export:** none — `App` is **not defined as live code** in this module. It exists only as a commented USAGE example.
- **Reuse verdict:** 🔒 Prototype-only (scaffold/demo harness; documentation example, not exported code)

## Visual purpose

There is **no live `App` component** in `00-tweaks-panel.jsx`. The only `App` here is a worked example inside the top USAGE comment, demonstrating how a host prototype wires `useTweaks` to a `TweaksPanel` full of control helpers. It is scaffold/demo material: it shows the intended consumer shape (read `t` for styling, call `setTweak` from each control), nothing more. The top-of-file banner — `// @ds-adherence-ignore -- omelette starter scaffold (raw elements/hex/px by design)` — flags the whole module (and therefore this example) as a tooling layer, not a Wet-Ink surface.

This file is intentionally short because the component is trivial/illustrative: it is a copy-paste starter, not a shipped shell.

## Props / state

| Prop | Type | Default | Notes                                  |
| ---- | ---- | ------- | -------------------------------------- |
| —    | —    | —       | `App()` in the example takes no props. |

**State:** `const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);` — the example's only state, sourced entirely from the `useTweaks` hook (documented in [TweaksPanel.md](TweaksPanel.md)). `t` is the live tweak-values object; `setTweak` mutates it.

## UX behaviour

- Reads tweak values off `t` and applies them directly as inline styles on the root element: `style={{ fontSize: t.fontSize, color: t.primaryColor }}`.
- Renders a `<TweaksPanel>` whose children are control helpers, each wired `onChange={(v) => setTweak('<key>', v)}` so edits flow back into `t` and re-render the surface.
- Demonstrates the curated-options conventions called out in the USAGE prose: `TweakRadio` for 2–3 short options, `TweakColor` with 3–4 curated swatches (or a whole palette array as a single option), `TweakToggle` for booleans.
- The `TWEAK_DEFAULTS` literal is wrapped in `/*EDITMODE-BEGIN*/ … /*EDITMODE-END*/` markers — the host rewrites the JSON inside these markers on disk when tweaks are persisted (see Flow & state in TweaksPanel.md).

## Dependencies

- **Shared primitives:** `useTweaks`, `TweaksPanel`, `TweakSection`, `TweakSlider`, `TweakRadio`, `TweakColor`, `TweakToggle` (all from this same module, all exposed on `window`).
- **CSS variables:** none — this scaffold uses **raw hex/px by design** (per the `@ds-adherence-ignore` banner), not the `--w-*` tokens. The example styles with literal hex such as `#D97757`, `#29261b`, `#f6f4ef`, `#2A6FDB`, `#1F8A5B`, `#7A5AE0` and raw px (`fontSize: 16`).
- **Keyframes:** none.
- **localStorage:** none directly (persistence is delegated to the host via postMessage — see TweaksPanel.md).
- **Globals / window:** the example assumes `React` is loaded globally (React + in-browser Babel, no build) and that the Tweak\* helpers are already on `window`.

## Reuse notes

Not reusable as a component — it is a documentation example, not exported code, and is a scaffold/demo harness rather than the production Nabaperks app shell. Its value is purely instructional: it is the canonical wiring pattern for consuming `useTweaks` + `TweaksPanel`. Note the scaffold-isms it normalises: raw hex/px literals (deliberate, per `@ds-adherence-ignore`), `TWEAK_DEFAULTS` fenced by `/*EDITMODE-*/` host-rewrite markers, and reliance on the `window`-exported helpers rather than ES module imports.

## Source snippet

```jsx
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
```
