function unique(strings) {
  return [
    ...new Set(
      strings.filter((value) => typeof value === "string" && value.trim())
    ),
  ]
}

export function normalisePosterText(value) {
  // "Nº" and PDF-extracted "No" are the same numero sign to this contract.
  return value
    .replace(/º/g, "o")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("en-GB")
}

function posterTextTokens(value) {
  return normalisePosterText(value).match(/[a-z0-9+]+(?:['’][a-z0-9]+)*/g) ?? []
}

export function containsPosterCopy(rendered, expected) {
  const normalisedRendered = normalisePosterText(rendered)
  const normalisedExpected = normalisePosterText(expected)
  if (normalisedRendered.includes(normalisedExpected)) return true

  // pdftotext re-segments rotated runs mid-word (a tilted badge extracts
  // as "VALID T / ODAY ON / LY"), so also match with whitespace stripped —
  // character order stays exact.
  const strippedExpected = normalisedExpected.replace(/\s+/g, "")
  if (
    strippedExpected &&
    normalisedRendered.replace(/\s+/g, "").includes(strippedExpected)
  ) {
    return true
  }

  const renderedTokens = posterTextTokens(rendered)
  const expectedTokens = posterTextTokens(expected)
  let cursor = 0
  for (const token of renderedTokens) {
    if (token === expectedTokens[cursor]) cursor += 1
    if (cursor === expectedTokens.length) return true
  }
  return false
}

export function posterVisibleCopyByFace(content) {
  switch (content.id) {
    case "primer":
      return [
        {
          face: "sheet",
          strings: unique([
            content.ledgerLabel,
            content.edition,
            content.headline,
            ...content.clauses.flatMap((clause) => [
              clause.title,
              clause.detail,
            ]),
            content.qrCaption,
            content.issuerLabel,
            content.memberTag,
            content.signature,
            content.reassurance,
          ]),
        },
      ]
    case "window":
      return [
        {
          face: "sheet",
          strings: unique([
            content.eyebrow,
            content.edition,
            content.headline,
            content.lede,
            ...content.friction,
            content.sealedLine,
            content.qrCaption,
            content.memberTag,
            content.reassurance,
          ]),
        },
      ]
    case "pinned":
      return [
        {
          face: "sheet",
          strings: unique([
            content.eyebrow,
            content.edition,
            content.headline,
            content.lede,
            ...content.friction,
            content.qrCaption,
            content.memberTag,
            content.stubTop,
            content.stubBottom,
            content.reassurance,
          ]),
        },
      ]
    case "seal":
      return [
        {
          face: "sheet",
          strings: unique([
            content.manifestLabel,
            content.edition,
            content.headline,
            content.sealedTag,
            ...content.rows.flatMap((row) => [row.label, row.value]),
            content.frictionLine,
            content.qrCaption,
            content.issuerLabel,
            content.memberTag,
            content.signature,
            content.reassurance,
          ]),
        },
      ]
    case "tally":
      return [
        {
          face: "sheet",
          strings: unique([
            content.eyebrow,
            content.edition,
            content.headline,
            content.cardLabel,
            content.cardCount,
            content.todayLabel,
            content.explainer,
            ...content.friction,
            content.dateRule,
            content.qrCaption,
            content.memberTag,
            content.reassurance,
          ]),
        },
      ]
    case "lastcall":
      return [
        {
          face: "sheet",
          strings: unique([
            content.eyebrow,
            content.edition,
            content.headline.lead,
            content.headline.accent,
            content.badge,
            content.lede,
            ...content.friction,
            content.sealedLine,
            content.qrCaption,
            content.memberTag,
            content.reassurance,
          ]),
        },
      ]
    case "receipt":
      return [
        {
          face: "sheet",
          strings: unique([
            content.orderLabel,
            content.edition,
            content.hook,
            content.merchantLabel,
            content.cardLine,
            content.todayItem,
            content.todayValue,
            content.rewardItem,
            content.rewardValue,
            content.rewardNote,
            content.totalLabel,
            content.totalValue,
            ...content.footnotes,
            content.qrCaption,
            content.footLine,
            content.memberTag,
            content.reassurance,
          ]),
        },
      ]
    case "chalk":
      return [
        {
          face: "sheet",
          strings: unique([
            content.eyebrow,
            content.edition,
            content.headline.lead,
            content.headline.accent,
            content.lede,
            content.sealedLine,
            ...content.friction,
            content.qrCaption,
            content.stubTop,
            content.stubBottom,
            content.memberTag,
            content.reassurance,
          ]),
        },
      ]
  }
}

export function posterVisibleCopy(content) {
  return posterVisibleCopyByFace(content).flatMap(({ strings }) => strings)
}
