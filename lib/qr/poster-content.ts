import { resolveDuotoneContent } from "./poster-a4-duotone-content"
export { resolveDuotoneContent } from "./poster-a4-duotone-content"
import {
  resolvePrimerContent,
  resolveSealContent,
} from "./poster-a4-ledger-content"
export {
  resolvePrimerContent,
  resolveSealContent,
} from "./poster-a4-ledger-content"
import {
  resolveChalkContent,
  resolveLastcallContent,
} from "./poster-a4-night-content"
export {
  resolveChalkContent,
  resolveLastcallContent,
} from "./poster-a4-night-content"
import {
  resolvePinnedContent,
  resolveTallyContent,
} from "./poster-a4-overprint-content"
export {
  resolvePinnedContent,
  resolveTallyContent,
} from "./poster-a4-overprint-content"
import { resolveReceiptContent } from "./poster-a4-receipt-content"
export { resolveReceiptContent } from "./poster-a4-receipt-content"
export { resolvePosterText } from "./poster-content-readers"
import type { PosterContent, PosterDesignId } from "./poster-content-types"

export function resolvePosterContent(
  templateId: PosterDesignId,
  stampsRequired: number
): PosterContent {
  switch (templateId) {
    case "primer":
      return resolvePrimerContent(stampsRequired)
    case "window":
      return resolveDuotoneContent(templateId, stampsRequired)
    case "pinned":
      return resolvePinnedContent(stampsRequired)
    case "seal":
      return resolveSealContent(stampsRequired)
    case "tally":
      return resolveTallyContent(stampsRequired)
    case "lastcall":
      return resolveLastcallContent(stampsRequired)
    case "receipt":
      return resolveReceiptContent(stampsRequired)
    case "chalk":
      return resolveChalkContent(stampsRequired)
  }
}

export type {
  A4Geometry,
  AccentHeadline,
  PosterContent,
  PosterDesignId,
  PosterFontModel,
  PosterPaletteModel,
  PosterQrModel,
} from "./poster-content-types"
export type {
  ChalkPosterContent,
  CounterKitPosterContent,
  DuotonePosterContent,
  LastcallPosterContent,
  PinnedPosterContent,
  PrimerPosterContent,
  ReceiptPosterContent,
  SealPosterContent,
  TallyPosterContent,
} from "./poster-kit-content-types"
