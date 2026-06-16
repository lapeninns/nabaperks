# McOnboarding

- **Surface:** merchant (stage view — the `onboarding` stage of `MerchantSurface`)
- **Source module:** [extracted-source/20-merchant-core.jsx](../../extracted-source/20-merchant-core.jsx) (lines 206–341)
- **Export:** none (rendered by `MerchantSurface`; not on `window`)
- **Reuse verdict:** 🔒 Prototype-only (fake "print", local-only state, mocked celebration, inline styles) — the three-step _structure_ is a strong reference

## Visual purpose

The "three steps, then you're live" setup wizard. A header with a "Skip setup" demo escape, then a vertical stack of three step cards: (1) name the venue + city, (2) stock the reward pool with draw weights, (3) print the QR and go live. Each card renders as `done` / `now` / `next` (tick + leaf, accent + shadow, or faded outline) and only the `now` card expands its body. Completing step 3 ("Print poster + till card") flips to a celebratory "The counter is ready" panel with `CelebrationBits`.

## Props / state

| Prop         | Type                                      | Notes                                                                                |
| ------------ | ----------------------------------------- | ------------------------------------------------------------------------------------ |
| `t`          | `object` (tweaks)                         | Reads `t.mo` (motion) and `t.celebration` (`"Ripple"` vs anything else → `"Burst"`). |
| `obStep`     | `number` (1–3)                            | Current step; lifted to `MerchantSurface`.                                           |
| `setObStep`  | `(n: number) => void`                     | Advances / edits steps.                                                              |
| `venue`      | `string`                                  | Lifted venue name.                                                                   |
| `setVenue`   | `(s: string) => void`                     | —                                                                                    |
| `city`       | `string`                                  | Lifted city.                                                                         |
| `setCity`    | `(s: string) => void`                     | —                                                                                    |
| `rewards`    | `Array<{ name: string; weight: number }>` | Lifted reward pool (seeded by `MC_REWARDS_SEED`).                                    |
| `setRewards` | `(r: Array) => void`                      | —                                                                                    |
| `onLive`     | `() => void`                              | "Open Today at the counter" → surface routes to `app`/`today`.                       |
| `onSkip`     | `() => void`                              | "Skip setup" → same as `onLive` (surface routes to `app`/`today`).                   |

**State (local, `useState`):**
| Hook | Initial | Notes |
| --- | --- | --- |
| `newReward` | `""` | The add-a-reward text input. |
| `live` | `false` | Whether step 3 has "printed" / gone live (drives the celebration swap). |

## UX behaviour

- **Step model:** `state = s.n < obStep ? "done" : s.n === obStep ? "now" : "next"`. `done` cards show a leaf tick + a summary `MonoLine` + an "Edit" `GhostLink` (jumps `obStep` back to that step). `next` cards are faded (`opacity 0.6`) with a line border.
- **Step 1 (venue):** two `McField`s; "Save — next" `InkButton` `disabled` until `venue.trim()`, advances to step 2. `DemoTag` autofills "The Old Crown" / "Bristol".
- **Step 2 (reward pool):** lists `rewards`; each row has a "WEIGHT ×n" button cycling the weight `1→2→3→1` (`(r.weight % 3) + 1`) and, when more than one reward, a `×` remove button. An add-input appends `{ name, weight: 1 }` on click or Enter (`addReward`, ignores empty/whitespace). "Pool's stocked — next" advances to step 3; a "Back" `GhostLink` returns to step 1.
- **Step 3 (QR / go live):** before `live`, shows `QrBlock` + "Print poster + till card" (`setLive(true)`) and a "Back" link. After `live`, swaps to the centred "The counter is ready" panel (animated `w-pop`) with `CelebrationBits` and the `onLive` button.
- **Prototype-isms:** nothing is printed or persisted to a server; "going live" only flips local `live` state. The default city fallback ("Bristol"), the autofill values, and the celebration are demo artifacts. `CelebrationBits` type is chosen from the tweak `t.celebration`.

## Dependencies

- **Shared primitives:** `MonoLine`, `MonoTag`, `InkButton`, `GhostLink`, `DemoTag`, `CelebrationBits`.
- **Module-local:** `McField`, `QrBlock`, plus the `MC_INPUT` style (used by the inline add-reward `<input>`).
- **CSS variables:** `--w-line`, `--w-ink`, `--w-r`, `--w-card`, `--w-shadow`, `--w-leaf`, `--w-accent`, `--w-paper`, `--w-ink-soft`, `--w-mono`.
- **Keyframes:** `w-rise` (entrance, `380 * mo` ms), `w-pop` (live panel, `420 * mo` ms).
- **localStorage:** none directly — `MerchantSurface` persists `obStep`/`venue`/`city`/`rewards`.
- **Globals / window:** reads shared primitives + `QrBlock` from `window`; receives the lifted state, `t`, `onLive`, `onSkip` from `MerchantSurface`. Not itself exported.

## Reuse notes

Prototype-only: the print/go-live action is a local state flip with no backend, and the reward weights are not persisted to a server pool. The **three-step shape** (name venue → stock weighted reward pool → print QR & go live) and the done/now/next card states are an excellent reference and map directly to the production `create_merchant_onboarding` flow and `reward_pool_items` weighting. For production: wire each step to real persistence, replace the literal "print" with the QR/poster generator, derive the city default from input rather than a hardcoded "Bristol", and lift inline styles to the token layer. The weight-cycle UX (tap to rotate 1→2→3) is a tidy, portable pattern.

## Source snippet

Signature, helpers, and the step model (verbatim):

```jsx
function McOnboarding({ t, obStep, setObStep, venue, setVenue, city, setCity, rewards, setRewards, onLive, onSkip }) {
  const mo = t.mo;
  const [newReward, setNewReward] = useStateMc("");
  const [live, setLive] = useStateMc(false);

  const cycleWeight = (i) => setRewards(rewards.map((r, j) => j === i ? { ...r, weight: (r.weight % 3) + 1 } : r));
  const removeReward = (i) => setRewards(rewards.filter((_, j) => j !== i));
  const addReward = () => {
    if (!newReward.trim()) return;
    setRewards([...rewards, { name: newReward.trim(), weight: 1 }]);
    setNewReward("");
  };

  const steps = [
    { n: 1, title: "Name your venue", done: venue.trim() ? `${venue.trim()} · ${city.trim() || "Bristol"}` : null },
    { n: 2, title: "Stock the reward pool", done: obStep > 2 ? `${rewards.length} rewards sealed in` : null },
    { n: 3, title: "Print your QR", done: null },
  ];
```

Header + the `steps.map` shell with the per-step `state` and the card chrome (the three expanded `now` bodies follow next; the `done`/`next` rendering shown here):

```jsx
  return (
    <div data-screen-label="Merchant · Onboarding" style={{ maxWidth: 640, animation: `w-rise ${380 * mo}ms cubic-bezier(0.2,0,0,1) both` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div>
          <MonoLine>Setup · about 5 minutes</MonoLine>
          <h1 style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.05, margin: "6px 0 22px" }}>Three steps, then you're live.</h1>
        </div>
        <div style={{ marginBottom: 24 }}><DemoTag onClick={onSkip}>Skip setup</DemoTag></div>
      </div>
      <div style={{ display: "grid", gap: 14 }}>
        {steps.map((s) => {
          const state = s.n < obStep ? "done" : s.n === obStep ? "now" : "next";
          return (
            <div key={s.n} style={{
              border: "2px solid " + (state === "next" ? "var(--w-line)" : "var(--w-ink)"),
              borderRadius: "var(--w-r)", background: "var(--w-card)",
              boxShadow: state === "now" ? "var(--w-shadow)" : "none",
              padding: "18px 20px", opacity: state === "next" ? 0.6 : 1,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{
                  width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                  border: "2px solid var(--w-ink)", display: "grid", placeItems: "center",
                  background: state === "done" ? "var(--w-leaf)" : state === "now" ? "var(--w-accent)" : "transparent",
                  color: state === "next" ? "var(--w-ink)" : "#fff",
                  fontWeight: 800, transform: "rotate(-6deg)",
                }}>{state === "done" ? "✓" : s.n}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 17 }}>{s.title}</div>
                  {s.done && state !== "now" && <MonoLine style={{ fontSize: 10, marginTop: 2 }}>{s.done}</MonoLine>}
                </div>
                {state === "done" && (
                  <GhostLink style={{ fontSize: 13 }} onClick={() => setObStep(s.n)}>Edit</GhostLink>
                )}
              </div>
              {/* expanded `now` bodies for steps 1/2/3 follow — shown in full below */}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

Step 1 body (`now` + `s.n === 1`), verbatim:

```jsx
{
  state === "now" && s.n === 1 && (
    <div style={{ marginTop: 16, display: "grid", gap: 14 }}>
      <McField
        label="Venue name"
        value={venue}
        onChange={setVenue}
        placeholder="The Old Crown"
      />
      <McField
        label="City"
        value={city}
        onChange={setCity}
        placeholder="Bristol"
      />
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <InkButton
          size="md"
          disabled={!venue.trim()}
          onClick={() => setObStep(2)}
        >
          Save — next
        </InkButton>
        <DemoTag
          onClick={() => {
            setVenue("The Old Crown")
            setCity("Bristol")
          }}
        >
          Autofill The Old Crown
        </DemoTag>
      </div>
      <MonoLine style={{ fontSize: 10 }}>
        Customers see this name the moment their card opens.
      </MonoLine>
    </div>
  )
}
```

Step 2 body (`now` + `s.n === 2`), verbatim — reward rows, weight cycle, remove, add-input:

```jsx
{
  state === "now" && s.n === 2 && (
    <div style={{ marginTop: 16, display: "grid", gap: 8 }}>
      {rewards.map((r, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
            border: "2px dashed var(--w-line)",
            borderRadius: 8,
            padding: "8px 8px 8px 13px",
            fontFamily: "var(--w-mono)",
            fontSize: 12.5,
          }}
        >
          <span style={{ flex: 1 }}>{r.name}</span>
          <button
            onClick={() => cycleWeight(i)}
            title="Tap to change the draw weight"
            style={{
              fontFamily: "var(--w-mono)",
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: "0.08em",
              border: "1.5px solid var(--w-ink)",
              borderRadius: 999,
              padding: "4px 10px",
              background: "var(--w-paper)",
              color: "var(--w-ink)",
              cursor: "pointer",
            }}
          >
            WEIGHT ×{r.weight}
          </button>
          {rewards.length > 1 && (
            <button
              onClick={() => removeReward(i)}
              title="Remove from the pool"
              style={{
                width: 28,
                height: 28,
                border: "1.5px dashed var(--w-line)",
                borderRadius: 8,
                background: "transparent",
                color: "var(--w-ink-soft)",
                cursor: "pointer",
                fontSize: 15,
                lineHeight: 1,
                fontFamily: "var(--w-mono)",
              }}
            >
              ×
            </button>
          )}
        </div>
      ))}
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={newReward}
          placeholder="Add a reward — e.g. Free pastry"
          onChange={(e) => setNewReward(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addReward()
          }}
          style={{ ...MC_INPUT, fontSize: 14, padding: "10px 13px", flex: 1 }}
        />
        <InkButton
          size="sm"
          variant="outline"
          disabled={!newReward.trim()}
          onClick={addReward}
        >
          Add
        </InkButton>
      </div>
      <MonoLine style={{ fontSize: 10 }}>
        Heavier weights turn up more often. One is drawn when the seal breaks at
        visit 3.
      </MonoLine>
      <div
        style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 4 }}
      >
        <InkButton size="md" onClick={() => setObStep(3)}>
          Pool's stocked — next
        </InkButton>
        <GhostLink onClick={() => setObStep(1)}>Back</GhostLink>
      </div>
    </div>
  )
}
```

Step 3 body (`now` + `s.n === 3`), verbatim — QR/print, then the go-live celebration swap:

```jsx
{
  state === "now" && s.n === 3 && (
    <div style={{ marginTop: 16, position: "relative" }}>
      {live && (
        <CelebrationBits
          type={t.celebration === "Ripple" ? "Ripple" : "Burst"}
          mo={mo}
          seed={7}
        />
      )}
      {!live ? (
        <div
          style={{
            display: "flex",
            gap: 18,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <QrBlock size={110} />
          <div style={{ display: "grid", gap: 8 }}>
            <InkButton size="md" onClick={() => setLive(true)}>
              Print poster + till card
            </InkButton>
            <MonoLine style={{ fontSize: 10 }}>
              One permanent code · this is the moment you go live.
            </MonoLine>
            <GhostLink
              style={{ justifySelf: "start", padding: "4px 0" }}
              onClick={() => setObStep(2)}
            >
              Back
            </GhostLink>
          </div>
        </div>
      ) : (
        <div
          style={{
            textAlign: "center",
            padding: "10px 0 4px",
            animation: `w-pop ${420 * mo}ms cubic-bezier(0.16,1.2,0.3,1) both`,
          }}
        >
          <MonoTag tone="accent">
            Live at {venue.trim() || "The Old Crown"}
          </MonoTag>
          <h2
            style={{
              fontSize: 26,
              fontWeight: 800,
              lineHeight: 1.08,
              margin: "14px 0 8px",
            }}
          >
            The counter is ready.
          </h2>
          <p
            style={{
              fontSize: 14.5,
              color: "var(--w-ink-soft)",
              margin: "0 auto 18px",
              maxWidth: "36ch",
            }}
          >
            Stick the poster where the queue forms. The first scan does the
            rest.
          </p>
          <InkButton onClick={onLive}>Open Today at the counter</InkButton>
        </div>
      )}
    </div>
  )
}
```
