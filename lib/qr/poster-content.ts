import {
  resolveCopyDrivenContent,
  resolveNorthstarContent,
  resolveThermalContent,
} from "./poster-a4-content"
import {
  resolveBaseTentContent,
  resolveNightTentContent,
  resolveStudioTentContent,
} from "./poster-b5-content"
export {
  resolveCopyDrivenContent,
  resolveNorthstarContent,
  resolveThermalContent,
} from "./poster-a4-content"
export {
  resolveBaseTentContent,
  resolveNightTentContent,
  resolveStudioTentContent,
} from "./poster-b5-content"
export { resolvePosterText } from "./poster-content-readers"
import type { PosterContent, PosterDesignId } from "./poster-content-types"

export function resolvePosterContent(
  templateId: PosterDesignId,
  stampsRequired: number
): PosterContent {
  switch (templateId) {
    case "editorial":
    case "bold":
    case "ticket":
      return resolveCopyDrivenContent(templateId, stampsRequired)
    case "northstar":
      return resolveNorthstarContent(stampsRequired)
    case "thermal":
      return resolveThermalContent(stampsRequired)
    case "table-tent":
      return resolveBaseTentContent(stampsRequired)
    case "table-tent-night":
      return resolveNightTentContent(stampsRequired)
    case "table-tent-studio":
      return resolveStudioTentContent(stampsRequired)
  }
}

export type {
  A4Geometry,
  AccentHeadline,
  BaseTentContent,
  B5Geometry,
  CopyDrivenPosterContent,
  NightTentContent,
  NorthstarPosterContent,
  PosterContent,
  PosterDesignId,
  PosterFontModel,
  PosterPaletteModel,
  PosterQrModel,
  B5TypeTierModel,
  ReceiptItem,
  StudioTentContent,
  ThermalPosterContent,
} from "./poster-content-types"
