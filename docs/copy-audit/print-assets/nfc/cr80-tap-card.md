# CR80 NFC Tap card copy audit

## Asset context

- **Format:** Double-sided CR80 card, 85.60 × 53.98 mm
- **Use case:** Compact NFC and QR acquisition card
- **Tone:** Immediate, tactile and collectable
- **Source:** `config/nfc-card-designs.json`
- **Placeholders:** `{stamps}`

## Previous copy

### Shared

- **Friction:** No app · One text · In your browser
- **Fallback:** No NFC? Scan the code
- **Rule:** One stamp per UK day · 18+ to redeem

### Front

- **Brand eyebrow:** Venue mystery card
- **Brand name:** Nab a Perks
- **Tap word:** Tap
- **Tap subline:** Your phone
- **Stamp cue:** 01 is waiting · mystery at {stamps}
- **Claim kicker:** Mystery inside
- **Claim line:** Tap to join — today's stamp after one text
- **Flow:** Tap · Stamp · Unlock

### Back

- **Strap:** Keep this card
- **Badge:** Mystery
- **Tease lead:** Your first stamp
- **Tease accent:** is waiting.
- **Seal label:** {stamps} = ★
- **Step 1:** Tap / Phone or code
- **Step 2:** Keep / On your number
- **Step 3:** Return / Stamp to unlock
- **Foot brand:** Nab a Perks

## Audit

The card has very little reading space, so “mystery” currently appears more
often than the actual customer value. “01 is waiting” and “Your first stamp is
waiting” can imply that the stamp has already been issued. The claim line is
closer to the truth, but it should make clear that today's visit can become
stamp one after the join. “Keep on your number” is difficult to parse.

## Recommended hierarchy

1. **Action:** Tap to start.
2. **Progress:** Today's visit can be stamp one.
3. **Value:** Reveal a reward at {stamps} stamps.
4. **Friction:** One text. No app.
5. **Fallback:** No NFC? Scan the code.

## Implemented field set

### Shared

- **Friction:** One text · No app · In your browser
- **Fallback:** No NFC? Scan the QR code
- **Rule:** One stamp/UK date · 18+ to redeem

### Front

- **Brand eyebrow:** Your sealed reward
- **Brand name:** Nab a Perks
- **Tap word:** Tap here
- **Tap subline:** To start
- **Stamp cue:** Start today · reward at {stamps}
- **Claim kicker:** Reward sealed
- **Claim line:** One text. Start your {stamps}-stamp card.
- **Flow:** Tap · Join · Return

### Back

- **Strap:** Keep this card
- **Badge:** Reward
- **Tease lead:** Today's visit
- **Tease accent:** can be stamp one.
- **Seal label:** At stamp {stamps}
- **Step 1:** Tap / Phone or QR
- **Step 2:** Join / One text
- **Step 3:** Return / Add next stamp
- **Foot brand:** Nab a Perks

## Implementation note

The compact fields and flow labels may be asserted by source-contract tests.
Any implementation should update those expectations deliberately and render
both sides at physical CR80 size before approval.

## Questions for the next auditor

- Is “Your venue reward card” clear without naming the venue?
- Does “reward at {stamps}” falsely imply immediate redemption rather than
  reveal?
- Should the three-step flow be “Tap · Join · Reveal” instead of emphasising the
  return visit?
