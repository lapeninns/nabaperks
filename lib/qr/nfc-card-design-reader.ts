import nfcCardDesignsJson from "@/config/nfc-card-designs.json" with { type: "json" }
import {
  requireArray,
  requireNumber,
  requireRecord,
  requireRecordField,
  requireString,
} from "./poster-json-readers"
import type {
  NfcCardCollection,
  NfcCardDesignId,
  NfcCardDesignMetadata,
  NfcCardRollout,
} from "./nfc-card-content-types"

type JsonRecord = Record<string, unknown>

const NFC_CARD_DESIGN_ID_VALUES: readonly NfcCardDesignId[] = [
  "tap",
  "google-review",
]

let parsedCatalogue: JsonRecord | undefined

function catalogueRoot(): JsonRecord {
  if (parsedCatalogue) return parsedCatalogue
  const root = requireRecord(nfcCardDesignsJson, "nfcCardDesigns")
  if (
    requireString(root, "schema", "nfcCardDesigns") !==
    "nabaperks.nfc-card-designs.v1"
  ) {
    throw new Error("Unsupported NFC card catalogue schema")
  }
  parsedCatalogue = root
  return root
}

function parseNfcCardDesignId(value: string): NfcCardDesignId {
  for (const id of NFC_CARD_DESIGN_ID_VALUES) {
    if (id === value) return id
  }
  throw new Error(`Unknown NFC card design ${value}`)
}

function parseRollout(value: string): NfcCardRollout {
  if (
    value === "production" ||
    value === "review" ||
    value === "experimental"
  ) {
    return value
  }
  throw new Error(`Unknown NFC card rollout ${value}`)
}

export function nfcCardDesignRecord(designId: NfcCardDesignId): JsonRecord {
  const designs = requireArray(catalogueRoot(), "designs", "nfcCardDesigns")
  for (const candidate of designs) {
    const design = requireRecord(candidate, "nfcCardDesigns.designs[]")
    if (requireString(design, "id", "nfcCardDesigns.designs[]") === designId) {
      return design
    }
  }
  throw new Error(`Missing NFC card design ${designId}`)
}

export function nfcCardDesignIds(): readonly NfcCardDesignId[] {
  const designs = requireArray(catalogueRoot(), "designs", "nfcCardDesigns")
  const ids = designs.map((candidate) => {
    const design = requireRecord(candidate, "nfcCardDesigns.designs[]")
    return parseNfcCardDesignId(
      requireString(design, "id", "nfcCardDesigns.designs[]")
    )
  })
  if (
    ids.length !== NFC_CARD_DESIGN_ID_VALUES.length ||
    new Set(ids).size !== ids.length
  ) {
    throw new Error("NFC card catalogue must contain every unique design")
  }
  return ids
}

export function nfcCardCollection(): NfcCardCollection {
  const record = requireRecordField(
    catalogueRoot(),
    "collection",
    "nfcCardDesigns"
  )
  const path = "nfcCardDesigns.collection"
  if (
    requireString(record, "id", path) !== "nfc-card" ||
    requireString(record, "format", path) !== "cr80-nfc" ||
    requireString(record, "sheet", path) !== "cr80"
  ) {
    throw new Error("Unexpected NFC card collection identity")
  }
  return {
    id: "nfc-card",
    name: requireString(record, "name", path),
    description: requireString(record, "description", path),
    format: "cr80-nfc",
    sheet: "cr80",
    revision: requireNumber(record, "revision", path),
  }
}

export function nfcCardSharedRecord(key: string): JsonRecord {
  const shared = requireRecordField(catalogueRoot(), "shared", "nfcCardDesigns")
  return requireRecordField(shared, key, "nfcCardDesigns.shared")
}

export function nfcCardSharedString(key: string): string {
  const shared = requireRecordField(catalogueRoot(), "shared", "nfcCardDesigns")
  return requireString(shared, key, "nfcCardDesigns.shared")
}

export function nfcCardSharedArray(key: string): readonly unknown[] {
  const shared = requireRecordField(catalogueRoot(), "shared", "nfcCardDesigns")
  return requireArray(shared, key, "nfcCardDesigns.shared")
}

export function nfcCardDesignMetadata(
  designId: NfcCardDesignId
): NfcCardDesignMetadata {
  const design = nfcCardDesignRecord(designId)
  const path = `nfcCardDesigns.designs.${designId}`
  const collection = nfcCardCollection()
  return {
    id: designId,
    name: requireString(design, "name", path),
    description: requireString(design, "description", path),
    useCase: requireString(design, "useCase", path),
    tone: requireString(design, "tone", path),
    collection: "nfc-card",
    format: "cr80-nfc",
    sheet: "cr80",
    revision: collection.revision,
    rollout: parseRollout(requireString(design, "rollout", path)),
  }
}
