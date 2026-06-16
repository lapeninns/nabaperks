# MerchantActivity

- **Surface:** merchant (full screen — Activity feed)
- **Source module:** [extracted-source/21-merchant-ops.jsx](../../extracted-source/21-merchant-ops.jsx) (lines 164–215)
- **Export:** `window.MerchantActivity` (via `Object.assign(window, …)` at module foot)
- **Reuse verdict:** 🔒 Prototype-only (hardcoded demo feed, in-memory "simulate live event", motion multiplier, global export). The component shapes (`MoHead`, `ReceiptCard`, `MoEventRow`, `MoChip`) are reusable; this screen as wired is a demo.

## Visual purpose

The merchant's counter activity feed, rendered inside `MerchantSurface`. A `MoHead` with a live event count and a "Simulate a live event" `DemoTag`, a row of category filter `MoChip`s, then day-grouped `ReceiptCard`s of `MoEventRow`s. Empty state and a privacy/retention footnote round it off.

## Props / state

| Prop | Type                  | Notes                                                                    |
| ---- | --------------------- | ------------------------------------------------------------------------ |
| `t`  | theme object          | Reads `t.mo` (motion-speed multiplier).                                  |
| `go` | `(screen, …) => void` | Navigation fn from the host. **Received but not called** in this screen. |

**State (local):**

- `const [filter, setFilter] = useStateMo("all")` — active category filter id.
- `const [live, setLive] = useStateMo([])` — array of simulated live events prepended to "today".

**Derived:** `groups` (today gets `[...live, ...g.items]`, then every group filtered by `filter`, empties dropped) and `total` (sum of all `MO_EVENTS` items + `live.length`).

## UX behaviour & navigation

- **Simulate a live event** (`DemoTag`): prepends `{ ...MO_SIM[l.length % MO_SIM.length], live: true }` to `live` — cycles through three canned `MO_SIM` events, each animating in via `w-rise` (the `live` flag on `MoEventRow`).
- Filter chips: clicking sets `filter`; `"all"` shows everything, otherwise matches `ev.cat`.
- `go` is **not** invoked anywhere in this screen.
- Screen wrapper animates in: `animation: w-rise ${380 * mo}ms cubic-bezier(0.2,0,0,1) both`. Carries `data-screen-label="Merchant · Activity"`.

## Hardcoded demo data

**`MO_FILTERS`** (lines 105–108):

```jsx
const MO_FILTERS = [
  { id: "all", label: "All" },
  { id: "stamp", label: "Stamps" },
  { id: "reward", label: "Rewards" },
  { id: "join", label: "Joins" },
  { id: "redeem", label: "Redemptions" },
  { id: "system", label: "System" },
]
```

**`MO_EVENTS`** (lines 110–136) — three day-groups ("Today · Thu 12 Jun", "Yesterday · Wed 11 Jun", "Earlier this week") of event objects `{ cat, time, text, sub }`. **`MO_SIM`** (lines 138–142) — three canned live events. **`MO_DOT`** (lines 100–103) — the `cat → colour` map consumed by `MoEventRow`. Full verbatim copy in the aggregation `Copy strings` and `Flow & state` sections.

## Dependencies

- **Local sub-primitives:** `MoHead`, `MoChip`, `MoEventRow` (consumes `MO_DOT`).
- **Shared primitives (window):** `ReceiptCard`, `MonoLine`, `DemoTag`.
- **CSS variables:** `--w-ink`, `--w-ink-soft`, `--w-line`, `--w-r`, plus the `MO_DOT` palette (`--w-accent`, `--w-sun`, `--w-cobalt`, `--w-leaf`).
- **Keyframes:** `w-rise` (screen entrance + live rows).
- **localStorage:** none.
- **Globals / window:** reads `React` (`useStateMo` = `React.useState`); writes `window.MerchantActivity`.
- **Mocks:** "Simulate a live event" is purely client-side state — no network. No `Date.now`/`setTimeout` in this screen.

## Reuse notes

The feed layout, filter chips, day grouping and privacy footnote are all worth keeping as patterns. To productionise: replace `MO_EVENTS`/`MO_SIM` with real `product_events`/`stamp_events` data, drop the simulate button, remove the `mo` multiplier in favour of motion tokens + `prefers-reduced-motion`, and export properly rather than via `window`. Note the staff-PIN copy in the data ("approved with the staff PIN", "Staff PIN rotated overnight") reflects the prototype's PIN model; the live product uses a counter handshake instead — treat that copy as prototype-era.

## Source snippet

```jsx
function MerchantActivity({ t, go }) {
  const mo = t.mo
  const [filter, setFilter] = useStateMo("all")
  const [live, setLive] = useStateMo([])

  const groups = MO_EVENTS.map((g, gi) => ({
    ...g,
    items: gi === 0 ? [...live, ...g.items] : g.items,
  }))
    .map((g) => ({
      ...g,
      items: g.items.filter((ev) => filter === "all" || ev.cat === filter),
    }))
    .filter((g) => g.items.length > 0)

  const total = MO_EVENTS.reduce((n, g) => n + g.items.length, 0) + live.length

  return (
    <div
      data-screen-label="Merchant · Activity"
      style={{ animation: `w-rise ${380 * mo}ms cubic-bezier(0.2,0,0,1) both` }}
    >
      <MoHead
        title="Activity"
        sub={`This week at the counter · ${total} events`}
        right={
          <DemoTag
            onClick={() =>
              setLive((l) => [
                { ...MO_SIM[l.length % MO_SIM.length], live: true },
                ...l,
              ])
            }
          >
            Simulate a live event
          </DemoTag>
        }
      />
      <div
        style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 20 }}
      >
        {MO_FILTERS.map((f) => (
          <MoChip
            key={f.id}
            active={filter === f.id}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </MoChip>
        ))}
      </div>
      <div style={{ display: "grid", gap: 22, maxWidth: 720 }}>
        {groups.map((g) => (
          <ReceiptCard key={g.day} mo={mo}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
              }}
            >
              <MonoLine style={{ fontWeight: 700, color: "var(--w-ink)" }}>
                {g.day}
              </MonoLine>
              <MonoLine style={{ fontSize: 10 }}>
                {g.items.length} {g.items.length === 1 ? "event" : "events"}
              </MonoLine>
            </div>
            <div style={{ marginTop: 8 }}>
              {g.items.map((ev, i) => (
                <MoEventRow
                  key={g.day + i + ev.text}
                  ev={ev}
                  first={i === 0}
                  mo={mo}
                  live={ev.live}
                />
              ))}
            </div>
          </ReceiptCard>
        ))}
        {groups.length === 0 && (
          <div
            style={{
              border: "2px dashed var(--w-line)",
              borderRadius: "var(--w-r)",
              padding: "26px 22px",
              textAlign: "center",
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 15 }}>
              Nothing in this lane yet.
            </div>
            <div
              style={{ fontSize: 13, color: "var(--w-ink-soft)", marginTop: 4 }}
            >
              It fills up as the counter hums.
            </div>
          </div>
        )}
        <MonoLine style={{ fontSize: 10, textAlign: "center" }}>
          Events keep for 12 months · customers appear as initials beyond your
          own till
        </MonoLine>
      </div>
    </div>
  )
}
```
