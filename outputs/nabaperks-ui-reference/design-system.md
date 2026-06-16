# Design System Reference — "Wet Ink" (Honey & Ink v2)

Extracted from the prototype's global CSS ([`extracted-source/template.html`](extracted-source/template.html), lines 8–204) and the shared primitives ([`10-primitives.jsx`](extracted-source/10-primitives.jsx)). All values are verbatim from the artifact. This describes the prototype's design language as built — it is a faithful reference, not a restatement of the production `app/globals.css`.

**Direction:** riso-print / rubber-stamp. Paper + ink + one hot spot colour. Hard offset shadows. Everything tilted a few degrees. Quiet, warm, British.

---

## 1. Colour / tokens

Defined once in `:root`. The `--w-` prefix namespaces the whole palette.

| Token            | Value                    | Role                                                                  |
| ---------------- | ------------------------ | --------------------------------------------------------------------- |
| `--w-paper`      | `#f6f1e6`                | Page background (warm bone)                                           |
| `--w-paper-2`    | `#ece5d4`                | Secondary paper — panels, admin surfaces                              |
| `--w-card`       | `#fbf8f1`                | Card / receipt surface (lightest)                                     |
| `--w-ink`        | `#211c16`                | Near-black ink — text, 2px borders, shadows                           |
| `--w-ink-soft`   | `#6b6257`                | Muted ink — captions, secondary text                                  |
| `--w-line`       | `rgba(33, 28, 22, 0.18)` | Hairlines, dashed rules, empty-stamp rings                            |
| `--w-accent`     | `#e8430f`                | **Vermillion** — the one hot colour (overridden by Tweaks at runtime) |
| `--w-accent-ink` | `#ffffff`                | Text/figure on accent                                                 |
| `--w-cobalt`     | `#2b43c8`                | Secondary signal (GPS, confetti, info)                                |
| `--w-leaf`       | `#1e8a4c`                | Success / "on" / confirmed                                            |
| `--w-sun`        | `#f5a623`                | Warm highlight — the wax Seal, staff PIN chrome                       |

### Accent ink is a runtime variable

`--w-accent` is the only colour the prototype lets the user change. `V3App` writes `t.ink` onto the document root, and the Tweaks "Accent ink" control offers three presets:

| Swatch | Hex       | Name                 |
| ------ | --------- | -------------------- |
| 🟧     | `#E8430F` | Vermillion (default) |
| 🟦     | `#2B43C8` | Cobalt               |
| 🟩     | `#1E8A4C` | Leaf                 |

> The Tweaks panel itself is a separate scaffold that **deliberately ignores these tokens** (raw hex/px "by design" — `@ds-adherence-ignore`). Its chrome colours (`#29261b`, `#34c759`, etc.) are tooling, not part of Wet Ink.

---

## 2. Typography

```css
--w-display: "Bricolage Grotesque", system-ui, sans-serif; /* weights 300–800 */
--w-mono: "Space Mono", ui-monospace, monospace; /* weights 400, 700 */
```

Both are self-hosted woff2 (3 unicode subsets for display, 6 files for mono — see `extracted-source/font-*.woff2`). `font-display: swap`.

**Two-typeface system with strict roles:**

- **Bricolage Grotesque (display)** — everything human: headings (700–800), body copy (~14–17px), button labels (700). `h1,h2,h3 { text-wrap: balance }`, `p { text-wrap: pretty }`.
- **Space Mono (mono)** — everything machine/administrative: tags, eyebrows, captions, card numbers, dates, PIN digits, prices' small print. Almost always **UPPERCASE with `letter-spacing: 0.04–0.08em`** (see `MonoTag`, `MonoLine`).

**Observed type scale (px):**
| Use | Size / weight |
| --- | --- |
| Button `lg` / `md` / `sm` | 17 / 15 / 13.5, weight 700 |
| `MonoTag` | 11, weight 700, uppercase, tracking 0.08em |
| `MonoLine` | 11.5, uppercase, tracking 0.06em |
| OTP digits / PIN keys | 24 / 22, mono 700 |
| Stat / counter numbers | large display 700–800 (e.g. counter "STAMPS TODAY") |
| Stamp glyph `✱` | `size * 0.4` inside a disc |

---

## 3. Spacing, radius & shadows

| Token           | Value                    | Use                                                           |
| --------------- | ------------------------ | ------------------------------------------------------------- |
| `--w-r`         | `10px`                   | Default corner radius (buttons, cards, inputs, keys)          |
| `--w-shadow`    | `4px 4px 0 var(--w-ink)` | Hard offset shadow (primary buttons, cards via `drop-shadow`) |
| `--w-shadow-sm` | `3px 3px 0 var(--w-ink)` | Smaller hard shadow (PIN keys, stat tiles, active OTP box)    |

**Other recurring geometry (literal, not tokenised):**

- **Borders:** `2px solid var(--w-ink)` is the standard hard edge. Tags use `1.5px`. Dashed treatments: `2px dashed var(--w-line)` (rules, empty stamp rings), `1.5px dashed` (inner stamp rings, demo tags).
- **Pills:** `border-radius: 999px` (tags, toggles, progress bars, surface switcher, sheet grab-handle).
- **Sheet:** `border-radius: 18px 18px 0 0`, max-width `430px`.
- **Receipt torn edge:** a 12px-tall zig-zag built from two layered 45°/-45° linear-gradients at `17px` repeat (see `ReceiptCard`).
- **Stamp row gap:** `14px`. **Common padding:** `14–24px`.
- **Rotation as a motif:** stamps/discs `rotate(-6deg)`, venue marks `-6deg`/`-8deg`, quote cards `±1–2deg`. Admin deliberately uses ~0deg ("quieter ink").

---

## 4. Motion / animation

Eleven keyframes, all prefixed `w-`. Durations are written throughout the app as `ms * mo`, where `mo` is the motion-scale multiplier.

| Keyframe       | Effect                                                             | Where it's used                                            |
| -------------- | ------------------------------------------------------------------ | ---------------------------------------------------------- |
| `w-rise`       | `opacity 0→1`, `translateY(14px)→0`                                | Screen / card / panel entrances (everywhere)               |
| `w-slam`       | `scale(2.6) rotate(-14deg)` → overshoot → `scale(1) rotate(-6deg)` | The stamp **slam** (StampDisc, default "Slam" celebration) |
| `w-soft-stamp` | `scale(1.18)→1` at `rotate(-6deg)`                                 | Gentle stamp (when celebration = "Ripple")                 |
| `w-shake`      | translate/rotate jitter                                            | ReceiptCard error shake; Seal breaking                     |
| `w-ripple`     | `scale(0.4)→2.1`, fade out                                         | GPS radar rings; "Ripple" celebration                      |
| `w-splat`      | translate to `--sx/--sy`, scale up, fade                           | Ink splat particles (Slam/Burst)                           |
| `w-confetti`   | translate to `--cx/--cy`, `rotate(--cr)`, fade                     | Confetti (Burst celebration)                               |
| `w-wiggle`     | `rotate(-3deg)→3deg`, slight scale                                 | Seal idle wiggle while pressed/holding                     |
| `w-pop`        | `scale(0.6)→1.08→1`, fade in                                       | GPS "found"; staff/settings PIN reveal                     |
| `w-sheet-up`   | `translateY(100%)→0`                                               | Bottom `Sheet` entrance                                    |
| `w-marquee`    | `translateX(0)→-50%`                                               | Marketing top marquee strip                                |

### The motion multiplier (`mo` / `--w-mo`)

- CSS var `--w-mo: 1` and prop `t.mo` (range **0.5–2**, step 0.1, via Tweaks "Motion scale").
- Almost every animation duration and JS `setTimeout`/`setInterval` is scaled by `mo` (e.g. `380 * mo`ms slam, `850 * mo`ms seal hold). Lowering it slows the choreography; raising it speeds it up.

### Celebration system (`CelebrationBits`, tweakable)

| `celebration` value | Particles                                                               |
| ------------------- | ----------------------------------------------------------------------- |
| `Slam` (default)    | 7 seeded ink splats (`w-splat`)                                         |
| `Ripple`            | expanding rings (`w-ripple`) + `w-soft-stamp` on the disc               |
| `Burst`             | splats **+** 16 confetti pieces (`w-confetti`) in accent/ink/cobalt/sun |

Particle layout is deterministic (a sine-hash RNG seeded per stamp), so it's stable across re-renders.

### Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

> ⚠️ **Gap to note:** this only neutralises CSS animation/transition. The many JS-driven timers (seal hold, GPS phases, auto-advance, staff lockout clock) are **not** gated by `prefers-reduced-motion` and would still fire. A production port should respect the media query in JS too.

### Paper grain

`body[data-grain="true"]::after` overlays a fixed full-screen fractal-noise SVG (`opacity: 0.45`, `mix-blend-mode: multiply`, `z-index: 9999`, `pointer-events: none`). Toggled by Tweaks "Paper grain" → `body.dataset.grain`.

---

## 5. Component states

Interactive state patterns worth reusing as reference:

| Component                                      | States                                                                                                                                                                                |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **InkButton**                                  | rest (offset shadow) → **press** (shadow collapses to `1px 1px`, `translate(3px,3px)`, 90ms) → disabled (opacity 0.45, handler removed). Press driven by `useState` + pointer events. |
| **MoToggle / TweakToggle**                     | off → on (track turns `--w-leaf` / scaffold `#34c759`), knob slides; `role="switch"` / `aria-pressed`.                                                                                |
| **StampDisc**                                  | empty (dashed ring + slot number) → filled (accent disc, `✱` + date) → **slammed** (`w-slam`/`w-soft-stamp` + `CelebrationBits`).                                                     |
| **Seal**                                       | idle → **holding** (`w-wiggle` + conic-gradient progress ring fills over `850·mo`ms) → breaking (`w-shake`) → broken (`onBroken`). "Tap" mode skips the hold.                         |
| **PinPad**                                     | dots fill as digits enter; per-key press = translate + shadow swap; auto-submits at 4 digits (`320ms` delay).                                                                         |
| **OtpBoxes**                                   | boxes mirror a hidden `one-time-code` input; the next-to-fill box shows `--w-shadow-sm`.                                                                                              |
| **GpsCheck**                                   | `locating` (cobalt dot + 3 `w-ripple` rings) → `found` (leaf `VenueMark` + `w-pop`).                                                                                                  |
| **Sheet**                                      | hidden → scrim + `w-sheet-up` slide; tap scrim to close.                                                                                                                              |
| **MkFaqItem**                                  | single-open accordion; collapsed → expanded (`w-rise` answer, `+`/`–` accent disc).                                                                                                   |
| **Tabs / filters** (merchant, admin, `MoChip`) | active = solid ink fill / paper-on-ink; inactive = dim/outline.                                                                                                                       |
| **Demo affordances**                           | `DemoTag` (dashed, `▸` prefix) for "jump/skip" shortcuts; `GhostLink` (underlined) for low-emphasis actions.                                                                          |

---

## 6. Screen-level layout patterns

- **Mobile-first thumb column.** Customer & staff surfaces are single centred columns (~410–430px max-width). Tap targets meet ≥44px: `InkButton` minHeight 54/46/38, PIN keys 60px, `GhostLink` 44px.
- **Receipt as the dominant container.** `ReceiptCard` (hard border + torn zig-zag bottom) is the recurring frame; inside it: a `MonoLine` eyebrow, a display heading, body copy, `ReceiptRule` dashed dividers, a `VenueMark` rubber stamp, and an `InkButton` CTA.
- **Fixed bottom chrome.** The app shell pins a dark **surface switcher** pill bar at `bottom:16px`; the merchant/staff "counter mode" is a large calm fixed display.
- **Bottom sheets for counter actions.** Staff stamp/redeem flows raise a `Sheet` containing `PinPad` (or `GpsCheck` when "Counter check = GPS").
- **Tab-routed wide surfaces.** Merchant (`Today / Activity / Customers / QR studio / Settings / Billing / Counter`) and Admin (`Overview / Merchants / Billing / Audit / Fraud`) are pill-tab routers. **Admin is "quieter ink"**: `--w-paper-2` panels, hard borders, almost no rotation — signalling an internal tool.
- **Marketing = a riso poster.** Marquee strip (`w-marquee`) → sticky-ish nav → single-column sections (hero, three steps, dark "counter moment" band, testimonials, pricing teaser) → footer. Pricing & legal are sibling "rooms".
- **Journey = horizontal swimlanes.** Five lanes (Merchant / Customer / Staff / Admin / Marketing), each a horizontally-scrolling row of `JyStepCard`s joined by dashed `JyArrowLink` connectors, with vertical `JyTieStrip`s marking cross-surface moments ("The counter moment", "Stripe webhooks").

---

## 7. Voice & iconography (copy conventions)

Full copy is catalogued in [copy-inventory.md](copy-inventory.md); the _rules_ the prototype follows:

- **en-GB, plain and warm.** "Save my card", "Keep your card", "Stamp your visit." Never "register" / "create an account" as a CTA verb where a warmer phrase fits.
- **No emoji. No exclamation marks.** Emphasis comes from type and the stamp motif, not punctuation.
- **A small, deliberate glyph set** (these are characters/icons, _not_ emoji):
  | Glyph | Meaning |
  | --- | --- |
  | `✱` | The Nabaperks wordmark disc / stamp signature |
  | `?` | The sealed mystery reward (on the wax `Seal`) |
  | `✓` | Confirmed / redeemed / GPS found |
  | `▸` | Demo-jump affordance prefix (`DemoTag`) |
  | `⌫` | Backspace on `PinPad` |
  | `···` / `●` | Masked phone numbers / hidden PIN digits |
- **Mono for the "machine" voice.** Card numbers (`CARD Nº OC-0248`), reward numbers (`Nº RW-8821`), dates (`12 JUN`), statuses (`SAVED TO 07123···89`) are all set in uppercase Space Mono — a consistent "stamped/printed receipt" texture.
- **Honest, low-drama system copy.** Limits and failures are stated calmly ("One stamp per UK business day", "Customers keep every stamp", "Stripe retries for a week and we email you first").
