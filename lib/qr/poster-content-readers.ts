import {
  requireString,
  sharedArray,
  sharedRecord,
  sharedString,
} from "./poster-design-reader"
import type { FrictionTriple } from "./poster-kit-content-types"

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

/** Resolve a grammar-safe one/many copy pair, keyed off stampsRequired. */
export function copyChoice(
  record: Record<string, unknown>,
  baseKey: string,
  stampsRequired: number,
  path: string
): string {
  const key = stampsRequired === 1 ? `${baseKey}One` : `${baseKey}Many`
  return copyString(record, key, stampsRequired, path)
}

/** The shared friction-reduction triple: browser, join, marketing. */
export function sharedFrictionTriple(stampsRequired: number): FrictionTriple {
  const friction = sharedRecord("friction")
  const path = "posterDesigns.shared.friction"
  return [
    copyString(friction, "browser", stampsRequired, path),
    copyString(friction, "join", stampsRequired, path),
    copyString(friction, "marketing", stampsRequired, path),
  ]
}

/** The shared Nabaperks member-venue endorsement tag. */
export function sharedMemberTag(): string {
  return sharedString("memberTag")
}
