function accentHeadline(headline) {
  return `${headline.beforeAccent}${headline.accent}${headline.afterAccent}`
}

function values(items) {
  return items.flatMap((item) => [item.label, item.value])
}

function unique(strings) {
  return [
    ...new Set(
      strings.filter((value) => typeof value === "string" && value.trim())
    ),
  ]
}

export function normalisePosterText(value) {
  return value.replace(/\s+/g, " ").trim().toLocaleLowerCase("en-GB")
}

function posterTextTokens(value) {
  return normalisePosterText(value).match(/[a-z0-9+]+(?:['’][a-z0-9]+)*/g) ?? []
}

export function containsPosterCopy(rendered, expected) {
  const normalisedRendered = normalisePosterText(rendered)
  const normalisedExpected = normalisePosterText(expected)
  if (normalisedRendered.includes(normalisedExpected)) return true

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
    case "editorial":
    case "bold":
    case "ticket":
      return [
        {
          face: "sheet",
          strings: unique([
            accentHeadline(content.headline),
            content.support,
            content.rewardDetail,
            content.frictionLine,
            content.qrCaption,
            content.progress,
            content.reassurance,
          ]),
        },
      ]
    case "northstar":
      return [
        {
          face: "sheet",
          strings: unique([
            content.headline,
            content.ease,
            content.chip,
            content.qrCaption,
            content.promise,
            content.reassurance,
          ]),
        },
      ]
    case "thermal":
      return [
        {
          face: "sheet",
          strings: unique([
            content.meta,
            content.friction,
            content.headline,
            ...values(content.items),
            content.totalLabel,
            content.totalValue,
            content.qrCaption,
            content.reassurance,
          ]),
        },
      ]
    case "table-tent":
      return [
        {
          face: "bottom",
          strings: unique([
            content.faces.bottom.editionLabel,
            ...content.faces.bottom.stack,
            content.faces.bottom.rewardLine,
            content.faces.bottom.scanLabel,
            ...content.faces.bottom.scanCta,
            content.faces.bottom.frictionLine,
            content.faces.bottom.footerLeft,
            content.faces.bottom.footerCentre,
            content.faces.bottom.footerRight,
            content.reassurance,
          ]),
        },
        {
          face: "top",
          strings: unique([
            content.faces.top.headline,
            content.faces.top.support,
            content.faces.top.frictionLine,
            content.faces.top.qrCaption,
            content.faces.top.reassurance,
          ]),
        },
      ]
    case "table-tent-night":
      return [
        {
          face: "bottom",
          strings: unique([
            content.faces.bottom.chip,
            content.faces.bottom.headline,
            content.faces.bottom.ease,
            content.faces.bottom.promise,
            content.faces.bottom.qrCaption,
            content.faces.bottom.reassurance,
          ]),
        },
        {
          face: "top",
          strings: unique([
            content.faces.top.meta,
            content.faces.top.headline,
            ...values(content.faces.top.items),
            content.faces.top.totalLabel,
            content.faces.top.totalValue,
            content.faces.top.friction,
            content.faces.top.qrCaption,
            content.faces.top.reassurance,
          ]),
        },
      ]
    case "table-tent-studio":
      return [
        {
          face: "bottom",
          strings: unique([
            content.faces.bottom.headline,
            content.faces.bottom.support,
            content.faces.bottom.frictionLine,
            content.faces.bottom.qrCaption,
            content.faces.bottom.reassurance,
          ]),
        },
        {
          face: "top",
          strings: unique([
            content.faces.top.headline,
            content.faces.top.support,
            content.faces.top.frictionLine,
            content.faces.top.qrCaption,
            content.faces.top.reassurance,
          ]),
        },
      ]
  }
}

export function posterVisibleCopy(content) {
  return posterVisibleCopyByFace(content).flatMap(({ strings }) => strings)
}
