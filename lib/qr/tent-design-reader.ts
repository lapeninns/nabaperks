import tentDesignsJson from "@/config/table-tent-designs.json" with { type: "json" }
import {
  requireArray,
  requireNumber,
  requireRecord,
  requireRecordField,
  requireString,
} from "./poster-json-readers"
import type {
  TentCollection,
  TentDesignId,
  TentDesignMetadata,
  TentRollout,
} from "./tent-content-types"

type JsonRecord = Record<string, unknown>

const TENT_DESIGN_ID_VALUES: readonly TentDesignId[] = [
  "regulars",
  "welcome",
  "sealed",
  "today",
  "classic",
]

let parsedCatalogue: JsonRecord | undefined

function catalogueRoot(): JsonRecord {
  if (parsedCatalogue) return parsedCatalogue
  const root = requireRecord(tentDesignsJson, "tableTentDesigns")
  if (
    requireString(root, "schema", "tableTentDesigns") !==
    "nabaperks.table-tent-designs.v1"
  ) {
    throw new Error("Unsupported table-tent catalogue schema")
  }
  parsedCatalogue = root
  return root
}

function parseTentDesignId(value: string): TentDesignId {
  for (const id of TENT_DESIGN_ID_VALUES) {
    if (id === value) return id
  }
  throw new Error(`Unknown table-tent design ${value}`)
}

function parseRollout(value: string): TentRollout {
  if (
    value === "production" ||
    value === "review" ||
    value === "experimental"
  ) {
    return value
  }
  throw new Error(`Unknown table-tent rollout ${value}`)
}

export function tentDesignRecord(designId: TentDesignId): JsonRecord {
  const designs = requireArray(catalogueRoot(), "designs", "tableTentDesigns")
  for (const candidate of designs) {
    const design = requireRecord(candidate, "tableTentDesigns.designs[]")
    if (
      requireString(design, "id", "tableTentDesigns.designs[]") === designId
    ) {
      return design
    }
  }
  throw new Error(`Missing table-tent design ${designId}`)
}

export function tentDesignIds(): readonly TentDesignId[] {
  const designs = requireArray(catalogueRoot(), "designs", "tableTentDesigns")
  const ids = designs.map((candidate) => {
    const design = requireRecord(candidate, "tableTentDesigns.designs[]")
    return parseTentDesignId(
      requireString(design, "id", "tableTentDesigns.designs[]")
    )
  })
  if (
    ids.length !== TENT_DESIGN_ID_VALUES.length ||
    new Set(ids).size !== ids.length
  ) {
    throw new Error("Table-tent catalogue must contain five unique designs")
  }
  return ids
}

export function tentCollection(): TentCollection {
  const record = requireRecordField(
    catalogueRoot(),
    "collection",
    "tableTentDesigns"
  )
  const path = "tableTentDesigns.collection"
  if (
    requireString(record, "id", path) !== "table-tent" ||
    requireString(record, "format", path) !== "a4-tent" ||
    requireString(record, "sheet", path) !== "a4"
  ) {
    throw new Error("Unexpected table-tent collection identity")
  }
  return {
    id: "table-tent",
    name: requireString(record, "name", path),
    description: requireString(record, "description", path),
    format: "a4-tent",
    sheet: "a4",
    revision: requireNumber(record, "revision", path),
  }
}

export function tentSharedRecord(key: string): JsonRecord {
  const shared = requireRecordField(
    catalogueRoot(),
    "shared",
    "tableTentDesigns"
  )
  return requireRecordField(shared, key, "tableTentDesigns.shared")
}

export function tentSharedString(key: string): string {
  const shared = requireRecordField(
    catalogueRoot(),
    "shared",
    "tableTentDesigns"
  )
  return requireString(shared, key, "tableTentDesigns.shared")
}

export function tentSharedArray(key: string): readonly unknown[] {
  const shared = requireRecordField(
    catalogueRoot(),
    "shared",
    "tableTentDesigns"
  )
  return requireArray(shared, key, "tableTentDesigns.shared")
}

export function tentDesignMetadata(designId: TentDesignId): TentDesignMetadata {
  const design = tentDesignRecord(designId)
  const path = `tableTentDesigns.designs.${designId}`
  const collection = tentCollection()
  return {
    id: designId,
    name: requireString(design, "name", path),
    description: requireString(design, "description", path),
    useCase: requireString(design, "useCase", path),
    tone: requireString(design, "tone", path),
    collection: "table-tent",
    format: "a4-tent",
    sheet: "a4",
    revision: collection.revision,
    rollout: parseRollout(requireString(design, "rollout", path)),
  }
}
