# Nabaperks — The 30-Day First-Regular Launch

**The Complete Grand Slam Offer**

No-app QR loyalty for UK hospitality · £49/month · Operated by Lapen Inns

|                     |                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------ |
| **Prepared**        | 9 July 2026                                                                                      |
| **Operator**        | Lapen Inns — a hospitality operator running 9 pubs across England                                |
| **Product**         | A browser-based loyalty card customers open from your QR code                                    |
| **Framework**       | Alex Hormozi, _$100M Offers_ (Value Equation · Bonuses · Guarantees · Scarcity/Urgency · Naming) |
| **Source of truth** | Single-sourced in `lib/marketing/facts.ts` and verified by retained contract tests               |

> **A clear route to live.** Configure your venue, card, rewards and QR, then activate billing before customers join — with a launch kit included.

> **Note:** This is the durable narrative of the offer. The authoritative copy lives in `lib/marketing/facts.ts` (`OFFER`, `MARKET`, `SETUP_FEE`, `DFY_LAUNCH`, `CORE_OFFER`, `BONUS_STACK`, `GUARANTEE`, `GUARANTEE_ROI`, `SCARCITY`, `PROMO`); if the two ever disagree, the code is right and this doc should be updated.

> **Offer v3 (18 July 2026).** The commercial model was re-locked from the owner's finalised pack in `Offers- Nabaperks-Finalized/` and rebuilt into the public site: the primary wrapper is now **"The 30-Day Gastropub Mid-Week Revenue Accelerator"** (this doc's "First-Regular Launch" survives as the ASA-safer alternate, `OFFER.nameSafe`), delivery is a **done-for-you launch** with a **standard £99 setup fee, currently waived to £0 while the rolling monthly window is open (copy-only — never charged through checkout)**, the guarantee stack adds the **90-Day ROI Extension**, and honest scarcity is the real **5 DFY onboardings/week** cap. The narrative below predates v3; where it disagrees with `lib/marketing/facts.ts`, the code is right.

---

## 1. Executive summary

Nabaperks gives UK pubs, cafes, bars and takeaways a browser-based loyalty card with **no app, no wallet pass and no POS integration**. The customer scans a till QR, saves the card in their browser, and each stamp is linked to that venue QR and saved membership.

The core price is deliberately plain: **£49/month per venue, with a 30-day free pilot and cancel-anytime**. The offer _around_ that price is what makes it a Grand Slam Offer — four moves, each drawn straight from the _$100M Offers_ playbook:

- **A clear setup path.** Four configuration steps are followed by billing activation, so operators know exactly when the venue becomes live.
- **A stacked launch kit.** Five already-built assets, presented as named bonuses, each answering a real objection.
- **A guarantee with teeth.** You don't keep paying until the card brings back a first regular.
- **Honest urgency.** A real, time-boxed seasonal perk — free poster printing for venues that go live this season.

Every claim is single-sourced and honest: no invented "was" prices, fake availability counts, impossible-fraud promises, or compliance guarantees. That keeps the offer useful and defensible under UK advertising rules.

---

## 2. The offer at a glance

_One page. Everything a venue owner needs to say yes._

| Element                       | Detail                                                                                                                                                                                                                             |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **The product**               | A browser-based loyalty card customers open from your QR — no app, no Apple/Google Wallet pass, no POS or EPOS integration. Each stamp is linked to the venue QR and saved membership and limited to one per customer per UK date. |
| **The price**                 | £49/month per venue (or £490/year — two months free) · 30-day free pilot · month to month · no contract · card required, cancel anytime from your billing page.                                                                    |
| **The named offer**           | The 30-Day First-Regular Launch.                                                                                                                                                                                                   |
| **Activation path**           | Four guided configuration steps, then billing activation before customers can join and stamp.                                                                                                                                      |
| **The guarantee**             | First-Regular Guarantee — if your live card hasn't brought back a first regular by the end of your 30-day pilot, the pilot stays free until it does.                                                                               |
| **Included (the launch kit)** | Poster kit · seeded mystery reward pool · set-and-forget automations · privacy jobs handled · operator's loyalty guides.                                                                                                           |
| **This season**               | Go live by 31 August 2026 and we print and post your first counter-poster run — free.                                                                                                                                              |
| **The proof**                 | Quantitative aggregate proof stays unpublished until it can be regenerated from a durable evidence source.                                                                                                                         |

---

## 3. The strategic foundation: the Value Equation

Hormozi values every offer with one equation:

> **Value = (Dream Outcome × Perceived Likelihood of Achievement) ÷ (Time Delay × Effort & Sacrifice)**

You raise the top and drive the bottom toward zero. Here is how The 30-Day First-Regular Launch moves each driver.

| Value driver             | Goal     | How the offer moves it                                                                                                                       |
| ------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dream outcome**        | Increase | Regulars who come back — more midweek trade — without an app or a CRM. The whole offer is named after that outcome: your first regular back. |
| **Perceived likelihood** | Increase | A conditional guarantee that puts our money where our mouth is, plus each merchant's own visit and return dashboard.                         |
| **Time delay**           | Decrease | Four configuration steps are visible up front, followed by one explicit billing activation step.                                             |
| **Effort & sacrifice**   | Decrease | No app to build, no POS to connect, nothing to install. Posters are pre-designed and the reward pool is pre-seeded.                          |

> **Why the bottom half matters most.** Two products with the same dream outcome are separated by effort and uncertainty. Nabaperks reduces both with a guided checklist and a no-app mechanic, without promising an unsupported completion time.

---

## 4. The core offer: one price, everything included

£49/month per venue, or £490/year if you'd rather pay yearly (two months free). A 30-day free pilot before billing starts. Month to month, no contract, and a true cancel-anytime from your billing page. What the plan includes:

- Unlimited stamps and members
- Simple reward setup
- Permanent venue QR
- Weekly digest of visits, regulars and redemptions
- Optional location checks at your venue

**The maths we lead with:** one or two extra regulars a week can cover the cost for many venues. The dashboard records each merchant's visits and returning customers so the owner can judge the pilot from their own results.

---

## 5. The named offer (M-A-G-I-C)

An unnamed offer can't be asked for. Hormozi's naming formula makes it magnetic and un-commoditisable. The wrapper is **"The 30-Day First-Regular Launch":**

| Component               | In this offer                                                |
| ----------------------- | ------------------------------------------------------------ |
| **Magnetic reason why** | The seasonal promo — a real, time-boxed reason to start now. |
| **Avatar**              | UK pubs, cafes, bars and takeaways (named per surface).      |
| **Goal**                | Your first regular back — the dream outcome, stated plainly. |
| **Interval**            | 30 days — the pilot window.                                  |
| **Container**           | Launch — a bundle, not a commodity "loyalty app."            |

_Note:_ the product headline — _"The loyalty card that just opens."_ — stays as the product promise. The name above wraps the **offer**; per Hormozi, the wrapper can be refreshed each season without touching the mechanics.

---

## 6. A clear route to activation

> ### Build your card first. Activate it when billing is ready.
>
> Five guided steps — add your venue, build the card, confirm your pre-filled rewards, prepare your QR, and activate billing. No app to build, no POS to connect, nothing to install.
>
> _Once billing is active, customers can scan the live venue QR to join and collect their first stamp._

This is grounded in the real setup flow (venue → card → rewards → QR → billing), with the reward pool pre-seeded so step three is a confirmation, not a blank page. No invented minute count or promise that printing the QR alone makes the programme live.

---

## 7. The bonus stack: the launch kit, thrown in

A single offer is worth less than the same offer broken into named, stacked parts. These five assets already ship with every venue — here they are enumerated as bonuses, each naming the **objection it removes** and, where genuinely substantiable, **what it would cost you to assemble elsewhere** (a real comparison — never an invented "was" price).

| Bonus                                    | The objection it removes              | What it is                                                                                                                 | What it saves you                                                                  |
| ---------------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **Launch-ready till poster kit**         | No time to design counter posters.    | Five print-ready A4 counter posters with your venue QR and counter copy already laid out.                                  | The kind of counter posters you'd pay a freelance designer £150+ to make.          |
| **Done-for-you mystery reward pool**     | Not sure what rewards to run.         | A starter pool of weighted mystery rewards is seeded with your card — edit it or launch with it as-is.                     | A ready-to-run reward game — no blank page to start from.                          |
| **Set-and-forget retention automations** | No time to chase regulars by hand.    | Optional birthday treats send automatically, and a weekly digest of visits, regulars and redemptions lands in your inbox.  | The birthday messages and weekly numbers you'd otherwise chase by hand every week. |
| **Privacy jobs, handled**                | The data rules feel like a minefield. | Consent-led marketing kept separate from loyalty, an 18+ age gate at redemption, and automatic data-retention tidy-ups.    | _(mechanisms only — no price)_                                                     |
| **The operator's loyalty guides**        | Unsure what actually works in a pub.  | Three practical guides from the counter: reward ideas that suit a pub, paper vs QR, and rewarding regulars without an app. | _(included)_                                                                       |

The value of the stack is designed to eclipse the £49 — not with a fabricated total, but with real, defensible comparisons (a designer's poster fee alone clears £150) and hours-per-week saved. Everything is framed as **included with the one price**, never "normally sold separately."

---

## 8. The First-Regular Guarantee (risk reversal)

Reversing risk is the number-one way to lift conversion. This is a **conditional service guarantee** — Hormozi's personal favourite — because it guarantees the outcome and removes the element of time.

> ### First-Regular Guarantee
>
> **If your live card hasn't brought back a first regular by the end of your 30-day pilot, the pilot stays free until it does.**
>
> Best case, your regulars come back and the £49 pays for itself. Worst case, you pay nothing more until one does.
>
> Applies from the day your venue QR goes live. Email info@lapeninns.com and the team applies the extension.

Mechanically, the guarantee is honoured as a manual Stripe trial extension — no billing code depends on the copy, and no regular is ever left holding a broken seal. It is an owner-approved commercial promise, deliberately distinct from any (banned) compliance guarantee.

---

## 9. Scarcity & urgency: the rolling seasonal promo

Honest urgency needs something real to be scarce. This is a **rolling seasonal promo** — a genuine perk with a genuine deadline that the operator will actually fulfil, refreshed each season.

> ### Summer First-Regular promo — ends 31 August 2026
>
> **Go live by 31 August 2026 and we print and post your first counter-poster run — free.**
>
> Go live before the date, then email info@lapeninns.com and we sort your print run.

Two honesty safeguards are built in. The promo only renders while it is switched on (`PROMO.enabled`), so nothing depends on a live countdown; and an automated check (`isPromoStale`) **fails the build the moment the deadline passes**, forcing a deliberate refresh or switch-off. A stale, past-dated promo can never quietly linger — which is exactly what UK advertising rules (and Hormozi) demand of urgency.

---

## 10. The honesty & risk-reversal posture

What makes this offer defensible as well as persuasive:

- **True cancel-anytime.** No notice period; cancellation takes effect at the end of the billing month, earned rewards stay redeemable.
- **No invented anchors.** Bonus values are real external comparisons or genuine time savings — never a fabricated RRP or "was" price (UK CAP Code).
- **Mechanisms, not compliance claims.** The privacy bonus describes what it does (consent separation, 18+ age gate, retention tidy-ups) — never "GDPR guaranteed" or "compliant," which are hard-banned in copy.
- **Real commitments.** The guarantee and the promo are honoured by manual ops — a trial extension and a poster print run — not empty marketing.

---

## 11. The full assembled pitch

_How it reads, top to bottom, on the page and in the room._

**The loyalty card that just opens.**

No-app QR loyalty for UK cafes, takeaways and pubs. Your customer scans the till QR and the card opens in their browser — saved in one tap, with no app and no Apple or Google Wallet pass to install. Each stamp is tied to the venue QR and saved membership and capped at one per customer per UK date.

**One price. Everything included.** £49/month per venue, a 30-day free pilot, month to month, cancel anytime. At £49/month, one or two extra regulars a week can cover it.

**Build your card first. Activate it when billing is ready.** Four configuration steps prepare the venue, card, rewards and QR; billing is the fifth gate. Once billing is active, customers can join from the live QR and collect stamps.

**The 30-Day First-Regular Launch — the launch kit, thrown in.** A launch-ready till poster kit, a done-for-you mystery reward pool, set-and-forget retention automations, your privacy jobs handled, and the operator's loyalty guides — all included with the one price.

**The First-Regular Guarantee.** If your live card hasn't brought back a first regular by the end of your 30-day pilot, the pilot stays free until it does. Best case, your regulars come back and the £49 pays for itself. Worst case, you pay nothing more until one does.

**Start this season.** Go live by 31 August 2026 and we print and post your first counter-poster run — free. Start your free pilot today.

---

## Appendix A. Hormozi lever → what we built

| _$100M Offers_ lever            | What it says                                                              | What ships in the offer                                                                              |
| ------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Value Equation — time delay** | Cut uncertainty and effort.                                               | `SETUP` activation copy: four configuration steps, then billing, then the first live join and stamp. |
| **Bonuses**                     | Break the offer into named, stacked parts; ascribe a justified price tag. | `OFFER_STACK`: five named bonuses, each with an objection removed and a real anchor.                 |
| **Guarantees**                  | Reverse risk with a conditional "if not X in Y, then Z."                  | First-Regular Guarantee (conditional service guarantee) + best/worst framing.                        |
| **Scarcity & urgency**          | Make it real; never a phony countdown.                                    | Rolling seasonal `PROMO`, real deadline, `isPromoStale` auto-expiry tripwire.                        |
| **Naming (M-A-G-I-C)**          | Wrap the offer so the avatar can ask for it.                              | "The 30-Day First-Regular Launch."                                                                   |

## Appendix B. Provenance & verification

- **Single source of truth:** all copy lives in `lib/marketing/facts.ts` (`OFFER`, `SETUP`, `OFFER_STACK`, `GUARANTEE`, `PROMO`) — no marketing surface forks a literal.
- **Contracts:** retained billing, merchant launch, legal, and promo tests protect the offer's durable product behaviour.
- **Verified when shipped:** lint, typecheck, build, contract tests, bundle, banned-claims, JSON-LD and design-token checks.
- **Renders on:** `/signup`, merchant billing/launch surfaces, and `/terms` where applicable.
- **Delivery:** retained as shared product and commercial facts after the public acquisition pages were removed.

## Appendix C. Owner action items

Before this reaches production:

- **Operate the promo.** Keep the free first counter-poster print-and-post commitment staffed, or switch the promo off with `PROMO_CONFIG.enabled = false`. Do not publish availability counts without a durable reservation ledger.
- **Refresh cadence.** Roll the promo each season (new perk/date) rather than letting one lapse — the build will remind you (`isPromoStale`) if a deadline passes.

---

_Nabaperks is operated by Lapen Inns. This document reflects the offer as built on 9 July 2026 and is grounded in Alex Hormozi's_ $100M Offers.
