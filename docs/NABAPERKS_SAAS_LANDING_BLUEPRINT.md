# Nabaperks SaaS Landing Page Blueprint

Last reviewed: 2026-06-26

Reading this as: B2B local-venue SaaS landing page for UK independent food and
drink venues, with a QR-first, proof-before-price conversion flow in the Wet Ink
product language.

This blueprint defines the `/` acquisition page for Nabaperks. It adapts the
generic indie-SaaS landing template to the actual codebase and product model:
permanent venue QR, no customer app, phone-first customer identity, one stamp per
UK business day, privacy by default, and a merchant 30-day pilot.

## Current Code Readback

The current root route in `app/page.tsx` is:

```text
MarketingLayout
  -> Hero
  -> Proof strip
  -> MarketingHowItWorksSection
  -> Trust + pricing preview
  -> FAQ + final CTA
  -> MarketingLayout footer
```

Supporting source:

- `components/layout/marketing-layout.tsx` owns the marquee, sticky header,
  default marketing links, signup CTA, footer, customer recovery links, and legal
  links.
- `components/marketing/hero-loyalty-card.tsx` owns the hero product object:
  receipt card, stamp grid, QR frame, venue mark, and sealed mystery reward.
- `components/marketing/how-it-works-section.tsx` owns the animated counter
  story: scan, save, stamp, reward.
- `app/pricing/page.tsx` owns the fuller Growth Plan page and Stripe checkout
  entry.
- `tests/micro-specs/marketing-redesign.test.ts` and
  `tests/micro-specs/marketing-auth-legal.test.ts` already encode the compact
  marketing-page source contract.

Verdict: the page is no longer a thin hero-to-pricing page. The right blueprint
is not "add every SaaS section"; it is "keep the page compact, add only product
proof that makes the £29/month pilot feel obvious, and avoid fake social proof."

## Positioning

One-line promise:

> Replace paper loyalty cards with one venue QR.

Audience:

- Cafes and coffee shops
- Takeaways
- Casual restaurants
- Food-led pubs
- Dessert and bubble tea shops
- Other single-location food and drink venues that rely on repeat visits

Primary conversion goal:

> Create a merchant account and start the 30-day pilot.

Primary CTA:

> Start a merchant trial

Secondary CTA:

> See how it works

Pricing CTA:

> View pricing

## Perfect Page Flow

Use this order, with no more than eight literal top-level `<section>` blocks in
`app/page.tsx`:

1. Navbar
2. Hero
3. Proof strip / operational social proof
4. Counter flow
5. Venue benefits plus product proof
6. Trust plus pricing
7. FAQ plus final CTA
8. Footer

This keeps the visitor moving from:

> What is this? -> Why is it useful? -> How does it work? -> Why should I trust it? -> What does it cost? -> What do I do?

The old long sales-deck model is intentionally collapsed. Do not split problem,
solution, pilot venues, use cases, pricing, FAQ, and final CTA back into separate
full-height blocks unless there is new public proof or real conversion data
showing the extra scroll is needed.

## Template Adaptation

The pasted indie-SaaS template is useful for sequencing, but not for literal
sections:

| Template idea                             | Nabaperks adaptation                                                                                                                         |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Header with Features, Pricing, FAQ, Login | `How it works`, `Pricing`, `Log in`, `Start trial`. `Features` is too generic for the counter-flow product.                                  |
| Hero with demo image                      | Keep the split hero, but the visual must be a Wet Ink loyalty card/QR object, not a dashboard screenshot.                                    |
| Social proof after hero                   | Use a thin operational proof strip now. Add logos or testimonials only when real pilot evidence is approved.                                 |
| Problem / pain                            | Compress into counter-specific copy: paper cards get lost, apps create friction, manual stamps are easy to fake. Avoid a heavy pain section. |
| Feature breakdown                         | Reframe as product mechanics: permanent QR, browser card, server-side daily stamp, sealed mystery reward, merchant-scanned collection.       |
| Outcome / time saved                      | Use truthful buckets: under-five-minute setup, under-ten-second scan-to-stamp, 30-day free pilot. Avoid fake precision.                      |
| Testimonials                              | Future-only. Do not invent maker-style quotes for venues.                                                                                    |
| Pricing                                   | Keep after proof and mechanics. `/pricing` remains the full plan and checkout surface.                                                       |
| FAQ                                       | Already real copy. Keep it short and specific to app, hardware, stamp honesty, location, consent, and price.                                 |
| Final CTA                                 | Keep compact. Repeat the hero conversion action, not a full-screen closing panel.                                                            |

## 1. Navbar

Structure:

```text
Logo | How it works | Pricing | Log in | Start trial
```

Rules:

- Keep `Start trial` as the only primary nav CTA.
- Link `How it works` to `#how-it-works`.
- Link `Pricing` to `/pricing`.
- Link `Log in` to `/login`.
- Link `Start trial` to `/signup`.
- Keep the customer recovery path as a quiet inline or footer link.

## 2. Hero

Goal: explain the product in five seconds.

Copy:

```text
No-app loyalty for food and drink venues
Replace paper loyalty cards with one venue QR.
Customers scan, save a browser card, and collect one honest stamp per day.
```

Hero actions:

- `Start a merchant trial` -> `/signup`
- `See how it works` -> `#how-it-works`
- `Open my cards` -> `/home`
- `Scan a venue QR` -> `/scan`

Hero visual:

- Receipt-style loyalty card
- Three-stamp progress row
- Permanent QR frame
- Mystery reward seal
- Venue mark

Rules:

- Use a real Wet Ink product object, not a fake SaaS dashboard.
- Keep the hero split on desktop: copy left, product object right.
- Keep the CTA visible before the second mobile scroll where practical.
- Do not add stock photography, generic gradients, or fake dashboard rectangles.

## 3. Proof Strip

Keep this as a thin dashed band:

```text
<5 min    to set the venue up
<10 sec   from scan to stamp
30 days   free, card required
```

Do not add fake adoption metrics or unapproved customer logos.

## 4. Counter Flow

Section id: `#how-it-works`

Headline:

> Scan, save, stamp, reward.

Body:

> The customer keeps their phone. Your team keeps the queue moving. Every loyalty action stays server-side and auditable.

Steps:

```text
Scan
The permanent venue QR opens the card in the phone browser.

Save
One text confirms the number. No app, password, or plastic card.

Stamp
The customer taps once. Postgres allows one stamp per UK business day.

Reward
The mystery reward unlocks for one merchant-scanned collection.
```

Rules:

- Use `Save`, not `Join`, for the customer-facing beat.
- Never say customers hand their phone to staff.
- Keep route mechanics implicit; visible copy should stay plain.

## 5. Venue Benefits Plus Product Proof

Goal: compress the old problem, solution, benefits, use-case, and product-preview
sections into one useful block.

Current implementation note: this is the one structural gap versus the perfect
blueprint. The live page already has hero proof, stats, counter flow, trust,
pricing, FAQ, and CTA. If the landing page needs one more conversion lift, add a
single compact benefits/product-proof band here rather than reintroducing a long
problem/solution deck.

Heading:

> Built for the counter, not the boardroom.

Benefits:

- No app, no plastic
- The phone never crosses the counter
- One stamp a day, honest
- Mystery rewards bring people back
- Built for food and drink venues

Product proof object:

```text
Live product shape
Card, reward, and QR kit in one setup flow.
```

The proof object should show:

- Customer card with stamp grid
- Sealed mystery reward
- Reward collection QR
- Collected reward state

Rules:

- Use one composed receipt object rather than three separate preview cards.
- Keep real loyalty components: `ReceiptCard`, `StampGrid`, `RewardSeal`,
  `QrFrame`, and `DemoQr`.
- Do not bring back separate pilot venue or use-case grids without approved
  public proof.
- Keep the section focused on venue outcomes, not abstract software features.
  Good: "one QR at the till", "one stamp a day", "reward collected by merchant
  scan". Bad: "CRM", "engagement engine", "automated campaigns".

## 6. Trust Plus Pricing

Section id: `#pricing`

Heading:

> Stamped, not tracked.

Body:

> Customer loyalty participation and marketing opt-in stay separate. Pricing stays just as plain.

Trust points:

- Every stamp is on the record
- Scoped to your venue
- Private by default
- Marketing is separate

Pricing receipt:

```text
Growth Plan
£29/month
GBP 29/month · one venue · no contracts
Card required to go live
```

Included list:

- Unlimited stamps and members
- Mystery reward pool
- Printed QR kit: poster, till card, sticker
- Weekly digest of visits and redemptions

Rules:

- Say `£29/month` in customer-facing copy.
- Say `GBP 29/month` only in mono receipt metadata.
- Keep `/pricing` as the detailed pricing and Stripe checkout entry.

## 7. FAQ Plus Final CTA

Section id: `#faq`

FAQ should stay to five questions or fewer:

1. Do customers need an app or extra hardware?
2. How is a stamp kept honest?
3. What if location looks wrong?
4. Can people collect stamps without marketing consent?
5. What does it cost after the pilot?

Final CTA:

```text
Set up your venue this afternoon.
Run the pilot free for 30 days, with a card required to activate.
Then it is £29/month for one venue.
```

Actions:

- `Start a merchant trial` -> `/signup`
- `View pricing` -> `/pricing`
- `Merchant login` -> `/login`

## Source Contract

The root page must stay compact:

- `app/page.tsx` should render no more than eight literal top-level `<section>`
  blocks.
- The homepage FAQ should define no more than five `q:` entries.
- Do not import `MarketingProblemSection` or `MarketingSolutionSection` into
  `app/page.tsx`.
- Do not reintroduce `pilotVenues` or `useCases` arrays on the homepage.

The focused source contract lives in:

```text
tests/micro-specs/marketing-redesign.test.ts
```

Any implementation of this blueprint should also preserve the auth/legal landing
contracts in:

```text
tests/micro-specs/marketing-auth-legal.test.ts
```

Required route targets:

```text
Start a merchant trial -> /signup
See how it works       -> #how-it-works
View pricing           -> /pricing
Log in                 -> /login
Open my cards          -> /home
Scan a venue QR        -> /scan
Terms                  -> /terms
Privacy                -> /privacy
```

## Copy Rules

- Use British English.
- Sound like a local food and drink product, not enterprise SaaS.
- Prefer `venue` over `company`.
- Prefer `customers` or `regulars` over `users`.
- Prefer `food and drink venues` over `all local businesses`.
- Prefer `save my card` over `create an account` for customer surfaces.
- Avoid `download`, `register`, `revolutionise`, `seamless`, `next-gen`, and
  `all-in-one`.
- Do not promise POS integration, CRM, automated marketing, native apps, wallets,
  gift cards, referrals, or multi-location tools.
- Do not imply staff secrets, shared PINs, or staff phone handover as the trust
  model.

## Visual Direction

Use the existing Wet Ink system:

- Warm paper background
- Ink text and borders
- Vermillion primary CTA
- Hard offset shadows
- Receipt cards
- Dashed rules
- Stamp grid
- QR frame on white
- Mystery reward seal
- Hugeicons through the brand `Icon` wrapper

Avoid:

- Generic purple SaaS gradients
- Glassmorphism
- Office stock photography
- Fake dashboard rectangles
- Three identical feature-card towers
- Decorative status dots
- Emoji

## Measurement Plan

Track these landing-page events in Supabase product events and mirror to PostHog
where appropriate:

- `marketing_home_viewed`
- `marketing_hero_cta_clicked`
- `marketing_how_it_works_clicked`
- `marketing_pricing_clicked`
- `marketing_faq_opened`
- `merchant_signup_started`
- `pricing_page_viewed`
- `checkout_started`

Primary funnel:

```text
/ -> /signup -> /app/onboarding -> /app/launch -> QR generated -> first customer scan -> first customer stamp
```

Secondary funnel:

```text
/ -> /pricing -> Stripe Checkout -> /app/account billing state
```
