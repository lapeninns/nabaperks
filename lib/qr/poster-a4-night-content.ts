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
  ChalkPosterContent,
  LastcallPosterContent,
} from "./poster-kit-content-types"

export function resolveChalkContent(
  stampsRequired: number
): ChalkPosterContent {
  const stamps = validateStampsRequired(stampsRequired)
  const copy = rawTemplateCopy("chalk")
  const path = "posterDesigns.templates.chalk.copy"
  return {
    ...a4ContentBase("chalk"),
    id: "chalk",
    eyebrow: copyString(copy, "eyebrow", stamps, path),
    edition: copyString(copy, "edition", stamps, path),
    headline: {
      lead: copyString(copy, "headlineLead", stamps, path),
      accent: copyString(copy, "headlineAccent", stamps, path),
    },
    lede: copyChoice(copy, "lede", stamps, path),
    sealedLine: copyChoice(copy, "sealed", stamps, path),
    friction: sharedFrictionTriple(stamps),
    qrCaption: copyString(copy, "qrCaption", stamps, path),
    stubTop: copyString(copy, "stubTop", stamps, path),
    stubBottom: copyString(copy, "stubBottom", stamps, path),
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
