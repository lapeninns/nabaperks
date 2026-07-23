# Receipt A4 poster copy audit

## Asset context

- **Format:** A4 till-docket poster
- **Use case:** Till, pass and checkout
- **Tone:** Transactional receipt
- **Source:** `config/poster-designs.json` → `templates[id="receipt"].copy`
- **Placeholders:** `{stamps}`

## Current copy

- **Hook:** Put it on the card.
- **Card line:** Loyalty card · 0 of {stamps}
- **Today's item:** Today's visit / Stamp 1
- **Reward item:** Mystery reward / Sealed
- **Reward note:** Real, chosen by this venue, kept sealed until stamp {stamps}
  — full card, then you find out.
- **Total today:** One visit · stamp one
- **QR caption:** Scan — today rings through as stamp one
- **Footer:** Reprinted daily · Nab a Perks

## Audit

The receipt metaphor clearly demonstrates the product and makes the venue feel
accountable. “Put it on the card” can be mistaken for a payment-card instruction.
Several line items display stamp one as though it has already been issued before
the join flow is complete.

## Recommended hierarchy

1. **Hook:** Put today's visit on your loyalty card.
2. **Progress:** Start at 0 of {stamps}; today's visit can become stamp one.
3. **Value:** Full card reveals the venue's sealed reward.
4. **Friction:** One text. No app.
5. **CTA:** Scan to start your card.

## Proposed field rewrite

- **Hook:** Put today's visit on your loyalty card.
- **Card line:** Loyalty card · 0 of {stamps}
- **Today's item:** Today's visit
- **Today's value:** Can be stamp 1
- **Reward item:** Venue reward
- **Reward value:** Sealed
- **Reward note:** Picked by this venue and revealed when your card reaches
  stamp {stamps}.
- **Total label:** Start today
- **Total value:** Complete the join · add stamp one
- **QR caption:** Scan to start your card
- **Footer:** One visit stamp per UK date · Nab a Perks

## Questions for the next auditor

- Does the payment metaphor remain potentially confusing after the new hook?
- Is “can be stamp 1” too cautious for a receipt-style line item?
- Should the footer carry the no-app reassurance instead?
