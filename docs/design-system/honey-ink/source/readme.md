# Nabaperks Design System — "Wet Ink" (v2)

> Riso-print tactility for local counter-service businesses.
> Paper + ink + one hot spot colour. Loyalty, stamped before the coffee cools.

Nabaperks is a **UK no-app QR loyalty platform** for independent local venues —
cafes, pubs, dessert shops, barbers. It replaces paper loyalty cards with a
browser-based **stamp card**: scan the till QR → the first stamp is collected
**before any signup** → staff approve stamps with a 4-digit PIN typed on the
customer's own phone (**the counter moment**) → a **mystery reward seal** breaks
at the third visit → redeemable the next business day.

This is **v2** — a ground-up redesign of flows and visuals. The redesign thesis:

1. **Architect around the counter moment.** Customer and staff share one screen;
   the card *is* the stamping surface (PIN pad in a bottom `Sheet`).
2. **Value before friction.** The first stamp lands before identity. "Keep your
   card" (phone + OTP, skippable) comes *after* — saving, never "registering".
3. **Mystery reward as a physical payoff.** A gold wax `Seal` broken by
   press-and-hold; rewards "breathe" until the next business day.
4. **Merchants get a Today screen, not a dashboard.** Live till feed + four
   counts; analytics demoted to a weekly digest; setup ends with printing the QR.

Consumers link one file — `styles.css` — and use the React components bundled
into `_ds_bundle.js` (namespace `NabaperksDesignSystemHoneyInk_4fb4ef`; the
"HoneyInk" name is a stable legacy identifier from v1 — do not change it).

---

## Sources & history

- **Codebase:** `Nabaperks/` — Next.js 16 / React 19 / Tailwind 4 production app
  (read-only mount). Source of truth for the product spec, journeys and data
  model (`docs/PROJECT_SPEC.md`). Its shipped visual system was v1 "Honey & Ink".
- **v1 "Honey & Ink"** (warm cream / honey amber / pill shapes) was extracted from
  that codebase first, then superseded by this v2 after a full UX/UI rethink.
- **v2 prototype:** `v2/` — the interactive full-product prototype (customer,
  merchant, marketing surfaces + Tweaks). The design decisions live there;
  this design system is its productised extraction. See `v2/README.md`.
- The `Nabaperks/druto-*` screenshots are an unrelated external site; never a
  visual source.

> **Fonts:** Bricolage Grotesque + Space Mono, served from **Google Fonts** via
> `tokens/fonts.css`. For self-hosted binaries drop `.woff2` files into
> `assets/fonts/` and swap the `@import` for `@font-face` rules.

---

## Content fundamentals

**Voice:** plain, warm, **British** (en-GB). The product talks like a good
barista, not a SaaS.

- **Value before friction, in copy too.** "Your first stamp is waiting." leads;
  signup language is banned — it's "Keep your card", "Save my card", "one text,
  no password". Never "register", "create an account", "unlock perks".
- **Celebrate in few words.** "That's one." · "Enjoy." · "Something's under
  there." Short declaratives at emotional peaks; **no exclamation marks, no emoji**.
- **Rules framed warmly.** Next-business-day redemption is "Give it a day to
  breathe — it's yours from opening time tomorrow."
- **Concrete numbers:** "3 visits", "£29/month", "30-day pilot", "<5 min".
- **Receipt voice** (Space Mono, uppercase) for facts: "CARD Nº OC-0248",
  "ONE STAMP PER BUSINESS DAY", "PILOT · DAY 23 OF 30". Spoken voice
  (Bricolage) for everything human. Never mix registers in one line.
- Eyebrows/kickers are short mono uppercase: "SCANNED AT THE COUNTER",
  "NO-APP LOYALTY FOR LOCAL VENUES".

---

## Visual foundations

**Aesthetic — Wet Ink.** Riso-print / rubber-stamp: flat spot inks on warm
paper, hard offset shadows, perforated receipt edges, rotated stamp marks.
The product's core verb — *stamping* — is the entire visual language.

- **Colour.** Warm paper (`--w-paper #F6F1E6`, never white) and warm near-black
  ink (`--w-ink #211C16`), plus a few flat **spot inks**: vermillion accent
  (action/stamps — themeable), cobalt (info/joins), leaf (success/ready),
  sun (the mystery seal). Cards are `--w-card #FBF8F1`. QR codes always sit on
  **pure white**. No gradients except functional ones (zigzag edge, conic ring).
- **Type.** **Bricolage Grotesque** for everything spoken (headings always
  **800**, tight leading, slight negative tracking on display sizes);
  **Space Mono** for everything printed — IDs, codes, dates, eyebrows, feeds.
- **Shape.** Sharp-ish print shapes: **10px radius** on buttons/cards/keys,
  18px on sheets, **full circles reserved for the stamp family** (stamps, seals,
  marks — always rotated -6° to -8°). 2px solid ink borders everywhere;
  2px dashed for empty slots, receipt rules and demo chrome.
- **Elevation.** **Hard offset shadows, never blurred:** 4px 4px 0 ink (cards),
  3px 3px 0 (small), collapsing to 1px 1px 0 + translate(3px,3px) on press.
  Receipt cards use `filter: drop-shadow()` so the zigzag edge casts too.
- **Backgrounds.** Flat paper with an optional **grain overlay**
  (`<body data-grain="true">`). No photography, no textures beyond grain, no
  decorative blobs. The receipt card, QR and stamp marks are the only graphics.
- **Motion.** One slam easing (`--w-ease-slam`, overshoot) for stamps; one
  standard easing (`--w-ease`) for everything else. Press 90ms; sheets 320ms;
  slam 380ms + 300ms paper shake; one-shot particles (splat/confetti/ripple)
  480–900ms. All durations scale by a motion multiplier (`mo`). Everything
  respects `prefers-reduced-motion`.
- **States.** *Press* = shadow collapses into the paper (the system-wide
  signature). *Disabled* = 45% opacity. *Focus/selected* = the hard shadow acts
  as the cursor (see OtpBoxes). Hover effects are minimal — this is a
  mobile-first, touch-first system.
- **Layout.** Customer column max 410px (thumb zone), merchant 1060px,
  marketing 1100px. 4px spacing base; 14px gaps between cards, 22px between
  sections. Primary tap targets ≥ 44px (buttons 54px, PIN keys 60px).
- **Transparency & blur.** Scrims only (`rgba(33,28,22,0.5)` under sheets).
  No glassmorphism.
- **Playfulness budget:** marketing may rotate cards ±2° and run the marquee
  strip; product surfaces stay straight except the stamp-family marks.

---

## Iconography

**No icon library.** The brand communicates with its own geometric vocabulary:

- **✱** — the stamp glyph (collected visits, the wordmark disc).
- **? / ✓** — seal states (mystery / redeemed), set in Bricolage 800.
- **Status dots** — 11px ink-bordered circles in spot inks (feed semantics:
  vermillion stamp, sun reward, cobalt join, leaf redeem).
- **Dashed circles** — empty stamp slots, numbered in mono.
- **→ / ⌫ / ·** — unicode glyphs inline with text.

If a new surface genuinely needs glyph icons, use **Lucide** from CDN (rounded
caps match) and flag it as an addition. Emoji are never used. The QR code is a
functional graphic — always inside a white, ink-bordered frame.

Assets present: `assets/favicon.ico` (from the app). The wordmark is markup
(accent disc + "nabaperks" lowercase 800), not an image.

---

## Index / manifest

**Root**
- `styles.css` — single entry point (`@import` manifest). Consumers link this.
- `readme.md` — this guide. · `SKILL.md` — Agent-Skills front door.
- `_ds_bundle.js`, `_ds_manifest.json` — generated; do not edit.

**Tokens** (`tokens/`)
- `fonts.css` (Google Fonts) · `colors.css` (paper/ink/spot + semantic + loyalty
  aliases) · `typography.css` (families, scale) · `spacing.css` (spacing, shape,
  hard shadows, motion tokens) · `base.css` (resets, grain, **all keyframes**)
  · `components.css` (portable `.w-*` classes for plain HTML).

**Components** (`components/`, React → `window.NabaperksDesignSystemHoneyInk_4fb4ef`)
- `core/` — InkButton, GhostLink, MonoTag, MonoLine.
- `forms/` — PinPad (the counter moment), OtpBoxes.
- `loyalty/` — StampRow + StampDisc, ProgressLine, Seal, VenueMark, CelebrationBits.
- `surfaces/` — ReceiptCard + ReceiptRule, Sheet.

**UI kits** (`ui_kits/`) — thin mounts of the v2 prototype surfaces:
`customer-app/` (card + counter moment), `merchant-app/` (Today / Setup /
Counter mode), `marketing/` (poster hero).

**Templates** (`templates/`) — copy-to-start Design Components:
`customer-stamp-card/`, `merchant-today/`, `marketing-hero/`.

**Prototype** (`v2/`) — the living full-product prototype with Tweaks
(celebration style, seal reveal, motion scale, accent ink, grain). Design
decisions land here first, then get extracted into tokens/components.

**Guidelines** (`guidelines/`) — specimen cards for the Design System tab
(Colors ×3, Type ×3, Spacing ×3, Brand ×2).
