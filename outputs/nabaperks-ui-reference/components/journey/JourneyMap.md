# JourneyMap

- **Surface:** journey (the full-flow storyboard and front door)
- **Source module:** [extracted-source/60-journey.jsx](../../extracted-source/60-journey.jsx) (component lines 329–415; `JY_LANES` data lines 161–219)
- **Export:** `window.JourneyMap` (global, via `Object.assign(window, { JourneyMap })` at line 418). Stateless storyboard — **no `Entry` export** (it is the index, not a routed surface with its own entry point).
- **Reuse verdict:** 🔒 Prototype-only (storyboard/demo front door: `localStorage` flow-reset, `setTimeout` toasts, motion-factor scaling, hardcoded demo cast/date/copy, `window` navigation wiring)

## Visual purpose

The "whole loop on one table" — a single-screen storyboard that lays out every surface of Nabaperks v2 (Merchant, Customer, Staff, Admin, Marketing) as horizontal swimlanes of tappable cards, with cross-surface tie-strips threaded between them. It doubles as the front door: tapping any card jumps straight into that exact live screen on that surface. The page has a brand row (`✱ nabaperks` wordmark, "Full flow · v2" tag, demo date/locale, and a "Reset every flow" demo control), a big display header with surface/screen counts, the five lanes, and a footer "receipt" listing the demo cast and the product's rules.

## Props / state

| Prop | Type                        | Default | Notes                                                                                                                                                                                   |
| ---- | --------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `t`  | object                      | —       | Theme/tweaks object. Only `t.mo` is read — the motion factor, threaded down into every lane/card/tie-strip as `mo`.                                                                     |
| `go` | `(surface, preset) => void` | —       | Navigation callback into the surfaces. Passed straight through to each `JyLane` as `go`; cards invoke `go(lane.surface, step.preset)`. (See **Flow & state** for the full target list.) |

**State:** `const [wiped, setWiped] = useStateJy(false)` — toggles the "Reset every flow" → "All flows reset ✓" toast label.

**Local helper:** `jyResetAll` — clears the five per-surface localStorage keys and flashes the toast (prototype-only; see below).

```jsx
const mo = t.mo
const [wiped, setWiped] = useStateJy(false)
const jyResetAll = () => {
  ;[
    "v3_customer",
    "v3_merchant",
    "v3_staff",
    "v3_admin",
    "v3_marketing",
  ].forEach((k) => localStorage.removeItem(k))
  setWiped(true)
  setTimeout(() => setWiped(false), 1600 * mo)
}
```

## UX behaviour

- **Navigation (front door):** every step card is a button that calls `go(surface, preset)`. `go` is the single navigation callback into the surfaces — `JourneyMap` does not own routing, it just emits `(surface, preset)` pairs for the host to honour. Surfaces are the lane `label`/`surface` values; presets are per-step ids (full table below).
- **Reset every flow (demo control):** the `DemoTag` calls `jyResetAll`, which removes the five `v3_*` localStorage keys (one per surface's persisted demo state) and shows "All flows reset ✓" for `1600 * mo` ms before reverting.
- **Entrance choreography:** the header and footer animate in with `w-rise`; lanes and tie-strips are staggered by hardcoded delays (60, 120, 150, 180, 210, 240, 300), each multiplied by `mo`.
- **Counts in copy:** the header chips read `6 surfaces`, `30+ screens`, `One counter`. (Note: `JY_LANES` defines five lanes; "6 surfaces" is the marketing count — _unclear from source_ whether the sixth surface is the journey map itself or an unlisted surface.)
- **Footer receipt:** a `ReceiptCard` with a `VenueMark`, the demo cast line, card/reward numbers, the product-rule `MonoTag`s, and a pointer to the Tweaks panel.

## Storyboard structure

The storyboard is data-driven from `JY_LANES` (lines 161–219). Each lane → one surface; each step → one screen, reached via `go(surface, preset)`. Step `n: "··"` with `spur: true` marks an off-the-happy-path branch (rendered as a dashed "SPUR" card with an accent connector). The `tie` field flags cross-surface links, which `JourneyMap` reinforces with `JyTieStrip`s placed between lanes.

Render order in `JourneyMap` (lines 374–384):
`JyLane[0] Merchant` → `JyLane[1] Customer` → **JyTieStrip "The counter moment"** → `JyLane[2] Staff` → **JyTieStrip "Stripe webhooks"** → `JyLane[3] Admin` → `JyLane[4] Marketing`.

**Lane 0 — Merchant** · who: `hello@oldcrown.pub` · surface `"Merchant"` · 9 screens
| Step | preset (target) | title |
| --- | --- | --- |
| Nº 01 | `signup` | Sign up |
| Nº 02 | `onboarding` | Three-step setup |
| Nº 03 | `qr` | Print the QR |
| Nº 04 | `today` | Today at the counter |
| Nº 05 | `activity` | Read the room |
| Nº 06 | `customers` | Know your regulars |
| Nº 07 | `settings` | Keys & PIN |
| Nº 08 | `billing` | £29, settled — _tie: Stripe webhooks_ |
| Nº 09 | `counter` | Counter mode |

**Lane 1 — Customer** · who: `Asha K. · first visit` · surface `"Customer"` · 10 screens
| Step | preset (target) | title |
| --- | --- | --- |
| Nº 01 | `scan` | Scan the till card |
| Nº 02 | `landing` | First stamp waiting |
| Nº 03 | `firstStamp` | That's one — _tie: Counter moment_ |
| Nº 04 | `save` | Keep the card |
| Nº 05 | `card` | The card |
| Nº 06 | `sealed` | Seal at three |
| Nº 07 | `revealed` | Break it open |
| Nº 08 | `ready` | Ready next day |
| Nº 09 | `redeemed` | Enjoy |
| SPUR (··) | `alreadyStamped` | One a day — _spur_ |

**Lane 2 — Staff** · who: `Maya & Jordan · behind the bar` · surface `"Staff"` · 4 screens
| Step | preset (target) | title |
| --- | --- | --- |
| Nº 01 | `idle` | Pin this tab |
| Nº 02 | `pin` | Phone handed over — _tie: Counter moment_ |
| Nº 03 | `success` | Stamped, hand it back |
| SPUR (··) | `locked` | Locked out — _spur_ |

**Lane 3 — Admin** · who: `internal support` · surface `"Admin"` · 6 screens
| Step | preset (target) | title |
| --- | --- | --- |
| Nº 01 | `gate` | MFA gate |
| Nº 02 | `overview` | Platform pulse |
| Nº 03 | `merchants` | Merchants |
| Nº 04 | `billing` | Billing sync — _tie: Stripe webhooks_ |
| Nº 05 | `audit` | Audit trail |
| Nº 06 | `fraud` | Fraud flags |

**Lane 4 — Marketing** · who: `the shop window` · surface `"Marketing"` · `slim: true` · 3 screens
| Step | preset (target) | title |
| --- | --- | --- |
| Nº 01 | `home` | Home |
| Nº 02 | `pricing` | Pricing |
| Nº 03 | `legal` | Plain-English legal |

**Tie-strips (cross-surface links):**

- _The counter moment_ — note: `Customer 03 · Staff 02 — one phone, one PIN, one slam` (placed between the Customer and Staff lanes). Ties Customer `firstStamp` ↔ Staff `pin`.
- _Stripe webhooks_ — note: `Merchant 08 · Admin 04 — billing truth flows both ways` (placed between the Staff and Admin lanes). Ties Merchant `billing` ↔ Admin `billing`.

## Dependencies

- **Shared primitives:** `MonoTag`, `MonoLine`, `DemoTag`, `ReceiptCard`, `ReceiptRule`, `VenueMark`. (Indirectly, via the lanes/cards: `JyGlyph`, `JyStepCard`, `JyArrowLink`, `JyLane`, `JyTieStrip`, and through those `MonoTag`/`MonoLine`.)
- **CSS variables:** `--w-accent` (wordmark disc), `--w-ink` (wordmark disc border), `--w-ink-soft` (header paragraph). Plus everything pulled in by the lanes/cards: `--w-card`, `--w-paper`, `--w-line`, `--w-mono`, `--w-display`, `--w-r`.
- **Keyframes:** `w-rise` (header, footer, lanes, tie-strips entrance).
- **localStorage:** reads/writes the five `v3_*` per-surface keys — clears `v3_customer`, `v3_merchant`, `v3_staff`, `v3_admin`, `v3_marketing` in `jyResetAll`.
- **Globals / window:** reads `React` (`useStateJy`) and the window-global primitives above; writes itself to `window.JourneyMap`.

## Reuse notes

This is the demo front door / index, not a product screen — keep it as a reference for _information architecture_ (how the surfaces and their screens relate, where they tie together) rather than as shippable code. Hard prototype dependencies: (1) the `go(surface, preset)` wiring is a bespoke in-prototype router into a single-page demo, not Next.js routing; (2) `jyResetAll` manipulates `localStorage` and uses a `setTimeout` toast — both prototype-isms; (3) the cast ("The Old Crown, Bristol", Asha/Tom/Priya/Dan, Maya/Jordan), the date ("Thu 12 Jun 2026 · Bristol"), the card/reward numbers, and the "Tweaks panel" pointer are demo fixtures; (4) `t.mo` motion-scaling and the staggered `w-rise` delays should be replaced by motion tokens; (5) the "6 surfaces / 30+ screens" copy is marketing rounding, not derived from `JY_LANES` (which holds five lanes / 32 step cards). The lane/step taxonomy itself is a useful as-built map of the v2 flow.

**Prototype-isms:** `localStorage` reset, `setTimeout` toast, `t.mo` motion factor, hardcoded demo date/cast/counts, `window.*` export and `go` navigation callback.

## Source snippet

```jsx
function JourneyMap({ t, go }) {
  const mo = t.mo
  const [wiped, setWiped] = useStateJy(false)
  const jyResetAll = () => {
    ;[
      "v3_customer",
      "v3_merchant",
      "v3_staff",
      "v3_admin",
      "v3_marketing",
    ].forEach((k) => localStorage.removeItem(k))
    setWiped(true)
    setTimeout(() => setWiped(false), 1600 * mo)
  }

  return (
    <div
      data-screen-label="Journey map"
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: "30px 24px 130px",
        minHeight: "100vh",
      }}
    >
      {/* brand row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span
            style={{
              width: 26,
              height: 26,
              borderRadius: "50%",
              background: "var(--w-accent)",
              border: "2px solid var(--w-ink)",
              display: "inline-grid",
              placeItems: "center",
              color: "#fff",
              fontWeight: 800,
              fontSize: 13,
              transform: "rotate(-6deg)",
            }}
          >
            ✱
          </span>
          <span
            style={{
              fontWeight: 800,
              fontSize: 16.5,
              letterSpacing: "-0.01em",
            }}
          >
            nabaperks
          </span>
          <MonoTag style={{ marginLeft: 6 }}>Full flow · v2</MonoTag>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <MonoLine style={{ fontSize: 10 }}>
            Thu 12 Jun 2026 · Bristol
          </MonoLine>
          <DemoTag onClick={jyResetAll}>
            {wiped ? "All flows reset ✓" : "Reset every flow"}
          </DemoTag>
        </div>
      </div>

      {/* header */}
      <header
        style={{
          margin: "30px 0 8px",
          animation: `w-rise ${380 * mo}ms cubic-bezier(0.2,0,0,1) both`,
        }}
      >
        <h1
          style={{
            fontSize: 42,
            fontWeight: 800,
            lineHeight: 1.05,
            margin: "0 0 12px",
            maxWidth: "22ch",
          }}
        >
          The whole loop, on one table.
        </h1>
        <p
          style={{
            fontSize: 16,
            lineHeight: "24px",
            color: "var(--w-ink-soft)",
            margin: "0 0 16px",
            maxWidth: "62ch",
          }}
        >
          Every surface of Nabaperks v2 — merchant, customer, staff, admin and
          the shop window — dealt out as one storyboard. Tap any card to jump
          into that exact screen, live.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <MonoTag>6 surfaces</MonoTag>
          <MonoTag>30+ screens</MonoTag>
          <MonoTag tone="accent">One counter</MonoTag>
        </div>
      </header>

      {/* swimlanes */}
      <div style={{ display: "grid", gap: 14, marginTop: 22 }}>
        <JyLane lane={JY_LANES[0]} go={go} mo={mo} delay={60} />
        <JyLane lane={JY_LANES[1]} go={go} mo={mo} delay={120} />
        <JyTieStrip
          mo={mo}
          delay={150}
          label="The counter moment"
          note="Customer 03 · Staff 02 — one phone, one PIN, one slam"
        />
        <JyLane lane={JY_LANES[2]} go={go} mo={mo} delay={180} />
        <JyTieStrip
          mo={mo}
          delay={210}
          label="Stripe webhooks"
          note="Merchant 08 · Admin 04 — billing truth flows both ways"
        />
        <JyLane lane={JY_LANES[3]} go={go} mo={mo} delay={240} />
        <JyLane lane={JY_LANES[4]} go={go} mo={mo} delay={300} />
      </div>

      {/* footer strip [trimmed — ReceiptCard with VenueMark, demo cast, card/reward Nº, rule MonoTags; lines 386–412] */}
    </div>
  )
}

/* ---------- exports ---------- */
Object.assign(window, { JourneyMap })
```
