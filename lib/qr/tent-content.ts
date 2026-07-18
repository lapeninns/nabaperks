import { requireRecordField, requireString } from "./poster-json-readers"
import { tentDesignMetadata, tentDesignRecord } from "./tent-design-reader"
import {
  requireStringArray,
  resolveTentText,
  tentFonts,
  tentFooter,
  tentFriction,
  tentGeometry,
  tentKicker,
  tentFoldLabel,
  tentPalette,
  tentQr,
  tentReassurance,
  tentTypeTiers,
  validateTentStamps,
} from "./tent-content-readers"
import type {
  TentContent,
  TentContentBase,
  TentDesignId,
  TentFaceContent,
  TentFaceTone,
  TentFaceVariant,
} from "./tent-content-types"

export { tentDesignIds, tentDesignMetadata } from "./tent-design-reader"
export { resolveTentText, validateTentStamps } from "./tent-content-readers"

function parseVariant(value: string): TentFaceVariant {
  switch (value) {
    case "loss":
    case "social":
    case "sealed":
    case "plan":
    case "urgency":
    case "scan":
    case "claim":
      return value
    default:
      throw new Error(`Unknown table-tent face variant ${value}`)
  }
}

function parseTone(value: string): TentFaceTone {
  if (value === "paper" || value === "ink" || value === "sealed") return value
  throw new Error(`Unknown table-tent face tone ${value}`)
}

function optionalString(
  record: Record<string, unknown>,
  key: string
): string | null {
  const value = record[key]
  if (value === undefined || value === null) return null
  if (typeof value !== "string") {
    throw new Error(`Expected table-tent optional string for ${key}`)
  }
  return value
}

function resolveFace(
  designId: TentDesignId,
  key: "faceA" | "faceB",
  stampsRequired: number
): TentFaceContent {
  const record = requireRecordField(
    tentDesignRecord(designId),
    key,
    `tableTentDesigns.designs.${designId}`
  )
  const path = `tableTentDesigns.designs.${designId}.${key}`
  const badge = optionalString(record, "badge")
  return {
    variant: parseVariant(requireString(record, "variant", path)),
    tone: parseTone(requireString(record, "tone", path)),
    badge: badge === null ? null : resolveTentText(badge, stampsRequired),
    headline: requireStringArray(record, "headline", path).map((line) =>
      resolveTentText(line, stampsRequired)
    ),
    accent: resolveTentText(
      requireString(record, "accent", path),
      stampsRequired
    ),
    body: resolveTentText(requireString(record, "body", path), stampsRequired),
    showStamps: record.showStamps === true,
    cta: resolveTentText(requireString(record, "cta", path), stampsRequired),
  }
}

function tentContentBase(): TentContentBase {
  return {
    sheet: "a4",
    kicker: tentKicker(),
    foldLabel: tentFoldLabel(),
    reassurance: tentReassurance(),
    footer: tentFooter(),
    friction: tentFriction(),
    geometry: tentGeometry(),
    qr: tentQr(),
    palette: tentPalette(),
    fonts: tentFonts(),
    typeTiers: tentTypeTiers(),
  }
}

export function resolveTentContent(
  designId: TentDesignId,
  stampsRequired: number
): TentContent {
  const stamps = validateTentStamps(stampsRequired)
  const metadata = tentDesignMetadata(designId)
  return {
    ...tentContentBase(),
    id: designId,
    name: metadata.name,
    stampsRequired: stamps,
    faceA: resolveFace(designId, "faceA", stamps),
    faceB: resolveFace(designId, "faceB", stamps),
  }
}

export type {
  TentContent,
  TentDesignId,
  TentDesignMetadata,
  TentFaceContent,
} from "./tent-content-types"
