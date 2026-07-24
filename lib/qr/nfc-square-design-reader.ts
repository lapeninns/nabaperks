import nfcSquareDesignsJson from "@/config/nfc-square-designs.json" with { type: "json" }
import {
  requireArray,
  requireNumber,
  requireRecord,
  requireRecordField,
  requireString,
} from "./poster-json-readers"
import type {
  NfcSquareCollection,
  NfcSquareDesignId,
  NfcSquareDesignMetadata,
  NfcSquareRollout,
} from "./nfc-square-content-types"

type JsonRecord = Record<string, unknown>

const NFC_SQUARE_DESIGN_ID_VALUES: readonly NfcSquareDesignId[] = [
  "tap",
  "google-review",
]

let parsedCatalogue: JsonRecord | undefined

function catalogueRoot(): JsonRecord {
  if (parsedCatalogue) return parsedCatalogue
  const root = requireRecord(nfcSquareDesignsJson, "nfcSquareDesigns")
  if (
    requireString(root, "schema", "nfcSquareDesigns") !==
    "nabaperks.nfc-square-designs.v1"
  ) {
    throw new Error("Unsupported NFC square catalogue schema")
  }
  parsedCatalogue = root
  return root
}

function parseNfcSquareDesignId(value: string): NfcSquareDesignId {
  for (const id of NFC_SQUARE_DESIGN_ID_VALUES) {
    if (id === value) return id
  }
  throw new Error(`Unknown NFC square design ${value}`)
}

function parseRollout(value: string): NfcSquareRollout {
  if (
    value === "production" ||
    value === "review" ||
    value === "experimental"
  ) {
    return value
  }
  throw new Error(`Unknown NFC square rollout ${value}`)
}

export function nfcSquareDesignRecord(designId: NfcSquareDesignId): JsonRecord {
  const designs = requireArray(catalogueRoot(), "designs", "nfcSquareDesigns")
  for (const candidate of designs) {
    const design = requireRecord(candidate, "nfcSquareDesigns.designs[]")
    if (
      requireString(design, "id", "nfcSquareDesigns.designs[]") === designId
    ) {
      return design
    }
  }
  throw new Error(`Missing NFC square design ${designId}`)
}

export function nfcSquareDesignIds(): readonly NfcSquareDesignId[] {
  const designs = requireArray(catalogueRoot(), "designs", "nfcSquareDesigns")
  const ids = designs.map((candidate) => {
    const design = requireRecord(candidate, "nfcSquareDesigns.designs[]")
    return parseNfcSquareDesignId(
      requireString(design, "id", "nfcSquareDesigns.designs[]")
    )
  })
  if (
    ids.length !== NFC_SQUARE_DESIGN_ID_VALUES.length ||
    new Set(ids).size !== ids.length
  ) {
    throw new Error("NFC square catalogue must contain every unique design")
  }
  return ids
}

export function nfcSquareCollection(): NfcSquareCollection {
  const record = requireRecordField(
    catalogueRoot(),
    "collection",
    "nfcSquareDesigns"
  )
  const path = "nfcSquareDesigns.collection"
  if (
    requireString(record, "id", path) !== "nfc-square" ||
    requireString(record, "format", path) !== "nfc-square-100" ||
    requireString(record, "sheet", path) !== "square-100"
  ) {
    throw new Error("Unexpected NFC square collection identity")
  }
  return {
    id: "nfc-square",
    name: requireString(record, "name", path),
    description: requireString(record, "description", path),
    format: "nfc-square-100",
    sheet: "square-100",
    revision: requireNumber(record, "revision", path),
  }
}

export function nfcSquareSharedRecord(key: string): JsonRecord {
  const shared = requireRecordField(
    catalogueRoot(),
    "shared",
    "nfcSquareDesigns"
  )
  return requireRecordField(shared, key, "nfcSquareDesigns.shared")
}

export function nfcSquareSharedString(key: string): string {
  const shared = requireRecordField(
    catalogueRoot(),
    "shared",
    "nfcSquareDesigns"
  )
  return requireString(shared, key, "nfcSquareDesigns.shared")
}

export function nfcSquareSharedArray(key: string): readonly unknown[] {
  const shared = requireRecordField(
    catalogueRoot(),
    "shared",
    "nfcSquareDesigns"
  )
  return requireArray(shared, key, "nfcSquareDesigns.shared")
}

export function nfcSquareDesignMetadata(
  designId: NfcSquareDesignId
): NfcSquareDesignMetadata {
  const design = nfcSquareDesignRecord(designId)
  const path = `nfcSquareDesigns.designs.${designId}`
  const collection = nfcSquareCollection()
  return {
    id: designId,
    name: requireString(design, "name", path),
    description: requireString(design, "description", path),
    useCase: requireString(design, "useCase", path),
    tone: requireString(design, "tone", path),
    collection: "nfc-square",
    format: "nfc-square-100",
    sheet: "square-100",
    revision: collection.revision,
    rollout: parseRollout(requireString(design, "rollout", path)),
  }
}
