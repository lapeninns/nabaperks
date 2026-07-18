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
  PinnedPosterContent,
  TallyPosterContent,
} from "./poster-kit-content-types"

export function resolvePinnedContent(
  stampsRequired: number
): PinnedPosterContent {
  const stamps = validateStampsRequired(stampsRequired)
  const copy = rawTemplateCopy("pinned")
  const path = "posterDesigns.templates.pinned.copy"
  return {
    ...a4ContentBase("pinned"),
    id: "pinned",
    eyebrow: copyString(copy, "eyebrow", stamps, path),
    edition: copyString(copy, "edition", stamps, path),
    headline: copyString(copy, "headline", stamps, path),
    lede: copyChoice(copy, "lede", stamps, path),
    friction: sharedFrictionTriple(stamps),
    qrCaption: copyString(copy, "qrCaption", stamps, path),
    memberTag: sharedMemberTag(),
    stubTop: copyString(copy, "stubTop", stamps, path),
    stubBottom: copyString(copy, "stubBottom", stamps, path),
  }
}

export function resolveTallyContent(
  stampsRequired: number
): TallyPosterContent {
  const stamps = validateStampsRequired(stampsRequired)
  const copy = rawTemplateCopy("tally")
  const path = "posterDesigns.templates.tally.copy"
  return {
    ...a4ContentBase("tally"),
    id: "tally",
    eyebrow: copyString(copy, "eyebrow", stamps, path),
    edition: copyString(copy, "edition", stamps, path),
    headline: copyChoice(copy, "headline", stamps, path),
    cardLabel: copyString(copy, "cardLabel", stamps, path),
    cardCount: copyString(copy, "cardCount", stamps, path),
    todayLabel: copyString(copy, "todayLabel", stamps, path),
    explainer: copyChoice(copy, "explainer", stamps, path),
    friction: sharedFrictionTriple(stamps),
    dateRule: copyString(copy, "dateRule", stamps, path),
    qrCaption: copyString(copy, "qrCaption", stamps, path),
    memberTag: sharedMemberTag(),
  }
}
