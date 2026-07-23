# Welcome A4 table tent copy audit

## Asset context

- **Format:** A4 folded table tent, two customer-facing panels
- **Use case:** Welcome-led variant for a seated customer
- **Tone:** Warm invitation with a regulars payoff
- **Source:** `config/table-tent-designs.json` → `designs[id="welcome"]`
- **Placeholders:** None

## Previous copy

### Face A

- **Headline:** Regulars keep / a card / here.
- **Accent:** here.
- **Body:** Your card opens from this code and remembers every visit. Fill it
  and the sealed reward opens.
- **CTA:** Scan · Become a regular

### Face B

- **Headline:** This table / starts your / card.
- **Accent:** card.
- **Body:** Stamp one lands the second you scan. One per UK date — leave without
  scanning and today's is gone.
- **CTA:** Claim before you leave

### Shared footer

- **Friction:** 10 seconds · No app · No password
- **Left:** One stamp per UK date — today's expires at closing
- **Right:** No app · Opens in your browser

## Audit

This variant reverses the Regulars faces but does not currently create a
distinct welcome message. Its core promise is attractive, yet the existing copy
claims that scanning instantly adds a stamp, that all visits are remembered and
that the action takes ten seconds. “Claim” can also imply the reward is
available now.

## Recommended hierarchy

1. **Hook:** Welcome in. Make today stamp one.
2. **Value:** Return to fill the card and reveal the reward.
3. **Friction:** One text. No app. Marketing optional.
4. **Belonging:** Your next visit adds to the same card.
5. **CTA:** Scan to start your card.

## Implemented field set

### Face A

- **Headline:** Welcome. / Let's get / started.
- **Accent:** started.
- **Body:** Today's visit can start your card. Fill it to reveal a reward
  picked by this venue.
- **CTA:** Scan to start with today

### Face B

- **Headline:** Unlock / your / reward.
- **Accent:** reward.
- **Body:** Return on another UK date to add the next stamp. Fill the card to
  reveal your reward.
- **CTA:** Scan to start your card

### Shared footer

- **Friction:** One text · No app · Marketing optional
- **Left:** One visit stamp per UK date
- **Right:** No app · Opens in your browser

## Questions for the next auditor

- Should this variant remain structurally paired with Regulars or become a
  genuinely welcome-first design?
- Is the return-visit message motivating before the customer has joined?
- Can “picked by this venue” fit without reducing the body text too far?
