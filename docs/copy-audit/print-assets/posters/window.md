# Window A4 poster copy audit

## Asset context

- **Format:** A4 street-facing window poster
- **Use case:** Read quickly from outside the venue
- **Tone:** Large, direct street tease
- **Source:** `config/poster-designs.json` → `templates[id="window"].copy`
- **Placeholders:** `{stamps}`

## Current copy

- **Eyebrow:** Read from the street
- **Headline:** The secret's in here.
- **Lede:** It's a sealed reward at the end of a stamp card. Step in, scan, and
  today counts as stamp one.
- **Reward explanation:** The reward's real — this venue just won't say what it
  is until your card is full at {stamps} stamps. One way to find out.
- **QR caption:** Scan, step in — today counts as stamp one

## Audit

This is a strong curiosity concept, but the headline is too context-free at
street distance. The reward value only appears in smaller copy. “Step in, scan”
is the right physical invitation, although its order should remain consistent.
The repeated “one way to find out” is atmospheric but does not reduce joining
friction.

## Recommended hierarchy

1. **Hook:** Your reward is sealed.
2. **Invitation:** Step in and start with today's visit.
3. **Value:** Fill {stamps} stamps to reveal a reward picked by this venue.
4. **Friction:** One text. No app.
5. **CTA:** Step in. Scan to start.

## Proposed field rewrite

- **Eyebrow:** A reward from this venue
- **Headline:** Your reward is sealed.
- **Lede:** Step in and start a loyalty card. Today's visit can be stamp one.
- **Reward explanation:** Fill {stamps} stamps to reveal a reward picked by
  this venue.
- **QR caption:** Step in · Scan to start your card

## Questions for the next auditor

- Does naming “reward” in the headline improve street comprehension enough?
- Is “Step in” redundant once the customer is close enough to scan?
- Should the friction line be visible at street distance or only near the QR?
