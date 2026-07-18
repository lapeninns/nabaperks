import posterDesignsJson from "@/config/poster-designs.json" with { type: "json" }
import type {
  PosterCollection,
  PosterCollectionId,
  PosterDesignId,
  PosterFormatId,
  PosterTemplateMetadata,
} from "./poster-content-types"
type JsonRecord = Record<string, unknown>

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function requireRecord(value: unknown, path: string): JsonRecord {
  if (!isRecord(value)) {
    throw new Error(`Expected poster object at ${path}`)
  }
  return value
}
export function requireString(
  record: JsonRecord,
  key: string,
  path: string
): string {
  const value = record[key]
  if (typeof value !== "string") {
    throw new Error(`Expected poster string at ${path}.${key}`)
  }
  return value
}
export function requireNumber(
  record: JsonRecord,
  key: string,
  path: string
): number {
  const value = record[key]
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Expected poster number at ${path}.${key}`)
  }
  return value
}
export function requireArray(
  record: JsonRecord,
  key: string,
  path: string
): readonly unknown[] {
  const value = record[key]
  if (!Array.isArray(value)) {
    throw new Error(`Expected poster array at ${path}.${key}`)
  }
  return value
}

export function requireRecordField(
  record: JsonRecord,
  key: string,
  path: string
): JsonRecord {
  return requireRecord(record[key], `${path}.${key}`)
}

let parsedCatalogue: JsonRecord | undefined

function catalogueRoot(): JsonRecord {
  if (parsedCatalogue) return parsedCatalogue
  const root = requireRecord(posterDesignsJson, "posterDesigns")
  if (
    requireString(root, "schema", "posterDesigns") !==
    "nabaperks.poster-designs.v3"
  ) {
    throw new Error("Unsupported poster catalogue schema")
  }
  parsedCatalogue = root
  return root
}

function parseCollectionId(value: string): PosterCollectionId {
  if (value === "counter") return value
  throw new Error(`Unknown poster collection ${value}`)
}

function parseFormatId(value: string): PosterFormatId {
  if (value === "a4-counter") return value
  throw new Error(`Unknown poster format ${value}`)
}

function parseSheet(value: string): "a4" {
  if (value === "a4") return value
  throw new Error(`Unknown poster sheet ${value}`)
}

function parsePosterDesignId(value: string): PosterDesignId {
  switch (value) {
    case "editorial":
    case "bold":
    case "ticket":
    case "northstar":
    case "thermal":
      return value
    default:
      throw new Error(`Unknown poster template ${value}`)
  }
}

function templateRecord(templateId: PosterDesignId): JsonRecord {
  const root = catalogueRoot()
  const templates = requireArray(root, "templates", "posterDesigns")
  for (const candidate of templates) {
    const template = requireRecord(candidate, "posterDesigns.templates[]")
    if (
      requireString(template, "id", "posterDesigns.templates[]") === templateId
    ) {
      return template
    }
  }
  throw new Error(`Missing poster template ${templateId}`)
}

export function posterDesignIds(): readonly PosterDesignId[] {
  const templates = requireArray(catalogueRoot(), "templates", "posterDesigns")
  const ids = templates.map((candidate) => {
    const template = requireRecord(candidate, "posterDesigns.templates[]")
    return parsePosterDesignId(
      requireString(template, "id", "posterDesigns.templates[]")
    )
  })
  if (ids.length !== 5 || new Set(ids).size !== ids.length) {
    throw new Error("Poster catalogue must contain five unique templates")
  }
  return ids
}

export function posterCollections(): readonly PosterCollection[] {
  const records = requireArray(catalogueRoot(), "collections", "posterDesigns")
  const collections = records.map((candidate) => {
    const record = requireRecord(candidate, "posterDesigns.collections[]")
    const path = "posterDesigns.collections[]"
    return {
      id: parseCollectionId(requireString(record, "id", path)),
      name: requireString(record, "name", path),
      description: requireString(record, "description", path),
      format: parseFormatId(requireString(record, "format", path)),
      sheet: parseSheet(requireString(record, "sheet", path)),
      revision: requireNumber(record, "revision", path),
    }
  })
  if (
    collections.length !== 1 ||
    new Set(collections.map(({ id }) => id)).size !== 1
  ) {
    throw new Error("Poster catalogue must contain one counter collection")
  }
  return collections
}

export function rawTemplateCopy(templateId: PosterDesignId): JsonRecord {
  return requireRecordField(
    templateRecord(templateId),
    "copy",
    `posterDesigns.templates.${templateId}`
  )
}

export function templateNumber(
  templateId: PosterDesignId,
  key: string
): number {
  return requireNumber(
    templateRecord(templateId),
    key,
    `posterDesigns.templates.${templateId}`
  )
}

export function templateRecordField(
  templateId: PosterDesignId,
  key: string
): JsonRecord {
  return requireRecordField(
    templateRecord(templateId),
    key,
    `posterDesigns.templates.${templateId}`
  )
}

export function sharedRecord(key: string): JsonRecord {
  const root = catalogueRoot()
  const shared = requireRecordField(root, "shared", "posterDesigns")
  return requireRecordField(shared, key, "posterDesigns.shared")
}

export function sharedArray(key: string): readonly unknown[] {
  const shared = requireRecordField(catalogueRoot(), "shared", "posterDesigns")
  return requireArray(shared, key, "posterDesigns.shared")
}

export function sharedString(key: string): string {
  const root = catalogueRoot()
  const shared = requireRecordField(root, "shared", "posterDesigns")
  return requireString(shared, key, "posterDesigns.shared")
}

export function templateMetadata(
  templateId: PosterDesignId
): PosterTemplateMetadata {
  const template = templateRecord(templateId)
  const path = `posterDesigns.templates.${templateId}`
  const collection = parseCollectionId(
    requireString(template, "collection", path)
  )
  const format = parseFormatId(requireString(template, "format", path))
  const sheet = parseSheet(requireString(template, "sheet", path))
  const revision = requireNumber(template, "revision", path)
  const collectionMetadata = posterCollections().find(
    ({ id }) => id === collection
  )
  if (
    !collectionMetadata ||
    collectionMetadata.format !== format ||
    collectionMetadata.sheet !== sheet ||
    collectionMetadata.revision !== revision
  ) {
    throw new Error(
      `Poster template ${templateId} does not match its collection`
    )
  }
  return {
    id: templateId,
    name: requireString(template, "name", path),
    description: requireString(template, "description", path),
    useCase: requireString(template, "useCase", path),
    collection,
    format,
    sheet,
    revision,
  }
}
