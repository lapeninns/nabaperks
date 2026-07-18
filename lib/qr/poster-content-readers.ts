import {
  requireArray,
  requireRecord,
  requireRecordField,
  requireString,
  sharedArray,
} from "./poster-design-reader"
import type { AccentHeadline, ReceiptItem } from "./poster-content-types"

const PLACEHOLDER_PATTERN = /\{([A-Za-z][A-Za-z0-9]*)\}/g

export function validateStampsRequired(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 6) {
    throw new Error("Poster stampsRequired must be an integer from 1 to 6")
  }
  return value
}

function numberWord(stampsRequired: number): string {
  const words = sharedArray("numberWords")
  const word = words[stampsRequired]
  return typeof word === "string" ? word : String(stampsRequired)
}

export function resolvePosterText(
  value: string,
  stampsRequired: number
): string {
  const stamps = validateStampsRequired(stampsRequired)
  const resolved = value.replace(PLACEHOLDER_PATTERN, (token, name: string) => {
    if (name === "stamps") return String(stamps)
    if (name === "StampsWord") {
      const word = numberWord(stamps)
      return word.charAt(0).toUpperCase() + word.slice(1)
    }
    throw new Error(`Unsupported poster placeholder ${token}`)
  })
  if (resolved.includes("{") || resolved.includes("}")) {
    throw new Error(`Unresolved poster placeholder in ${value}`)
  }
  return resolved
}

export function copyString(
  record: Record<string, unknown>,
  key: string,
  stampsRequired: number,
  path: string
): string {
  return resolvePosterText(requireString(record, key, path), stampsRequired)
}

export function accentHeadline(
  record: Record<string, unknown>,
  key: string,
  stampsRequired: number,
  path: string
): AccentHeadline {
  const headline = requireRecordField(record, key, path)
  const headlinePath = `${path}.${key}`
  return {
    beforeAccent: copyString(
      headline,
      "beforeAccent",
      stampsRequired,
      headlinePath
    ),
    accent: copyString(headline, "accent", stampsRequired, headlinePath),
    afterAccent: copyString(
      headline,
      "afterAccent",
      stampsRequired,
      headlinePath
    ),
  }
}

export function receiptItems(
  record: Record<string, unknown>,
  stampsRequired: number,
  path: string
): readonly ReceiptItem[] {
  return requireArray(record, "items", path).map((value, index) => {
    const item = requireRecord(value, `${path}.items[${index}]`)
    return {
      label: copyString(
        item,
        "label",
        stampsRequired,
        `${path}.items[${index}]`
      ),
      value: copyString(
        item,
        "value",
        stampsRequired,
        `${path}.items[${index}]`
      ),
      accent: item.accent === true,
    }
  })
}

export function stringTuple2(
  record: Record<string, unknown>,
  key: string,
  stampsRequired: number,
  path: string
): readonly [string, string] {
  const values = requireArray(record, key, path)
  if (values.length !== 2) {
    throw new Error(`Expected two poster strings at ${path}.${key}`)
  }
  const first = values[0]
  const second = values[1]
  if (typeof first !== "string" || typeof second !== "string") {
    throw new Error(`Expected two poster strings at ${path}.${key}`)
  }
  return [
    resolvePosterText(first, stampsRequired),
    resolvePosterText(second, stampsRequired),
  ]
}

export function stringTuple3(
  record: Record<string, unknown>,
  key: string,
  stampsRequired: number,
  path: string
): readonly [string, string, string] {
  const values = requireArray(record, key, path)
  if (values.length !== 3) {
    throw new Error(`Expected three poster strings at ${path}.${key}`)
  }
  const [first, second, third] = values
  if (
    typeof first !== "string" ||
    typeof second !== "string" ||
    typeof third !== "string"
  ) {
    throw new Error(`Expected three poster strings at ${path}.${key}`)
  }
  return [
    resolvePosterText(first, stampsRequired),
    resolvePosterText(second, stampsRequired),
    resolvePosterText(third, stampsRequired),
  ]
}
