# Nabaperks v2 — "Wet Ink" redesign prototype

A from-scratch rethink of the whole product. **Exploration only** — once a direction
is approved, tokens/components get promoted into the design system proper
(`tokens/`, `components/`, `templates/`) as the new v2 system.

Open `index.html`. Bottom pill switches surface (Customer / Merchant / Marketing).
The Tweaks panel explores **motion & celebration**: stamp moment (Slam / Ripple /
Burst), seal reveal (Hold / Tap), motion scale, accent ink, paper grain.

## Design thesis

1. **Architect around the counter moment, not the data model.** Customer and staff
   share one screen: the customer's card *is* the stamping surface. Tapping
   "I'm at the counter" slides up a staff PIN pad; staff type 4 digits on the
   customer's phone; a rubber stamp slams down. No staff URL, no second device.
2. **Value before friction.** Scanning the QR shows the live card and "your first
   stamp is waiting" — the first stamp is collected *before* any signup. Identity
   is deferred: "Keep your card" (one text, no password) only after the stamp
   exists. Skippable.
3. **Mystery reward as physical payoff.** Visit three puts a wax seal on the card;
   the customer presses-and-holds to break it. Next-business-day rule kept and
   framed warmly ("give it a day to breathe").
4. **Merchant gets a Today screen, not a dashboard.** Live till feed + four counts.
   Analytics demoted to a weekly digest. Setup is a 3-step wizard that ends with
   printing the QR. Counter mode is a dark pinned-tab view for staff.

## Visual direction — "Wet Ink"

Riso-print / rubber-stamp: the product's core verb (stamping) is the visual
language. Paper `#F6F1E6` + ink `#211C16` + one hot accent (vermillion default),
hard offset shadows, 2px ink borders, receipt cards with perforated zigzag edges,
circular rubber-stamp marks rotated -6°, paper grain overlay.
Type: Bricolage Grotesque (display) + Space Mono (receipt/meta). Google Fonts.

## Files

- `index.html` — entry · `v2.css` — tokens + keyframes
- `shared.jsx` — primitives (InkButton, ReceiptCard, StampDisc/Row, PinPad,
  OtpBoxes, Sheet, Seal, VenueMark, CelebrationBits…)
- `customer.jsx` / `merchant.jsx` / `marketing.jsx` — surfaces
- `app.jsx` — shell, surface switcher, Tweaks wiring

Not yet covered: admin console, billing screens, merchant login/auth.
