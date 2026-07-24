import { requireRecordField, requireString } from "./poster-json-readers"
import {
  nfcSquareDesignMetadata,
  nfcSquareDesignRecord,
} from "./nfc-square-design-reader"
import {
  nfcSquareClaimFriction,
  nfcSquareDieRule,
  nfcSquareFonts,
  nfcSquareFriction,
  nfcSquareGeometry,
  nfcSquarePalette,
  nfcSquareQr,
  nfcSquareReassurance,
  nfcSquareTypeTiers,
  requireNfcSquareStringArray,
  resolveNfcSquareText,
  validateNfcSquareStamps,
} from "./nfc-square-content-readers"
import type {
  NfcSquareContent,
  NfcSquareContentBase,
  NfcSquareDesignId,
  NfcSquareFrontContent,
} from "./nfc-square-content-types"

export {
  nfcSquareDesignIds,
  nfcSquareDesignMetadata,
} from "./nfc-square-design-reader"
export {
  resolveNfcSquareText,
  validateNfcSquareStamps,
} from "./nfc-square-content-readers"

function resolveFront(
  designId: NfcSquareDesignId,
  stampsRequired: number,
  locality?: string
): NfcSquareFrontContent {
  const record = requireRecordField(
    nfcSquareDesignRecord(designId),
    "front",
    `nfcSquareDesigns.designs.${designId}`
  )
  const path = `nfcSquareDesigns.designs.${designId}.front`
  const flow = requireNfcSquareStringArray(record, "flow", path).map((line) =>
    resolveNfcSquareText(line, stampsRequired)
  )
  if (flow.length !== 3) {
    throw new Error(`Expected exactly 3 flow steps at ${path}.flow`)
  }

  return {
    brandEyebrow: resolveNfcSquareText(
      requireString(record, "brandEyebrow", path),
      stampsRequired,
      locality
    ),
    brandName: resolveNfcSquareText(
      requireString(record, "brandName", path),
      stampsRequired
    ),
    tapWord: resolveNfcSquareText(
      requireString(record, "tapWord", path),
      stampsRequired
    ),
    tapSub: resolveNfcSquareText(
      requireString(record, "tapSub", path),
      stampsRequired
    ),
    claimLine: resolveNfcSquareText(
      requireString(record, "claimLine", path),
      stampsRequired,
      locality
    ),
    mysteryKicker: resolveNfcSquareText(
      requireString(record, "mysteryKicker", path),
      stampsRequired
    ),
    mysteryAccent: resolveNfcSquareText(
      requireString(record, "mysteryAccent", path),
      stampsRequired
    ),
    flow: [flow[0], flow[1], flow[2]],
  }
}

function nfcSquareContentBase(): NfcSquareContentBase {
  return {
    sheet: "square-100",
    reassurance: nfcSquareReassurance(),
    dieRule: nfcSquareDieRule(),
    friction: nfcSquareFriction(),
    claimFriction: nfcSquareClaimFriction(),
    geometry: nfcSquareGeometry(),
    qr: nfcSquareQr(),
    palette: nfcSquarePalette(),
    fonts: nfcSquareFonts(),
    typeTiers: nfcSquareTypeTiers(),
  }
}

export function resolveNfcSquareContent(
  designId: NfcSquareDesignId,
  stampsRequired: number,
  locality?: string
): NfcSquareContent {
  const stamps = validateNfcSquareStamps(stampsRequired)
  const metadata = nfcSquareDesignMetadata(designId)
  return {
    ...nfcSquareContentBase(),
    id: designId,
    name: metadata.name,
    stampsRequired: stamps,
    front: resolveFront(designId, stamps, locality),
  }
}

export type {
  NfcSquareContent,
  NfcSquareDesignId,
  NfcSquareDesignMetadata,
} from "./nfc-square-content-types"
