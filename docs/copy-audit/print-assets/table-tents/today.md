# Today only A4 table tent copy audit

## Asset context

- **Format:** A4 folded table tent, two customer-facing panels
- **Use case:** Urgency-led conversion before the customer leaves
- **Tone:** Immediate without false scarcity
- **Source:** `config/table-tent-designs.json` → `designs[id="today"]`
- **Placeholders:** None

## Previous copy

### Face A

- **Badge:** Valid today
- **Headline:** Today's / stamp expires / at closing.
- **Body:** One stamp per UK date, and today's is waiting in that code. Come back
  tomorrow and this one's gone.
- **CTA:** Scan in 10 seconds

### Face B

- **Badge:** Sealed
- **Headline:** Still wondering / what's under / the seal?
- **Body:** Fill your card and the amber seal opens. Today's stamp is already
  waiting in the code — staff won't spoil the rest.
- **CTA:** Scan · Break the seal

### Shared footer

- **Friction:** 10 seconds · No app · No password
- **Left:** One stamp per UK date — today's expires at closing
- **Right:** No app · Opens in your browser

## Audit

Urgency is useful at the table, but the deadline is the UK calendar date rather
than venue closing time. The stamp is not already inside the code, and the
ten-second claim needs evidence. Face B again claims staff know the reward.
“Today” should motivate the customer to complete the join while still stating
the mechanism accurately.

## Recommended hierarchy

1. **Hook:** Make today count before you leave.
2. **Progress:** Complete the join and today's visit can start the card.
3. **Value:** Fill it to reveal a venue-picked reward.
4. **Rule:** One visit stamp per UK date.
5. **CTA:** Scan to start with today.

## Implemented field set

### Face A

- **Badge:** Today only
- **Headline:** Don't / leave this / behind.
- **Body:** Complete the join before you leave and today's visit can be stamp
  one.
- **CTA:** Scan to start with today

### Face B

- **Badge:** Reward sealed
- **Headline:** Reveal / your / reward.
- **Body:** Fill your card to reveal a reward picked by this venue. One text.
  No app.
- **CTA:** Scan to start your card

### Shared footer

- **Friction:** One text · No app · Marketing optional
- **Left:** One visit stamp per UK date
- **Right:** No app · Opens in your browser

## Questions for the next auditor

- Is “before you leave” a fair operational deadline or should it be “while
  you're here”?
- Does removing “expires” weaken urgency too much?
- Is “start with today” immediately clear to a first-time customer?
