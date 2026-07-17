import posterDesignsJson from "@/config/poster-designs.json" with { type: "json" }
import type { PosterDesignId, PosterTableTentId } from "./poster-content-types"
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

function catalogueRoot(): JsonRecord {
  const root = requireRecord(posterDesignsJson, "posterDesigns")
  if (
    requireString(root, "schema", "posterDesigns") !==
    "nabaperks.poster-designs.v2"
  ) {
    throw new Error("Unsupported poster catalogue schema")
  }
  return root
}

function parsePosterDesignId(value: string): PosterDesignId {
  switch (value) {
    case "editorial":
    case "bold":
    case "ticket":
    case "northstar":
    case "thermal":
    case "table-tent":
    case "table-tent-night":
    case "table-tent-studio":
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
  if (ids.length !== 8 || new Set(ids).size !== ids.length) {
    throw new Error("Poster catalogue must contain eight unique templates")
  }
  return ids
}

export function posterTableTentIds(): readonly PosterTableTentId[] {
  const ids: PosterTableTentId[] = []
  for (const id of posterDesignIds()) {
    const template = templateRecord(id)
    if (
      requireString(template, "sheet", `posterDesigns.templates.${id}`) !== "b5"
    ) {
      continue
    }
    if (
      id !== "table-tent" &&
      id !== "table-tent-night" &&
      id !== "table-tent-studio"
    ) {
      throw new Error(`Unexpected B5 poster template ${id}`)
    }
    ids.push(id)
  }
  return ids
}

export function rawTemplateCopy(templateId: PosterDesignId): JsonRecord {
  return requireRecordField(
    templateRecord(templateId),
    "copy",
    `posterDesigns.templates.${templateId}`
  )
}

export function rawFaceCopy(
  templateId: PosterTableTentId,
  face: "top" | "bottom"
): JsonRecord {
  const template = templateRecord(templateId)
  const faces = requireRecordField(
    template,
    "faces",
    `posterDesigns.templates.${templateId}`
  )
  const faceRecord = requireRecordField(
    faces,
    face,
    `posterDesigns.templates.${templateId}.faces`
  )
  return requireRecordField(
    faceRecord,
    "copy",
    `posterDesigns.templates.${templateId}.faces.${face}`
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

export function faceNumber(
  templateId: PosterTableTentId,
  face: "top" | "bottom",
  key: string
): number {
  const faces = requireRecordField(
    templateRecord(templateId),
    "faces",
    `posterDesigns.templates.${templateId}`
  )
  const faceRecord = requireRecordField(
    faces,
    face,
    `posterDesigns.templates.${templateId}.faces`
  )
  return requireNumber(
    faceRecord,
    key,
    `posterDesigns.templates.${templateId}.faces.${face}`
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

export function templateMetadata(templateId: PosterDesignId): {
  readonly id: PosterDesignId
  readonly name: string
  readonly description: string
  readonly useCase: string
} {
  const template = templateRecord(templateId)
  return {
    id: templateId,
    name: requireString(
      template,
      "name",
      `posterDesigns.templates.${templateId}`
    ),
    description: requireString(
      template,
      "description",
      `posterDesigns.templates.${templateId}`
    ),
    useCase: requireString(
      template,
      "useCase",
      `posterDesigns.templates.${templateId}`
    ),
  }
}
