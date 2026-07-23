# Pinned A4 poster copy audit

## Asset context

- **Format:** A4 notice-board poster
- **Use case:** Community board and familiar venue spaces
- **Tone:** Warm note to regulars
- **Source:** `config/poster-designs.json` → `templates[id="pinned"].copy`
- **Placeholders:** `{stamps}`

## Current copy

- **Eyebrow:** A note for regulars
- **Headline:** You again? Good.
- **Lede:** First time or fiftieth, today can count for something. Join at this
  QR and today's visit counts as stamp one — {stamps} stamps fill the card, and
  this venue keeps the reward sealed until it's full.
- **QR caption:** Scan — make today count
- **Stub:** Stamp one / today

## Audit

The headline is memorable and venue-like, although some customers may read it
as mildly confrontational. The body contains the whole proposition but is too
long for a notice-board glance. The CTA is strong because it turns today into
progress without overexplaining.

## Recommended hierarchy

1. **Hook:** Regular here? Make today count.
2. **Belonging:** First visit or fiftieth, keep a card with this venue.
3. **Value:** Fill {stamps} stamps to reveal the venue's sealed reward.
4. **Friction:** One text. No app.
5. **CTA:** Scan to start with today.

## Proposed field rewrite

- **Eyebrow:** A note for regulars
- **Headline:** Regular here? Make today count.
- **Lede:** First visit or fiftieth, start a card with this venue. Today's visit
  can be stamp one. Fill {stamps} stamps to reveal your reward.
- **QR caption:** Scan to start with today
- **Stub top:** Stamp one
- **Stub bottom:** can start today

## Questions for the next auditor

- Is “You again? Good.” worth preserving as the more distinctive hook?
- Does “Regular here?” exclude first-time customers despite the supporting line?
- Is “start with today” sufficiently clear about completing the join?
