import { rawTemplateCopy, sharedRecord } from "./poster-design-reader"
import {
  accentHeadline,
  copyString,
  receiptItems,
  validateStampsRequired,
} from "./poster-content-readers"
import { a4ContentBase } from "./poster-model-readers"
import type {
  CopyDrivenPosterContent,
  CopyDrivenPosterId,
  NorthstarPosterContent,
  ThermalPosterContent,
} from "./poster-content-types"

function sharedChoice(
  group: "supportDefault" | "progress",
  stampsRequired: number
): string {
  const values = sharedRecord(group)
  return copyString(
    values,
    stampsRequired === 1 ? "one" : "many",
    stampsRequired,
    `posterDesigns.shared.${group}`
  )
}

export function resolveCopyDrivenContent(
  templateId: CopyDrivenPosterId,
  stampsRequired: number
): CopyDrivenPosterContent {
  const stamps = validateStampsRequired(stampsRequired)
  const copy = rawTemplateCopy(templateId)
  const path = `posterDesigns.templates.${templateId}.copy`
  const headlineKey =
    templateId === "editorial"
      ? stamps === 1
        ? "headlineOne"
        : "headlineMany"
      : "headline"
  const support =
    templateId === "ticket"
      ? copyString(
          copy,
          stamps === 1 ? "supportOne" : "supportMany",
          stamps,
          path
        )
      : sharedChoice("supportDefault", stamps)

  return {
    ...a4ContentBase(templateId),
    id: templateId,
    headline: accentHeadline(copy, headlineKey, stamps, path),
    support,
    rewardDetail: copyString(copy, "rewardDetail", stamps, path),
    frictionLine: copyString(copy, "frictionLine", stamps, path),
    qrCaption: copyString(copy, "qrCaption", stamps, path),
    progress: sharedChoice("progress", stamps),
  }
}

export function resolveNorthstarContent(
  stampsRequired: number
): NorthstarPosterContent {
  const stamps = validateStampsRequired(stampsRequired)
  const copy = rawTemplateCopy("northstar")
  const path = "posterDesigns.templates.northstar.copy"
  return {
    ...a4ContentBase("northstar"),
    id: "northstar",
    headline: copyString(copy, "headline", stamps, path),
    headlineAccent: copyString(copy, "headlineAccent", stamps, path),
    ease: copyString(copy, "ease", stamps, path),
    chip: copyString(copy, "chip", stamps, path),
    qrCaption: copyString(copy, "qrCaption", stamps, path),
    promise: copyString(
      copy,
      stamps === 1 ? "promiseOne" : "promiseMany",
      stamps,
      path
    ),
  }
}

export function resolveThermalContent(
  stampsRequired: number
): ThermalPosterContent {
  const stamps = validateStampsRequired(stampsRequired)
  const copy = rawTemplateCopy("thermal")
  const path = "posterDesigns.templates.thermal.copy"
  return {
    ...a4ContentBase("thermal"),
    id: "thermal",
    meta: copyString(copy, "meta", stamps, path),
    friction: copyString(copy, "friction", stamps, path),
    headline: copyString(copy, "headline", stamps, path),
    headlineAccent: copyString(copy, "headlineAccent", stamps, path),
    items: receiptItems(copy, stamps, path),
    totalLabel: copyString(copy, "totalLabel", stamps, path),
    totalValue: copyString(copy, "totalValue", stamps, path),
    qrCaption: copyString(copy, "qrCaption", stamps, path),
  }
}
