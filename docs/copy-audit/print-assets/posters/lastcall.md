# Last Call A4 poster copy audit

## Asset context

- **Format:** A4 late-evening poster
- **Use case:** Bar and evening placements
- **Tone:** Honest daily urgency
- **Source:** `config/poster-designs.json` → `templates[id="lastcall"].copy`
- **Placeholders:** `{stamps}`

## Current copy

- **Eyebrow:** Honest deadline
- **Headline:** Today expires at midnight.
- **Badge:** Valid today only
- **Lede:** So does its stamp. Join at the QR and today's visit counts as stamp
  one — stamps go one per UK date, and tomorrow gets its own.
- **Reward explanation:** The reward stays sealed until your card is full at
  {stamps} stamps. No rush on that part; the only clock is on today.
- **QR caption:** Scan tonight — today counts as stamp one

## Audit

This is the strongest urgency concept because midnight matches the UK-date
rule. It should not be weakened to “closing”, which varies by venue and may
cross midnight. The headline communicates loss before value, however. The
customer needs to see that a reward card—not merely a stamp—is available.

## Recommended hierarchy

1. **Hook:** Make today stamp one.
2. **Urgency:** Today's chance ends at midnight.
3. **Value:** Fill {stamps} stamps to reveal the sealed reward.
4. **Friction:** One text. No app.
5. **CTA:** Scan before midnight to start your card.

## Proposed field rewrite

- **Eyebrow:** Today's visit can count
- **Headline lead:** Make today
- **Headline accent:** stamp one.
- **Badge:** Today only
- **Lede:** Complete the join before midnight and today's visit can start your
  card. Tomorrow begins a new UK date.
- **Reward explanation:** Fill {stamps} stamps to reveal a reward picked by
  this venue. Only today's first-stamp opportunity has a deadline.
- **QR caption:** Scan to start with today

## Questions for the next auditor

- Is midnight understandable and accurate for venues trading after midnight?
- Does urgency overshadow the mystery reward?
- Should the CTA say “before you leave” instead of “before midnight”?
