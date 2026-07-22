import { normalizeEmail } from "@/lib/customer/email-pii-core"
import { LOYALTY_INVITE_MAX_RECIPIENTS } from "@/lib/loyalty-invites/constants"

/**
 * Pure parsing / normalisation / dedupe for a merchant's pasted or uploaded
 * recipient list (no `server-only`, no Supabase — unit-tested directly). It
 * decides *shape* eligibility only: valid vs invalid vs duplicate. The
 * "not eligible" bucket (existing member, suppressed, previously invited) needs
 * database lookups and is resolved by the server action, never here.
 */

// Deliberately stricter than looksLikeEmail: a single "@", a dotted domain, no
// whitespace, and a bounded length. A false negative just asks the merchant to
// fix a row; a false positive wastes a send and risks a bounce.
const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/
const MAX_EMAIL_LENGTH = 254

export type InviteImportResult = {
  /** Normalised, unique, valid addresses — the candidates for DB eligibility. */
  readonly emails: readonly string[]
  readonly totalParsed: number
  readonly validCount: number
  readonly invalidCount: number
  readonly duplicateCount: number
  /** True when unique-valid addresses exceed the 2,000 cap (no silent trim). */
  readonly overLimit: boolean
}

function isValidEmail(candidate: string): boolean {
  return candidate.length <= MAX_EMAIL_LENGTH && EMAIL_RE.test(candidate)
}

/** Split one CSV record into fields, honouring simple double-quoted quoting. */
function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ""
  let quoted = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (quoted) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i += 1
        } else {
          quoted = false
        }
      } else {
        current += char
      }
      continue
    }
    if (char === '"') {
      quoted = true
    } else if (char === ",") {
      fields.push(current)
      current = ""
    } else {
      current += char
    }
  }
  fields.push(current)
  return fields.map((field) => field.trim())
}

/** Detect a CSV whose header row contains an `email` column; return its index. */
function emailColumnIndex(firstLine: string): number {
  const header = parseCsvLine(firstLine).map((cell) => cell.toLowerCase())
  return header.findIndex((cell) => cell === "email")
}

/** Extract the raw address tokens from CSV text or delimited pasted text. */
function extractRawTokens(raw: string): string[] {
  const lines = raw.split(/\r?\n/)
  const firstNonEmpty = lines.find((line) => line.trim() !== "")
  if (firstNonEmpty !== undefined) {
    const columnIndex = emailColumnIndex(firstNonEmpty)
    if (columnIndex >= 0) {
      // CSV mode: read the `email` column of every row after the header.
      const headerSeen = { done: false }
      const tokens: string[] = []
      for (const line of lines) {
        if (line.trim() === "") continue
        if (!headerSeen.done) {
          headerSeen.done = true
          continue
        }
        tokens.push(parseCsvLine(line)[columnIndex] ?? "")
      }
      return tokens
    }
  }
  // Paste mode: newline / comma / semicolon separated addresses.
  return raw.split(/[\n,;]+/)
}

export function parseInviteEmailInput(raw: string): InviteImportResult {
  const tokens = extractRawTokens(raw)
    .map((token) => token.trim())
    .filter((token) => token !== "")

  const seen = new Set<string>()
  let invalidCount = 0
  let duplicateCount = 0
  const emails: string[] = []

  for (const token of tokens) {
    const normalized = normalizeEmail(token)
    if (!isValidEmail(normalized)) {
      invalidCount += 1
      continue
    }
    if (seen.has(normalized)) {
      duplicateCount += 1
      continue
    }
    seen.add(normalized)
    emails.push(normalized)
  }

  return {
    emails,
    totalParsed: tokens.length,
    validCount: emails.length,
    invalidCount,
    duplicateCount,
    overLimit: emails.length > LOYALTY_INVITE_MAX_RECIPIENTS,
  }
}
