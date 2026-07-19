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
  DuotonePosterContent,
  DuotonePosterId,
  DuotoneSpot,
} from "./poster-kit-content-types"

const DUOTONE_SPOTS: Record<DuotonePosterId, DuotoneSpot> = {
  window: "vermillion",
}

export function resolveDuotoneContent(
  templateId: DuotonePosterId,
  stampsRequired: number
): DuotonePosterContent {
  const stamps = validateStampsRequired(stampsRequired)
  const copy = rawTemplateCopy(templateId)
  const path = `posterDesigns.templates.${templateId}.copy`
  return {
    ...a4ContentBase(templateId),
    id: templateId,
    spot: DUOTONE_SPOTS[templateId],
    eyebrow: copyString(copy, "eyebrow", stamps, path),
    edition: copyString(copy, "edition", stamps, path),
    headline: copyString(copy, "headline", stamps, path),
    lede: copyString(copy, "lede", stamps, path),
    friction: sharedFrictionTriple(stamps),
    sealedLine: copyChoice(copy, "sealed", stamps, path),
    qrCaption: copyString(copy, "qrCaption", stamps, path),
    memberTag: sharedMemberTag(),
  }
}
