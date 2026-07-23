# Sealed envelope A4 table tent copy audit

## Asset context

- **Format:** A4 folded table tent, two customer-facing panels
- **Use case:** Mystery-led conversion during a visit
- **Tone:** Intrigue and reveal
- **Source:** `config/table-tent-designs.json` → `designs[id="sealed"]`
- **Placeholders:** `{stamps}`

## Previous copy

### Face A

- **Badge:** Sealed
- **Headline:** We know / what it is. / Staff know. / You don't. / Yet.
- **Accent:** Yet.
- **Body:** Fill your card and the amber seal opens. Stamp one starts the moment
  you scan — staff won't spoil what's under it.
- **CTA:** Scan · Break the seal

### Face B

- **Headline:** How to / break the / seal.
- **Body:** Stamp one starts the count the moment you scan. One more each visit
  — {StampsWord} stamps and the amber seal opens.
- **CTA:** Scan · Start the count

### Shared footer

- **Friction:** 10 seconds · No app · No password
- **Left:** One stamp per UK date — today's expires at closing
- **Right:** No app · Opens in your browser

## Audit

The sealed device is the clearest expression of the product's mystery. The
headline spends too much space on unsupported claims that staff know the reward.
Both faces say scanning starts the count, although the customer must complete
the join. “One more each visit” also needs the one-stamp-per-UK-date
qualification.

## Recommended hierarchy

1. **Hook:** Your reward is sealed.
2. **Value:** Fill the card to reveal a venue-picked reward.
3. **Progress:** Today's visit can be stamp one.
4. **Mechanic:** Reach {StampsWord} stamps to reveal it.
5. **CTA:** Scan to start your card.

## Implemented field set

### Face A

- **Badge:** Top secret
- **Headline:** Your / reward is / sealed.
- **Accent:** sealed.
- **Body:** Today's visit can start your card. Reach stamp {stamps} to break the
  seal and reveal your reward.
- **CTA:** Scan to start your card

### Face B

- **Headline:** How to / break the / seal.
- **Body:** One text starts the card. Fill it to reveal a reward picked by this
  venue.
- **CTA:** Scan to start today

### Shared footer

- **Friction:** One text · No app · Marketing optional
- **Left:** One visit stamp per UK date
- **Right:** No app · Opens in your browser

## Questions for the next auditor

- Does “break the seal” remain understandable without seeing the reward?
- Is repeating “reward” preferable to the vaguer “mystery”?
- Does the dynamic `{StampsWord}` value fit for every supported card length?
