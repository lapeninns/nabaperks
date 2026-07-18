import {
  resolveCopyDrivenContent,
  resolveNorthstarContent,
  resolveThermalContent,
} from "./poster-a4-content"
export {
  resolveCopyDrivenContent,
  resolveNorthstarContent,
  resolveThermalContent,
} from "./poster-a4-content"
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
  }
}

export type {
  A4Geometry,
  AccentHeadline,
  CopyDrivenPosterContent,
  NorthstarPosterContent,
  PosterContent,
  PosterDesignId,
  PosterFontModel,
  PosterPaletteModel,
  PosterQrModel,
  ReceiptItem,
  ThermalPosterContent,
} from "./poster-content-types"
