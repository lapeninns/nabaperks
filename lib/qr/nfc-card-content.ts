import {
  requireArray,
  requireRecord,
  requireRecordField,
  requireString,
} from "./poster-json-readers"
import {
  nfcCardDesignMetadata,
  nfcCardDesignRecord,
} from "./nfc-card-design-reader"
import {
  nfcCardClaimFriction,
  nfcCardDieRule,
  nfcCardFonts,
  nfcCardFriction,
  nfcCardGeometry,
  nfcCardPalette,
  nfcCardQr,
  nfcCardReassurance,
  nfcCardTypeTiers,
  requireStringArray,
  resolveNfcCardText,
  validateNfcCardStamps,
} from "./nfc-card-content-readers"
import type {
  NfcCardBackContent,
  NfcCardBackStep,
  NfcCardContent,
  NfcCardContentBase,
  NfcCardDesignId,
  NfcCardFrontContent,
} from "./nfc-card-content-types"

export {
  nfcCardDesignIds,
  nfcCardDesignMetadata,
} from "./nfc-card-design-reader"
export {
  resolveNfcCardText,
  validateNfcCardStamps,
} from "./nfc-card-content-readers"

function resolveFront(
  designId: NfcCardDesignId,
  stampsRequired: number,
  locality?: string
): NfcCardFrontContent {
  const record = requireRecordField(
    nfcCardDesignRecord(designId),
    "front",
    `nfcCardDesigns.designs.${designId}`
  )
  const path = `nfcCardDesigns.designs.${designId}.front`
  return {
    brandEyebrow: resolveNfcCardText(
      requireString(record, "brandEyebrow", path),
      stampsRequired,
      locality
    ),
    brandName: resolveNfcCardText(
      requireString(record, "brandName", path),
      stampsRequired
    ),
    tapWord: resolveNfcCardText(
      requireString(record, "tapWord", path),
      stampsRequired
    ),
    tapSub: resolveNfcCardText(
      requireString(record, "tapSub", path),
      stampsRequired
    ),
    stampCue: resolveNfcCardText(
      requireString(record, "stampCue", path),
      stampsRequired,
      locality
    ),
    claimKicker: resolveNfcCardText(
      requireString(record, "claimKicker", path),
      stampsRequired
    ),
    claimLine: resolveNfcCardText(
      requireString(record, "claimLine", path),
      stampsRequired
    ),
    flow: requireStringArray(record, "flow", path).map((line) =>
      resolveNfcCardText(line, stampsRequired)
    ),
  }
}

function resolveBack(
  designId: NfcCardDesignId,
  stampsRequired: number,
  locality?: string
): NfcCardBackContent {
  const record = requireRecordField(
    nfcCardDesignRecord(designId),
    "back",
    `nfcCardDesigns.designs.${designId}`
  )
  const path = `nfcCardDesigns.designs.${designId}.back`
  const steps = requireArray(record, "steps", path).map((candidate, index) => {
    const step = requireRecord(candidate, `${path}.steps[${index}]`)
    const stepPath = `${path}.steps[${index}]`
    const resolved: NfcCardBackStep = {
      title: resolveNfcCardText(
        requireString(step, "title", stepPath),
        stampsRequired
      ),
      detail: resolveNfcCardText(
        requireString(step, "detail", stepPath),
        stampsRequired
      ),
    }
    return resolved
  })
  return {
    strap: resolveNfcCardText(
      requireString(record, "strap", path),
      stampsRequired,
      locality
    ),
    badge: resolveNfcCardText(
      requireString(record, "badge", path),
      stampsRequired
    ),
    teaseLead: resolveNfcCardText(
      requireString(record, "teaseLead", path),
      stampsRequired
    ),
    teaseAccent: resolveNfcCardText(
      requireString(record, "teaseAccent", path),
      stampsRequired
    ),
    sealLabel: resolveNfcCardText(
      requireString(record, "sealLabel", path),
      stampsRequired
    ),
    steps,
    footBrand: resolveNfcCardText(
      requireString(record, "footBrand", path),
      stampsRequired
    ),
  }
}

function nfcCardContentBase(): NfcCardContentBase {
  return {
    sheet: "cr80",
    reassurance: nfcCardReassurance(),
    dieRule: nfcCardDieRule(),
    friction: nfcCardFriction(),
    claimFriction: nfcCardClaimFriction(),
    geometry: nfcCardGeometry(),
    qr: nfcCardQr(),
    palette: nfcCardPalette(),
    fonts: nfcCardFonts(),
    typeTiers: nfcCardTypeTiers(),
  }
}

export function resolveNfcCardContent(
  designId: NfcCardDesignId,
  stampsRequired: number,
  locality?: string
): NfcCardContent {
  const stamps = validateNfcCardStamps(stampsRequired)
  const metadata = nfcCardDesignMetadata(designId)
  return {
    ...nfcCardContentBase(),
    id: designId,
    name: metadata.name,
    stampsRequired: stamps,
    front: resolveFront(designId, stamps, locality),
    back: resolveBack(designId, stamps, locality),
  }
}

export type {
  NfcCardContent,
  NfcCardDesignId,
  NfcCardDesignMetadata,
} from "./nfc-card-content-types"
