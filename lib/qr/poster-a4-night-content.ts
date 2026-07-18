import { rawTemplateCopy } from "./poster-design-reader"
import {
  copyChoice,
  copyString,
  sharedFrictionTriple,
  sharedMemberTag,
  validateStampsRequired,
} from "./poster-content-readers"
import { a4ContentBase } from "./poster-model-readers"
import type {
  LastcallPosterContent,
  RoundPosterContent,
} from "./poster-kit-content-types"

export function resolveRoundContent(
  stampsRequired: number
): RoundPosterContent {
  const stamps = validateStampsRequired(stampsRequired)
  const copy = rawTemplateCopy("round")
  const path = "posterDesigns.templates.round.copy"
  return {
    ...a4ContentBase("round"),
    id: "round",
    eyebrow: copyString(copy, "eyebrow", stamps, path),
    edition: copyString(copy, "edition", stamps, path),
    headline: {
      lead: copyString(copy, "headlineLead", stamps, path),
      accent: copyString(copy, "headlineAccent", stamps, path),
    },
    lede: copyChoice(copy, "lede", stamps, path),
    sealedLine: copyChoice(copy, "sealed", stamps, path),
    friction: sharedFrictionTriple(stamps),
    matLines: [
      copyString(copy, "matLineOne", stamps, path),
      copyString(copy, "matLineTwo", stamps, path),
      copyString(copy, "matLineThree", stamps, path),
    ],
    qrCaption: copyString(copy, "qrCaption", stamps, path),
    memberTag: sharedMemberTag(),
  }
}

export function resolveLastcallContent(
  stampsRequired: number
): LastcallPosterContent {
  const stamps = validateStampsRequired(stampsRequired)
  const copy = rawTemplateCopy("lastcall")
  const path = "posterDesigns.templates.lastcall.copy"
  return {
    ...a4ContentBase("lastcall"),
    id: "lastcall",
    eyebrow: copyString(copy, "eyebrow", stamps, path),
    edition: copyString(copy, "edition", stamps, path),
    headline: {
      lead: copyString(copy, "headlineLead", stamps, path),
      accent: copyString(copy, "headlineAccent", stamps, path),
    },
    badge: copyString(copy, "badge", stamps, path),
    lede: copyString(copy, "lede", stamps, path),
    friction: sharedFrictionTriple(stamps),
    sealedLine: copyChoice(copy, "sealed", stamps, path),
    qrCaption: copyString(copy, "qrCaption", stamps, path),
    memberTag: sharedMemberTag(),
  }
}
