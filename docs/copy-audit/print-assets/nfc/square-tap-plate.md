# 100 mm NFC Tap plate copy audit

## Asset context

- **Format:** Single-sided 100 × 100 mm NFC plate
- **Use case:** Fixed counter or table acquisition plate with NFC and QR
- **Tone:** Fast, direct and glanceable
- **Source:** `config/nfc-square-designs.json`
- **Placeholders:** `{stamps}`

## Previous copy

### Shared

- **Friction:** No app · One text · In your browser
- **Fallback:** No NFC? Scan the code
- **Rule:** One stamp per UK day · 18+ to redeem

### Front

- **Brand eyebrow:** Venue loyalty
- **Brand name:** Nab a Perks
- **Tap word:** Tap
- **Tap subline:** Phone here
- **Claim line:** Tap to join — today's stamp after one text
- **Mystery kicker:** Mystery inside
- **Mystery accent:** Unlock at {stamps}
- **Flow:** Tap · Stamp · Unlock

## Audit

The large tap target supports a quick physical action, but the benefit is
secondary and described only as a mystery. “Today's stamp after one text” is
compressed enough to sound automatic. “Unlock at {stamps}” does not explain
that the customer is revealing a venue-selected reward, and “one stamp per UK
day” is less precise than the product's calendar-date rule.

## Recommended hierarchy

1. **Action:** Tap to start.
2. **Progress:** Today's visit can be stamp one.
3. **Value:** Reveal your reward at {stamps} stamps.
4. **Friction:** One text. No app.
5. **Fallback:** No NFC? Scan the code.

## Implemented field set

### Shared

- **Friction:** One text · No app · In your browser
- **Fallback:** No NFC? Scan the QR code
- **Rule:** One stamp/UK date · 18+ to redeem

### Front

- **Brand eyebrow:** Your venue reward card
- **Brand name:** Nab a Perks
- **Tap word:** Tap
- **Tap subline:** To start
- **Claim line:** One text. Today's visit can be stamp one.
- **Mystery kicker:** Reward sealed
- **Mystery accent:** Reveal at stamp {stamps}
- **Flow:** Tap · Join · Return

## Implementation note

The source dimensions must print at exactly 100 × 100 mm at 100% scale. Copy
approval should include a physical-size render because a phrase that fits the
browser preview may clip or become unreadable on the printed plate. Field
values may also be enforced by source-contract tests.

## Questions for the next auditor

- Does the plate need “picked by this venue,” or is that too much copy for the
  format?
- Would “Tap · Join · Reveal” explain the payoff better than “Return”?
- Is “Reveal at {stamps}” clear enough that the reward remains hidden until the
  card is full?
