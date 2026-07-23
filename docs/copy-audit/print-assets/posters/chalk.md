# Chalk A4 poster copy audit

## Asset context

- **Format:** A4 chalk-board poster
- **Use case:** Specials board and bar back
- **Tone:** Handwritten venue special
- **Source:** `config/poster-designs.json` → `templates[id="chalk"].copy`
- **Placeholders:** `{stamps}`

## Current copy

- **Eyebrow:** Specials, sort of
- **Headline:** The special is sealed.
- **Lede:** Join at the QR — today counts as stamp one, and {stamps} stamps fill
  the card.
- **Reward explanation:** The special's real — chalked up as a mystery, and
  this venue won't say what it is until your card's full. {stamps} stamps and
  you find out.
- **QR caption:** Scan — chalk up today as stamp one
- **Stub:** Stamp one / today

## Audit

The venue-native visual voice is strong. “Special” may imply a food or drink
special rather than a loyalty reward, and the supporting copy repeats the same
mechanism twice. “This venue won't say” again frames the venue as withholding
rather than rewarding.

## Recommended hierarchy

1. **Hook:** A reward is behind this card.
2. **Progress:** Today's visit can start your {stamps}-stamp card.
3. **Value:** Fill it to reveal a reward picked by this venue.
4. **Friction:** One text. No app.
5. **CTA:** Scan to chalk up stamp one.

## Proposed field rewrite

- **Eyebrow:** Today's loyalty special
- **Headline lead:** Your reward
- **Headline accent:** is sealed.
- **Lede:** Complete the join and today's visit can start your {stamps}-stamp
  card.
- **Reward explanation:** Fill the card to reveal a reward picked by this
  venue.
- **QR caption:** Scan to start your card
- **Stub top:** Stamp one
- **Stub bottom:** can start today

## Questions for the next auditor

- Can “special” be retained without suggesting an immediate menu offer?
- Would “Your reward is sealed” make this too similar to the other designs?
- Is the chalk metaphor stronger in the headline or the CTA?
