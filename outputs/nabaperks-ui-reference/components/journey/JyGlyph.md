# JyGlyph

- **Surface:** journey (storyboard building block)
- **Source module:** [extracted-source/60-journey.jsx](../../extracted-source/60-journey.jsx) (component lines 145–157; `JY_GLYPHS` dictionary lines 7–143)
- **Export:** not exported (module-local; used internally by `JyStepCard`)
- **Reuse verdict:** ⚠️ Reusable, needs refactor (inline styles, hardcoded sizes, glyph dictionary as a module-level object literal)

## Visual purpose

A tiny "screen glyph" chip used inside each storyboard step card: a 34×27px paper-coloured, hard-bordered (1.5px ink) box with rounded corners, containing a centred 20×16 inline-SVG pictogram that hints at the kind of screen the card links to (a form, a QR code, a stamp, a gift, a calendar, etc.). It is the storyboard's iconography — a miniature illustration of the destination surface.

## Props / state

| Prop   | Type                                 | Default | Notes                                                                                                           |
| ------ | ------------------------------------ | ------- | --------------------------------------------------------------------------------------------------------------- | --- | ----------------- |
| `kind` | string (one of the `JY_GLYPHS` keys) | —       | Looked up in the `JY_GLYPHS` dictionary; falls back to `JY_GLYPHS.form` if the key is missing (`JY_GLYPHS[kind] |     | JY_GLYPHS.form`). |

**State:** none (pure presentational).

## UX behaviour

- Static. No hover, press, or animation of its own — its parent (`JyStepCard`) handles all interaction.
- The outer `<span>` is `display: "inline-grid"` with `placeItems: "center"` and `flexShrink: 0`, so the chip keeps a fixed 34×27 footprint and centres its SVG.
- The SVG renders with `fill="none"`, `stroke="var(--w-ink)"`, `strokeWidth="1.5"`, `strokeLinecap="round"`, `strokeLinejoin="round"` — a uniform line-drawing treatment. Individual glyphs in the dictionary occasionally override `fill`/`stroke` locally (e.g. solid `var(--w-ink)` dots in `feed`, filled rects in `qr`).

## Glyph dictionary

`JY_GLYPHS` (lines 7–143) is the glyph dictionary — a module-level object literal mapping a `kind` string to a piece of inline SVG geometry (a single `<path>` or a `<g>` group). All paths are drawn against a 20×16 viewBox. The keys verbatim, in source order:

`form`, `steps`, `qr`, `dash`, `feed`, `people`, `key`, `pound`, `till`, `phone`, `spark`, `stamp`, `save`, `card`, `seal`, `gift`, `clock`, `check`, `calendar`, `tab`, `hand`, `lock`, `shield`, `pulse`, `rows`, `sync`, `scroll`, `flag`, `home`, `tag`, `scale`.

Notes on a few non-trivial glyphs:

- `qr` — a `<g fill="var(--w-ink)" stroke="none">` of filled `rect`s (the three finder-pattern squares plus two small modules), so it reads as a solid QR mark rather than an outline.
- `pound` — an SVG `<text>` element rendering the literal `£` glyph in `var(--w-mono)`, `fontSize="13"`, `fontWeight="700"`.
- `seal` — a circle plus an SVG `<text>` rendering `?` in `var(--w-display)`, `fontWeight="800"` (the "mystery sealed in wax" motif).
- `feed` — three filled `circle` bullets plus stroked text-rule paths.
- `calendar` — a stroked calendar frame plus one filled `rect` (the marked day).
- `tag` — a stroked tag outline plus a filled `circle` (the eyelet).
- `hand` — uses an SVG `transform="rotate(-12 7 8.5)"` on the rounded rect (a tilted phone being handed over) alongside an arrow path.

## Dependencies

- **Shared primitives:** none.
- **CSS variables:** `--w-ink` (stroke and several glyph fills), `--w-paper` (chip background), `--w-mono` (the `pound` `£` text), `--w-display` (the `seal` `?` text).
- **Keyframes:** none.
- **localStorage:** none.
- **Globals / window:** reads `React` only (no `window.*` read or write; `JyGlyph` is not assigned to `window`).

## Reuse notes

The glyph set is a genuinely portable, self-contained icon vocabulary and worth preserving verbatim as a reference for the journey/storyboard surface. Note: this is a parallel icon system to the production `@hugeicons` brand `Icon` wrapper — it would not survive into production unchanged. For reuse: (1) the dictionary should become an icon module (one named export per glyph, or a typed `Record<GlyphKind, ReactNode>`) so `kind` is type-checked instead of falling back silently to `form`; (2) chip dimensions (34×27, 20×16 viewBox, 1.5px border) and colours should move to the token/`data-slot` layer rather than inline objects; (3) consider mapping these onto the existing `@hugeicons` set per `DESIGN.md` rather than carrying a second SVG vocabulary.

## Source snippet

```jsx
const JY_GLYPHS = {
  form: <path d="M3 3.5h14M3 8h10M3 12.5h7" />,
  steps: <path d="M2 13.5h4.5v-4H11v-4h4.5V2.5" />,
  qr: (
    <g fill="var(--w-ink)" stroke="none">
      <rect x="3" y="2" width="5" height="5" rx="1" />
      <rect x="12" y="2" width="5" height="5" rx="1" />
      <rect x="3" y="9" width="5" height="5" rx="1" />
      <rect x="12" y="9" width="2.2" height="2.2" />
      <rect x="14.8" y="11.8" width="2.2" height="2.2" />
    </g>
  ),
  // … dash, feed, people, key, pound, till, phone, spark, stamp, save, card,
  //    seal, gift, clock, check, calendar, tab, hand, lock, shield, pulse,
  //    rows, sync, scroll, flag, home, tag, scale [trimmed — see lines 19–142]
}

function JyGlyph({ kind }) {
  return (
    <span
      style={{
        width: 34,
        height: 27,
        flexShrink: 0,
        border: "1.5px solid var(--w-ink)",
        borderRadius: 4,
        background: "var(--w-paper)",
        display: "inline-grid",
        placeItems: "center",
      }}
    >
      <svg
        width="20"
        height="16"
        viewBox="0 0 20 16"
        style={{ display: "block" }}
        fill="none"
        stroke="var(--w-ink)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {JY_GLYPHS[kind] || JY_GLYPHS.form}
      </svg>
    </span>
  )
}
```
