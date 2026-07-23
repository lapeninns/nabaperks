# Tally A4 poster copy audit

## Asset context

- **Format:** A4 table or till poster
- **Use case:** Demonstrate the loyalty-card object
- **Tone:** Visual progress and circles
- **Source:** `config/poster-designs.json` → `templates[id="tally"].copy`
- **Placeholders:** `{stamps}`, `{StampsWord}`

## Current copy

- **Eyebrow:** Card on the table
- **Headline:** {StampsWord} circles. One secret.
- **Card count:** 0 of {stamps}
- **Explainer:** The first circle is today's — join at the QR below and today's
  visit counts as stamp one. The amber one holds something real; this venue
  won't say what it is until your card is full.
- **Date rule:** One stamp per UK date
- **QR caption:** Scan — today inks circle one

## Audit

The progress metaphor makes the product tangible, but “circles” needs the
visible card graphic to make sense. The explainer is long and repeats the
withholding language. The current QR caption is distinctive but implies the
scan itself inks the circle.

## Recommended hierarchy

1. **Hook:** {StampsWord} stamps. One sealed reward.
2. **Progress:** Start with today's visit and fill the card.
3. **Value:** The final stamp reveals a reward picked by this venue.
4. **Friction:** One text. No app.
5. **CTA:** Scan to start circle one.

## Proposed field rewrite

- **Eyebrow:** Your loyalty card
- **Headline:** {StampsWord} stamps. One sealed reward.
- **Card count:** 0 of {stamps}
- **Explainer:** Complete the join and today's visit can fill circle one. Fill
  the card to reveal a reward picked by this venue.
- **Date rule:** One visit stamp per UK date
- **QR caption:** Scan to start your card

## Questions for the next auditor

- Should the headline say “circles” to match the distinctive visual?
- Is the dynamic number prominent enough to explain the commitment?
- Can the explainer lose “complete the join” without becoming inaccurate?
