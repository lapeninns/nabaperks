# MerchantSurface

- **Surface:** merchant (the surface OWNER — top-level stage machine for the whole merchant experience)
- **Source module:** [extracted-source/20-merchant-core.jsx](../../extracted-source/20-merchant-core.jsx) (lines 456–529)
- **Export:** `window.MerchantSurface` (global) — also exports `MerchantEntry` and `QrBlock` alongside it
- **Reuse verdict:** 🔒 Prototype-only (localStorage-backed stage machine, inline styles, demo "Restart flow") — the stage/tab architecture is a useful reference

## Visual purpose

The merchant root. Renders a persistent header (`McBrand` + a "Restart flow" demo escape) and then one of three stages: `auth` (`McAuth`), `onboarding` (`McOnboarding`), or `app`. In the `app` stage it draws a pill tab bar (`MC_TABS`) and routes the active tab to its screen. Centred ≤1060px column with generous bottom padding.

## Props / state

| Prop | Type                                        | Notes                                                                                                                                         |
| ---- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `t`  | `object` (tweaks)                           | Reads `t.mo` (motion); forwarded to every stage/tab child as `t`.                                                                             |
| `go` | `(surface: string, screen: string) => void` | Cross-surface navigator forwarded to `McToday` and the ops screens; lets the merchant jump to other surfaces (e.g. `go("Customer", "card")`). |

**State (lifted, `useState`, seeded from `mcBoot()`):**
| Hook | Seed | Notes |
| --- | --- | --- |
| `boot` | `mcBoot()` | One-time read of persisted state merged over `MC_DEFAULTS`. |
| `stage` | `boot.stage` | `"auth" \| "onboarding" \| "app"`. |
| `tab` | `boot.tab` | Active `app` tab (one of `MC_TABS`). |
| `obStep` | `boot.obStep` | Onboarding step 1–3 (lifted for `McOnboarding`). |
| `venue` | `boot.venue` | Venue name (shared auth→onboarding→app). |
| `city` | `boot.city` | City. |
| `rewards` | `boot.rewards` | Reward pool array. |

Derived: `venueTag` (the header chip, only in `app`), `tabLabel` (for `data-screen-label`).

## UX behaviour

- **Persistence:** a `useEffect` writes `{ stage, tab, obStep, venue, city, rewards }` to `localStorage` under key `v3_merchant` on every change. On mount `mcBoot()` restores it (merging over `MC_DEFAULTS`, and re-seeding `rewards` to `MC_REWARDS_SEED` if missing/empty).
- **Restart flow** (`DemoTag`): removes the localStorage key and resets all state to defaults (`stage="auth"`, `tab="today"`, `obStep=1`, blank venue/city, seed rewards).
- **Tab bar** (`app` only): `MC_TABS` rendered as pills; the active tab gets the ink fill + paper text, the rest are ghosted (`--w-ink-soft`).
- **`data-screen-label`:** set to `Merchant · ${tabLabel}` in the `app` stage (a prototype harness hook for the screenshot tooling); left `undefined` otherwise (the child stages set their own labels).
- **Prototype-isms:** persistence is browser localStorage, not a server session; "Restart flow" is a demo affordance. The five non-core tabs (Activity, Customers, QR studio, Settings, Billing) come from a separate module (see Stage machine).

## Stage machine

```
                ┌─────────────────────────────────────────────┐
                │                MerchantSurface                │
                │   header: McBrand + "Restart flow" (DemoTag)  │
                └───────────────────────┬─────────────────────┘
                                        │ stage =
        ┌───────────────────────────────┼────────────────────────────────┐
        │ "auth"                         │ "onboarding"                    │ "app"
        ▼                                ▼                                 ▼
     McAuth                         McOnboarding                      tab bar (MC_TABS)
   email→code OTP                3 steps: venue → pool → QR        today | activity | customers
        │                               │      │                  | qr | settings | billing | counter
        │ onDone(mode)                  │ onLive / onSkip
        ▼                               ▼
   mode==="create" → onboarding   → app, tab="today"
   mode==="signin"  → app, tab="today"
```

**Stage → component / transition map:**

| Stage        | Renders              | Leaves via                                                  | Goes to                   |
| ------------ | -------------------- | ----------------------------------------------------------- | ------------------------- |
| `auth`       | `McAuth`             | `onDone("create")` → `setObStep(1); setStage("onboarding")` | `onboarding`              |
| `auth`       | `McAuth`             | `onDone("signin")` → `setTab("today"); setStage("app")`     | `app` (Today)             |
| `onboarding` | `McOnboarding`       | `onLive()` → `setTab("today"); setStage("app")`             | `app` (Today)             |
| `onboarding` | `McOnboarding`       | `onSkip()` → `setTab("today"); setStage("app")`             | `app` (Today)             |
| `app`        | tab bar + active tab | `setTab(id)` (pill click)                                   | stays in `app`, swaps tab |
| any          | header `DemoTag`     | `restart()` → clears LS, resets all                         | back to `auth`            |

**`app`-tab → screen routing** (lines 518–524):

| Tab id      | Screen              | Documented in                                      |
| ----------- | ------------------- | -------------------------------------------------- |
| `today`     | `McToday`           | this module — [McToday.md](./McToday.md)           |
| `counter`   | `McCounter`         | this module — [McCounter.md](./McCounter.md)       |
| `activity`  | `MerchantActivity`  | **separate module** `21-merchant-ops` (named only) |
| `customers` | `MerchantCustomers` | **separate module** `21-merchant-ops` (named only) |
| `qr`        | `MerchantQrStudio`  | **separate module** `21-merchant-ops` (named only) |
| `settings`  | `MerchantSettings`  | **separate module** `21-merchant-ops` (named only) |
| `billing`   | `MerchantBilling`   | **separate module** `21-merchant-ops` (named only) |

The five ops screens each receive `{ t, go }` (per the module header comment at lines 3–5) and are out of scope here.

**Props passed between stages:** every stage/tab child receives `t` (tweaks; `t.mo` motion, `t.celebration`). `McToday` and the ops screens also receive `go` (cross-surface navigator). `McOnboarding` additionally receives the lifted `obStep`/`venue`/`city`/`rewards` setter-pairs plus `onLive`/`onSkip`. `McAuth` receives `onDone`.

## Dependencies

- **Shared primitives:** `DemoTag` (and, transitively via children, the full primitive set).
- **Module-local:** `McBrand`, `McAuth`, `McOnboarding`, `McToday`, `McCounter`; the constants `MC_DEFAULTS`, `MC_TABS`, `MC_REWARDS_SEED`, `MC_LS_KEY`, and the `mcBoot()` helper.
- **External (separate module):** `MerchantActivity`, `MerchantCustomers`, `MerchantQrStudio`, `MerchantSettings`, `MerchantBilling` (from `21-merchant-ops`, expected on `window`).
- **CSS variables:** `--w-ink`, `--w-paper`, `--w-ink-soft`, `--w-display`, plus those consumed by children.
- **Keyframes:** none directly (children own `w-rise`/`w-pop`/etc.).
- **localStorage:** key **`v3_merchant`** (`MC_LS_KEY`) — read by `mcBoot()`, written by the persistence effect, removed by `restart()`.
- **Globals / window:** reads `React` (aliased `useStateMc`/`useEffectMc`) and shared primitives + the ops screens from `window`; writes `MerchantSurface`, `MerchantEntry`, `QrBlock` to `window`.

## Reuse notes

Prototype-only: the stage machine is driven by browser localStorage rather than a real merchant session/auth, and the ops tabs are wired to globals from another script. The **architecture** — a single owner switching auth → onboarding → app, with app holding a tab router — is a clean reference for the production merchant console (`app/app/*`). For production: replace localStorage with the real session + RLS-scoped data, route tabs through Next.js App Router segments instead of a `tab` state string, drop "Restart flow", and remove the `window.*` exports in favour of module imports.

## Source snippet

```jsx
function MerchantSurface({ t, go }) {
  const mo = t.mo
  const [boot] = useStateMc(mcBoot)
  const [stage, setStage] = useStateMc(boot.stage)
  const [tab, setTab] = useStateMc(boot.tab)
  const [obStep, setObStep] = useStateMc(boot.obStep)
  const [venue, setVenue] = useStateMc(boot.venue)
  const [city, setCity] = useStateMc(boot.city)
  const [rewards, setRewards] = useStateMc(boot.rewards)

  useEffectMc(() => {
    localStorage.setItem(
      MC_LS_KEY,
      JSON.stringify({ stage, tab, obStep, venue, city, rewards })
    )
  }, [stage, tab, obStep, venue, city, rewards])

  const restart = () => {
    localStorage.removeItem(MC_LS_KEY)
    setStage("auth")
    setTab("today")
    setObStep(1)
    setVenue("")
    setCity("")
    setRewards(MC_REWARDS_SEED)
  }

  const venueTag = stage === "app" ? venue.trim() || "The Old Crown" : null
  const tabLabel = (MC_TABS.find((tb) => tb.id === tab) || MC_TABS[0]).label

  return (
    <div
      style={{
        maxWidth: 1060,
        margin: "0 auto",
        padding: "26px 28px 110px",
        minHeight: "100vh",
      }}
      data-screen-label={stage === "app" ? `Merchant · ${tabLabel}` : undefined}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: stage === "app" ? 14 : 22,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <McBrand venue={venueTag} />
        <DemoTag onClick={restart}>Restart flow</DemoTag>
      </div>

      {stage === "auth" && (
        <McAuth
          t={t}
          onDone={(mode) => {
            if (mode === "create") {
              setObStep(1)
              setStage("onboarding")
            } else {
              setTab("today")
              setStage("app")
            }
          }}
        />
      )}

      {stage === "onboarding" && (
        <McOnboarding
          t={t}
          obStep={obStep}
          setObStep={setObStep}
          venue={venue}
          setVenue={setVenue}
          city={city}
          setCity={setCity}
          rewards={rewards}
          setRewards={setRewards}
          onLive={() => {
            setTab("today")
            setStage("app")
          }}
          onSkip={() => {
            setTab("today")
            setStage("app")
          }}
        />
      )}

      {stage === "app" && (
        <div>
          <div
            style={{
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
              marginBottom: 24,
            }}
          >
            {MC_TABS.map((tb) => (
              <button
                key={tb.id}
                onClick={() => setTab(tb.id)}
                style={{
                  fontFamily: "var(--w-display)",
                  fontWeight: 700,
                  fontSize: 14,
                  padding: "9px 16px",
                  borderRadius: 999,
                  cursor: "pointer",
                  border:
                    "2px solid " +
                    (tab === tb.id ? "var(--w-ink)" : "transparent"),
                  background: tab === tb.id ? "var(--w-ink)" : "transparent",
                  color: tab === tb.id ? "var(--w-paper)" : "var(--w-ink-soft)",
                }}
              >
                {tb.label}
              </button>
            ))}
          </div>
          {tab === "today" && <McToday t={t} goTab={setTab} go={go} />}
          {tab === "activity" && <MerchantActivity t={t} go={go} />}
          {tab === "customers" && <MerchantCustomers t={t} go={go} />}
          {tab === "qr" && <MerchantQrStudio t={t} go={go} />}
          {tab === "settings" && <MerchantSettings t={t} go={go} />}
          {tab === "billing" && <MerchantBilling t={t} go={go} />}
          {tab === "counter" && <McCounter t={t} />}
        </div>
      )}
    </div>
  )
}
```

## Config & entry

These three are **not** React components — they are the module's configuration and entry object. Documented here (verbatim) rather than as separate files.

### `MC_DEFAULTS` (lines 16–23)

The seed state `mcBoot()` merges persisted localStorage over. Note `stage` starts at `"auth"`, `tab` at `"today"`, and `rewards` defaults to `MC_REWARDS_SEED`.

```jsx
const MC_DEFAULTS = {
  stage: "auth", // auth | onboarding | app
  tab: "today", // today | activity | customers | qr | settings | billing | counter
  obStep: 1,
  venue: "",
  city: "",
  rewards: MC_REWARDS_SEED,
}
```

Supporting constants it references — the reward seed (lines 10–14) and the localStorage key (line 8):

```jsx
const MC_LS_KEY = "v3_merchant"

const MC_REWARDS_SEED = [
  { name: "Free flat white", weight: 3 },
  { name: "Slice of cake", weight: 2 },
  { name: "20% off next visit", weight: 1 },
]
```

### `MC_INPUT` (lines 35–40)

The shared text-input style spread by `McField` and the onboarding add-reward input. (Also listed in [McField.md](./McField.md).)

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

### `MerchantEntry` (lines 533–546)

A config/entry object (exported on `window` beside `MerchantSurface`) exposing the localStorage key and a set of deep-link **presets** — each preset is the partial state a harness can seed to jump straight to a given stage/tab.

```jsx
const MerchantEntry = {
  lsKey: MC_LS_KEY,
  presets: {
    signup: { stage: "auth" },
    onboarding: { stage: "onboarding", obStep: 1 },
    today: { stage: "app", tab: "today" },
    activity: { stage: "app", tab: "activity" },
    customers: { stage: "app", tab: "customers" },
    qr: { stage: "app", tab: "qr" },
    settings: { stage: "app", tab: "settings" },
    billing: { stage: "app", tab: "billing" },
    counter: { stage: "app", tab: "counter" },
  },
}
```

Module exports (line 548), verbatim:

```jsx
Object.assign(window, { MerchantSurface, MerchantEntry, QrBlock })
```
