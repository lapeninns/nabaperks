# McCounter

- **Surface:** merchant (stage view — the `counter` tab of the `app` stage)
- **Source module:** [extracted-source/20-merchant-core.jsx](../../extracted-source/20-merchant-core.jsx) (lines 413–452)
- **Export:** none (rendered by `MerchantSurface`; not on `window`)
- **Reuse verdict:** 🔒 Prototype-only (hardcoded counts/feed, local-only simulate button, PIN-handshake copy contradicts current v3 design)

## Visual purpose

The "Counter mode" screen meant to be pinned on a till-side device: an inverted (ink background, paper text) panel showing today's stamp count in a huge display number, a pill with the last event, and a one-line instruction. A `DemoTag` below lets you "Simulate a stamp" to watch the number tick up.

## Props / state

| Prop | Type              | Default | Notes                                                             |
| ---- | ----------------- | ------- | ----------------------------------------------------------------- |
| `t`  | `object` (tweaks) | —       | Reads `t.mo` (motion multiplier) for the count `w-pop` animation. |

**State:** `const [extra, setExtra] = useStateMc(0)` — number of simulated stamps added this session.

Derived: `count = 14 + extra`; `sims` (a fixed 3-entry array of fake events); `last` = the seed "LAST: ASHA K. · 11:41 · STAMP 3/3" when `extra === 0`, otherwise `"LAST: " + sims[(extra - 1) % sims.length]` (cycles the three sims).

## UX behaviour

- The big count is keyed on `count` (`key={count}`) so each increment re-mounts and replays `w-pop`.
- "Simulate a stamp" `DemoTag` increments `extra`, bumping the count and rotating the `last` pill through the three canned events.
- **Prototype-isms:** the starting count `14`, the `sims` strings, and the green status dot are all hardcoded; there is no live data and no server. The instructional copy describes a _handed-phone staff-PIN_ handshake ("Customers hand you their phone with the PIN pad already open. Type today's PIN"), which is the **older** model — the current production v3 design replaced the shared staff PIN with a counter handshake (code → paired station). Treat this copy as out of date.

## Dependencies

- **Shared primitives:** `MonoLine`, `DemoTag`.
- **CSS variables:** `--w-ink`, `--w-paper`, `--w-mono`, `--w-display`, `--w-leaf`; plus the literal `rgba(246,241,230,…)` (a paper-tint used for muted text on the dark panel).
- **Keyframes:** `w-rise` (entrance), `w-pop` (count change, `360 * mo` ms).
- **localStorage:** none.
- **Globals / window:** reads shared primitives from `window`; receives `t` from `MerchantSurface`. Not itself exported.

## Reuse notes

Prototype-only: counts and feed are canned, the simulate button is a demo affordance, and the copy reflects the retired staff-PIN handshake rather than the current paired-station model. The inverted "counter display" panel (huge display number, status pill, pin-this-tab framing) is a strong Wet Ink reference worth keeping. For production: feed `count`/`last` from live `stamp_events`, rewrite the instruction to the current counter-handshake flow, replace the hardcoded `rgba(246,241,230,…)` tints with a token, and drop the `DemoTag`.

## Source snippet

```jsx
function McCounter({ t }) {
  const mo = t.mo
  const [extra, setExtra] = useStateMc(0)
  const sims = [
    "DAN W. · JUST NOW · STAMP 1/3",
    "S. B. · JUST NOW · STAMP 2/3",
    "R. O. · JUST NOW · STAMP 3/3 — SEAL BREAKS",
  ]
  const last =
    extra === 0
      ? "LAST: ASHA K. · 11:41 · STAMP 3/3"
      : "LAST: " + sims[(extra - 1) % sims.length]
  const count = 14 + extra
  return (
    <div
      style={{ animation: `w-rise ${380 * mo}ms cubic-bezier(0.2,0,0,1) both` }}
    >
      <div
        style={{
          background: "var(--w-ink)",
          color: "var(--w-paper)",
          border: "2px solid var(--w-ink)",
          borderRadius: 16,
          padding: "34px 30px",
          textAlign: "center",
        }}
      >
        <MonoLine style={{ color: "rgba(246,241,230,0.55)" }}>
          Counter mode · pin this tab
        </MonoLine>
        <div
          style={{
            fontFamily: "var(--w-mono)",
            fontSize: 15,
            margin: "16px 0 4px",
            color: "rgba(246,241,230,0.55)",
          }}
        >
          STAMPS TODAY
        </div>
        <div
          key={count}
          style={{
            fontSize: 110,
            fontWeight: 800,
            lineHeight: 1,
            fontFamily: "var(--w-display)",
            animation: `w-pop ${360 * mo}ms cubic-bezier(0.16,1.2,0.3,1) both`,
          }}
        >
          {count}
        </div>
        <div
          style={{
            display: "inline-flex",
            gap: 10,
            alignItems: "center",
            margin: "22px 0",
            border: "2px solid rgba(246,241,230,0.3)",
            borderRadius: 999,
            padding: "8px 18px",
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "var(--w-leaf)",
            }}
          ></span>
          <span style={{ fontFamily: "var(--w-mono)", fontSize: 12.5 }}>
            {last}
          </span>
        </div>
        <p
          style={{
            fontSize: 15,
            color: "rgba(246,241,230,0.7)",
            maxWidth: "38ch",
            margin: "0 auto",
          }}
        >
          Customers hand you their phone with the PIN pad already open. Type
          today's PIN — that's the whole job.
        </p>
      </div>
      <div style={{ textAlign: "center", marginTop: 16 }}>
        <DemoTag onClick={() => setExtra(extra + 1)}>Simulate a stamp</DemoTag>
      </div>
    </div>
  )
}
```
