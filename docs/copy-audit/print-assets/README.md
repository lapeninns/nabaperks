# Nabaperks print copy audit pack

This folder is a self-contained briefing pack for auditing the customer-facing
copy on every Nabaperks printable acquisition asset.

## Conversion objective

The customer should understand, in this order:

1. There is a real venue-selected reward.
2. The reward stays hidden until the loyalty card is full.
3. Today's visit can become stamp one after the join flow is completed.
4. Joining requires one text, opens in the browser, and needs no app.
5. Marketing is optional.
6. The next action is to scan the QR code or tap the NFC target.

The recommended common message is:

> **Your reward is sealed.**  
> Today's visit can be stamp one. Fill your card to reveal a reward picked by
> this venue.  
> **Scan to start your card.**  
> One text. No app. Marketing optional.

Each design may express this idea in its own voice, but it should not obscure
the value or imply that merely scanning completes the stamp.

## Product truth and copy constraints

- Use plain British English.
- Do not promise a free stamp or imply that a stamp is already issued.
- Scanning or tapping opens the join flow; the customer must complete the text
  and confirmation flow before the visit becomes stamp one.
- Do not claim a measured completion time unless it has evidence.
- Do not claim that staff know the selected reward.
- The system records stamps, not every visit.
- Rewards are selected from rewards configured by the venue and remain hidden
  until the card is full.
- One venue visit stamp is available per UK calendar date.
- Rewards are for customers aged 18 or over and redeem from the next weekday.
- Marketing consent is optional.
- Preserve `{stamps}` and `{StampsWord}` placeholders exactly where used.
- A call to action must describe the immediate action accurately: scan or tap
  to start the card.

## Audit rubric

Score each asset from 1–5 on:

- **Hook:** stops attention without sounding hostile or vague.
- **Value:** explains why joining is worthwhile.
- **Clarity:** makes the loyalty mechanism understandable at a glance.
- **Friction:** answers app, password, text and marketing concerns.
- **Action:** gives one accurate next step.
- **Trust:** avoids unsupported timing, staff or reward claims.
- **Fit:** respects the hierarchy and physical space of the design.

## Asset index

### A4 posters

- [Primer](posters/primer.md)
- [Window](posters/window.md)
- [Pinned](posters/pinned.md)
- [Seal](posters/seal.md)
- [Tally](posters/tally.md)
- [Last Call](posters/lastcall.md)
- [Receipt](posters/receipt.md)
- [Chalk](posters/chalk.md)

### A4 table tents

- [Regulars](table-tents/regulars.md)
- [Welcome](table-tents/welcome.md)
- [Sealed envelope](table-tents/sealed.md)
- [Today only](table-tents/today.md)
- [Classic](table-tents/classic.md)

### NFC formats

- [CR80 Tap card](nfc/cr80-tap-card.md)
- [100 mm Tap plate](nfc/square-tap-plate.md)

## Instructions for another AI auditor

For every linked document:

1. Audit the implemented field set against the product truth above.
2. Suggest a stronger alternative only if it improves comprehension or action.
3. Preserve the design's distinct tone rather than making every asset identical.
4. Flag any claim that needs product, legal, operational or measurement proof.
5. Check whether the headline, explanation, reassurance and CTA appear in the
   correct reading order.
6. Return a field-by-field recommendation that can be copied into the source
   catalogue without changing its schema.
