# MerchantCustomers

- **Surface:** merchant (full screen — privacy-first customer readback)
- **Source module:** [extracted-source/21-merchant-ops.jsx](../../extracted-source/21-merchant-ops.jsx) (lines 231–277)
- **Export:** `window.MerchantCustomers` (via `Object.assign(window, …)` at module foot)
- **Reuse verdict:** 🔒 Prototype-only (hardcoded `MO_CUSTOMERS` list, masked-phone strings baked in, global export). The table layout and `MoMiniStamps`/`MonoTag` row pattern are reusable.

## Visual purpose

A read-only members table inside `MerchantSurface`. `MoHead` titled "Customers" with a "readback only" sub and an "Initials only · phones stay hashed" `MonoTag`. A single `ReceiptCard` holds a five-column grid: a rotated initials avatar + name + masked phone, joined date, `MoMiniStamps`, last-visit (emphasised if "Today"), and a `MonoTag` reward-state badge. A privacy footnote plus a `DemoTag` that jumps into the customer-facing card close it out.

## Props / state

| Prop | Type                      | Notes                                                                       |
| ---- | ------------------------- | --------------------------------------------------------------------------- |
| `t`  | theme object              | Reads `t.mo` (motion multiplier, used for screen `w-rise` + `ReceiptCard`). |
| `go` | `(screen, state) => void` | Navigation fn from the host. Called as `go("Customer", "ready")`.           |

**State (local):** none. `cols` is a `const` grid-template string: `"minmax(170px, 1.5fr) 80px minmax(120px, 1fr) minmax(105px, 1fr) minmax(125px, 1fr)"`.

## UX behaviour & navigation

- **"Open Asha's card as the customer"** (`DemoTag`) → `go("Customer", "ready")` — hands off to the customer-web card flow in the "reward ready" state.
- Initials avatar derives from the name: `c.name.split(" ").map((w) => w[0]).join("").replace(/\./g, "")` (so "Asha K." → "AK", "R. O." → "RO").
- Last-visit text colour: `c.visit.startsWith("Today") ? "var(--w-ink)" : "var(--w-ink-soft)"`.
- Reward-state badge tone comes from `c.tone` (`"accent" | "ink" | "plain"`).
- Screen wrapper `w-rise` entrance; `data-screen-label="Merchant · Customers"`.

## Hardcoded demo data

**`MO_CUSTOMERS`** (lines 221–229) — seven members, verbatim:

```jsx
const MO_CUSTOMERS = [
  {
    name: "Asha K.",
    phone: "07··· ···48",
    joined: "27 May",
    stamps: 3,
    visit: "Today 11:42",
    state: "Reward ready",
    tone: "accent",
  },
  {
    name: "Priya S.",
    phone: "07··· ···21",
    joined: "Today",
    stamps: 1,
    visit: "Today 09:51",
    state: "New today",
    tone: "ink",
  },
  {
    name: "Tom R.",
    phone: "07··· ···89",
    joined: "8 Jun",
    stamps: 2,
    visit: "Today 10:18",
    state: "Collecting",
    tone: "plain",
  },
  {
    name: "Dan W.",
    phone: "07··· ···52",
    joined: "14 May",
    stamps: 0,
    visit: "Yesterday",
    state: "Redeemed 11 Jun",
    tone: "plain",
  },
  {
    name: "R. O.",
    phone: "07··· ···34",
    joined: "30 May",
    stamps: 2,
    visit: "Tue 9 Jun",
    state: "Collecting",
    tone: "plain",
  },
  {
    name: "S. B.",
    phone: "07··· ···17",
    joined: "2 Jun",
    stamps: 1,
    visit: "Mon 8 Jun",
    state: "Collecting",
    tone: "plain",
  },
  {
    name: "J. P.",
    phone: "07··· ···73",
    joined: "19 May",
    stamps: 1,
    visit: "21 May",
    state: "Gone quiet",
    tone: "plain",
  },
]
```

Header labels (line 243): `["Member", "Joined", "Stamps", "Last visit", "Reward"]`. The `MoHead` sub claims "7 members" — matches the list length but is itself a literal string.

## Dependencies

- **Local sub-primitives:** `MoHead`, `MoMiniStamps`.
- **Shared primitives (window):** `ReceiptCard`, `MonoTag`, `MonoLine`, `DemoTag`.
- **CSS variables:** `--w-paper-2`, `--w-ink`, `--w-ink-soft`, `--w-mono`.
- **Keyframes:** `w-rise` (screen entrance).
- **localStorage:** none.
- **Globals / window:** reads `React` (`useStateMo`); writes `window.MerchantCustomers`.
- **Mocks:** none beyond the static data — no timers, no network.

## Reuse notes

The privacy-first framing (initials + masked phone, "phones stay hashed", "exports live with the account owner", no marketing without opt-in) is a strong reference for the real readback screen. To productionise: feed from a real merchant readback query, derive avatars/states server-side, drop the demo `go` hand-off, and export properly. The masked-phone format `07··· ···NN` is a useful display convention to preserve.

## Source snippet

```jsx
function MerchantCustomers({ t, go }) {
  const mo = t.mo
  const cols =
    "minmax(170px, 1.5fr) 80px minmax(120px, 1fr) minmax(105px, 1fr) minmax(125px, 1fr)"
  return (
    <div
      data-screen-label="Merchant · Customers"
      style={{ animation: `w-rise ${380 * mo}ms cubic-bezier(0.2,0,0,1) both` }}
    >
      <MoHead
        title="Customers"
        sub="7 members · readback only"
        right={
          <MonoTag tone="plain">Initials only · phones stay hashed</MonoTag>
        }
      />
      <ReceiptCard mo={mo} style={{ maxWidth: 860 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: cols,
            gap: 12,
            paddingBottom: 9,
          }}
        >
          {["Member", "Joined", "Stamps", "Last visit", "Reward"].map((h) => (
            <MonoLine key={h} style={{ fontSize: 10, fontWeight: 700 }}>
              {h}
            </MonoLine>
          ))}
        </div>
        {MO_CUSTOMERS.map((c) => (
          <div
            key={c.name}
            style={{
              display: "grid",
              gridTemplateColumns: cols,
              gap: 12,
              alignItems: "center",
              padding: "11px 0",
              borderTop: "2px dashed var(--w-line)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                minWidth: 0,
              }}
            >
              <span
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  flexShrink: 0,
                  background: "var(--w-paper-2)",
                  border: "2px solid var(--w-ink)",
                  display: "inline-grid",
                  placeItems: "center",
                  transform: "rotate(-6deg)",
                  fontFamily: "var(--w-mono)",
                  fontSize: 10.5,
                  fontWeight: 700,
                }}
              >
                {c.name
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .replace(/\./g, "")}
              </span>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 14.5,
                    whiteSpace: "nowrap",
                  }}
                >
                  {c.name}
                </div>
                <div
                  style={{
                    fontFamily: "var(--w-mono)",
                    fontSize: 10,
                    color: "var(--w-ink-soft)",
                  }}
                >
                  {c.phone}
                </div>
              </div>
            </div>
            <span style={{ fontFamily: "var(--w-mono)", fontSize: 12 }}>
              {c.joined}
            </span>
            <MoMiniStamps current={c.stamps} />
            <span
              style={{
                fontFamily: "var(--w-mono)",
                fontSize: 12,
                color: c.visit.startsWith("Today")
                  ? "var(--w-ink)"
                  : "var(--w-ink-soft)",
              }}
            >
              {c.visit}
            </span>
            <div>
              <MonoTag tone={c.tone} style={{ fontSize: 9.5 }}>
                {c.state}
              </MonoTag>
            </div>
          </div>
        ))}
      </ReceiptCard>
      <div
        style={{
          display: "flex",
          gap: 14,
          alignItems: "center",
          marginTop: 16,
          flexWrap: "wrap",
        }}
      >
        <MonoLine style={{ fontSize: 10 }}>
          No marketing without a separate opt-in · exports live with the account
          owner
        </MonoLine>
        <DemoTag onClick={() => go("Customer", "ready")}>
          Open Asha's card as the customer
        </DemoTag>
      </div>
    </div>
  )
}
```
