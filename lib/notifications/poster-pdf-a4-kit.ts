import type { CounterKitPosterContent } from "@/lib/qr/poster-kit-content-types"

import { drawChalkA4 } from "./poster-pdf-a4-chalk"
import { drawDuotoneA4 } from "./poster-pdf-a4-duotone"
import { drawLastcallA4 } from "./poster-pdf-a4-lastcall"
import { drawPinnedA4 } from "./poster-pdf-a4-pinned"
import { drawPrimerA4 } from "./poster-pdf-a4-primer"
import { drawReceiptA4 } from "./poster-pdf-a4-receipt"
import { drawSealA4 } from "./poster-pdf-a4-seal"
import { drawTallyA4 } from "./poster-pdf-a4-tally"
import type { PosterPdfBaseContext } from "./poster-pdf-types"

export function drawCounterKitA4(
  context: PosterPdfBaseContext,
  content: CounterKitPosterContent
): void {
  switch (content.id) {
    case "primer":
      return drawPrimerA4(context, content)
    case "window":
      return drawDuotoneA4(context, content)
    case "pinned":
      return drawPinnedA4(context, content)
    case "seal":
      return drawSealA4(context, content)
    case "tally":
      return drawTallyA4(context, content)
    case "lastcall":
      return drawLastcallA4(context, content)
    case "receipt":
      return drawReceiptA4(context, content)
    case "chalk":
      return drawChalkA4(context, content)
  }
}
