import { rawTemplateCopy } from "./poster-design-reader"
import {
  copyChoice,
  copyString,
  sharedFrictionTriple,
  sharedMemberTag,
  validateStampsRequired,
} from "./poster-content-readers"
import { a4ContentBase } from "./poster-model-readers"
import type { ReceiptPosterContent } from "./poster-kit-content-types"

export function resolveReceiptContent(
  stampsRequired: number
): ReceiptPosterContent {
  const stamps = validateStampsRequired(stampsRequired)
  const copy = rawTemplateCopy("receipt")
  const path = "posterDesigns.templates.receipt.copy"
  return {
    ...a4ContentBase("receipt"),
    id: "receipt",
    orderLabel: copyString(copy, "orderLabel", stamps, path),
    edition: copyString(copy, "edition", stamps, path),
    hook: copyString(copy, "hook", stamps, path),
    merchantLabel: copyString(copy, "merchantLabel", stamps, path),
    cardLine: copyString(copy, "cardLine", stamps, path),
    todayItem: copyString(copy, "todayItem", stamps, path),
    todayValue: copyString(copy, "todayValue", stamps, path),
    rewardItem: copyString(copy, "rewardItem", stamps, path),
    rewardValue: copyString(copy, "rewardValue", stamps, path),
    rewardNote: copyChoice(copy, "rewardNote", stamps, path),
    totalLabel: copyString(copy, "totalLabel", stamps, path),
    totalValue: copyString(copy, "totalValue", stamps, path),
    footnotes: sharedFrictionTriple(stamps),
    qrCaption: copyString(copy, "qrCaption", stamps, path),
    footLine: copyString(copy, "footLine", stamps, path),
    memberTag: sharedMemberTag(),
  }
}
