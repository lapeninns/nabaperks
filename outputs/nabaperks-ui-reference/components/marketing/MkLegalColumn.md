# MkLegalColumn

- **Surface:** marketing (content sub-component)
- **Source module:** [extracted-source/50-marketing.jsx](../../extracted-source/50-marketing.jsx) (lines 129–149)
- **Export:** none (module-local function, rendered twice by `MkLegal` with `MK_TERMS` / `MK_PRIVACY`)
- **Reuse verdict:** ⚠️ Reusable, needs refactor (inline styles, rotation as a prop, hard-coded footer line, data-driven rows)

## Visual purpose

One of the two "plain-English" legal receipts. A tilted `ReceiptCard` with a display-type title and a mono catalogue number (`Nº T-2026` / `Nº P-2026`) on the same baseline, then a list of `[heading, body]` rows each preceded by a dashed `ReceiptRule`. A closing rule and a small mono footnote anchor it as a receipt.

## Props / state

| Prop    | Type                                                      | Default | Notes                                                                                                                                                                                        |
| ------- | --------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data`  | `{ title: string; no: string; rows: [string, string][] }` | —       | A legal copy object — `MK_TERMS` or `MK_PRIVACY` (see "Legal copy" in [MkLegal.md](MkLegal.md)). `rows` is an array of `[heading, body]` pairs, each `heading` also used as the React `key`. |
| `mo`    | `number`                                                  | —       | Motion multiplier (`t.mo`), passed through to `ReceiptCard`.                                                                                                                                 |
| `angle` | `number`                                                  | —       | Degrees of `rotate(...)` on the outer wrapper (`-0.8` for terms, `0.9` for privacy).                                                                                                         |

**State:** none.

## UX behaviour

- Static; entrance/motion is owned by `ReceiptCard mo={mo}`.
- Title + `data.no` share a `justifyContent: "space-between"`, `alignItems: "baseline"` header.
- Rows are mapped with a leading `ReceiptRule` (`margin: "13px 0"`); heading is a bold ink `MonoLine`, body a soft-ink paragraph (`fontSize: 14`, `lineHeight: "21px"`).
- Closing `ReceiptRule` (`margin: "14px 0 10px"`) then a fixed mono footnote: `Full text travels with your merchant agreement`.

## Dependencies

- **Shared primitives:** `ReceiptCard`, `ReceiptRule`, `MonoLine` (all on `window`).
- **CSS variables:** `--w-display`, `--w-ink`, `--w-ink-soft`.
- **Keyframes:** none directly (entrance belongs to `ReceiptCard`).
- **localStorage:** none.
- **Globals / window:** reads the three shared primitives. Not exported.

## Reuse notes

A clean data-driven legal/spec card. For production: (1) inline styles → token layer; (2) `angle` should be the container's choice, not part of the component's contract; (3) the footnote copy is hard-coded inside the component — it should be part of the `data` object or a prop so the card is content-agnostic; (4) semantic markup (`<dl>`/`<dt>`/`<dd>` for heading/body pairs) would improve accessibility. The `{ title, no, rows: [[h, body], …] }` shape is reusable for any "condensed terms" layout.

## Source snippet

```jsx
function MkLegalColumn({ data, mo, angle }) {
  return (
    <div style={{ transform: `rotate(${angle}deg)` }}>
      <ReceiptCard mo={mo}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
          }}
        >
          <div
            style={{
              fontWeight: 800,
              fontSize: 22,
              fontFamily: "var(--w-display)",
            }}
          >
            {data.title}
          </div>
          <MonoLine style={{ fontSize: 10 }}>{data.no}</MonoLine>
        </div>
        {data.rows.map(([h, body], i) => (
          <div key={h}>
            <ReceiptRule style={{ margin: "13px 0" }} />
            <MonoLine
              style={{
                color: "var(--w-ink)",
                fontWeight: 700,
                marginBottom: 5,
              }}
            >
              {h}
            </MonoLine>
            <p
              style={{
                margin: 0,
                fontSize: 14,
                lineHeight: "21px",
                color: "var(--w-ink-soft)",
              }}
            >
              {body}
            </p>
          </div>
        ))}
        <ReceiptRule style={{ margin: "14px 0 10px" }} />
        <MonoLine style={{ fontSize: 9.5 }}>
          Full text travels with your merchant agreement
        </MonoLine>
      </ReceiptCard>
    </div>
  )
}
```
