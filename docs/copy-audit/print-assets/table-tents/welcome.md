# Welcome A4 table tent copy audit

## Asset context

- **Format:** A4 folded table tent, two customer-facing panels
- **Use case:** Welcome-led variant for a seated customer
- **Tone:** How-it-works onboarding
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

- **Headline:** How it works. / Scan. / Stamp. / Reward.
- **Accent:** Reward.
- **Body:** Point your camera at the code. Stamp one lands today. Fill the card
  and the sealed reward opens — no app, no password.
- **CTA:** Scan · Start your card

### Face B

- **Headline:** New here? / Your card / starts now.
- **Accent:** starts now.
- **Body:** This code opens your card in the browser. Complete the quick join,
  then collect today's stamp — one per UK date.
- **CTA:** Scan to open your card

### Shared footer

- **Friction:** One text · No app · Marketing optional
- **Left:** One visit stamp per UK date
- **Right:** No app · Opens in your browser

## Audit resolution

Welcome now has two unique how-it-works faces. The back explicitly places stamp
collection after the join flow instead of promising a stamp at scan time.
