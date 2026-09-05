/**
 * The evidence digest.
 *
 * A local CI result is only worth anything if the log it attests to can be
 * matched against the log on disk months later. That requires the two sides to
 * agree byte-for-byte on what was hashed, which is why canonicalisation is
 * part of the contract rather than an implementation detail:
 *
 *   - CRLF is normalised to LF, because a log that crosses a Windows-aware
 *     editor or a container boundary can gain carriage returns without any
 *     change to its content.
 *   - Exactly one trailing newline is stripped, because "the file ends with a
 *     newline" is a property of how it was written, not of what it says.
 *
 * `digestLogBundle` hashes a length-prefixed concatenation. Without the length
 * prefix, the two-part bundles ["ab", "c"] and ["a", "bc"] hash identically,
 * so a log reassembled in the wrong split would still verify. The part count
 * is prefixed for the same reason at the bundle level.
 *
 * node:crypto is the only import, and it is stdlib.
 */

import { createHash } from "node:crypto"

import { LocalCiError, describeValue } from "./contract.mjs"

export const DIGEST_ALGORITHM = "sha256"
export const DIGEST_HEX_LENGTH = 64

/** Prefix of the summary's last line. The runbook reads it with `tail -n 1`. */
export const DIGEST_LINE_PREFIX = "Log digest: "

export class DigestError extends LocalCiError {}

const DIGEST_HEX = /^[0-9a-f]{64}$/

/** True for a 64-character lowercase hexadecimal SHA-256 digest. */
export function isDigestShaped(value) {
  return typeof value === "string" && DIGEST_HEX.test(value)
}

function toText(input, label) {
  if (typeof input === "string") return input
  // Buffers are decoded as UTF-8 on purpose: the thing being hashed is a text
  // log, and the check output and the on-disk file must canonicalise the same
  // way whether the caller read the file as text or as bytes.
  if (input instanceof Uint8Array) return Buffer.from(input).toString("utf8")
  throw new DigestError(
    "INVALID_INPUT",
    `${label} must be a string or a Uint8Array/Buffer (received ${describeValue(input)})`
  )
}

/**
 * Canonicalise log text before hashing: CRLF to LF, then strip at most one
 * trailing newline. Exported so a caller writing the log to disk can store the
 * same bytes it attested to.
 */
export function canonicalizeLogText(input) {
  const text = toText(input, "log text")
  const unified = text.replace(/\r\n/g, "\n")
  return unified.endsWith("\n") ? unified.slice(0, -1) : unified
}

/**
 * Lowercase hex SHA-256 of the canonicalised text. Stable for identical input,
 * and stable across a trailing-newline or line-ending difference.
 */
export function logDigest(input) {
  return createHash(DIGEST_ALGORITHM)
    .update(canonicalizeLogText(input), "utf8")
    .digest("hex")
}

/**
 * Lowercase hex SHA-256 of the raw bytes, with no canonicalisation. For the
 * cases where byte-exactness is the point - an artifact, a tarball - and the
 * newline rules above would be wrong.
 */
export function rawDigest(input) {
  const hash = createHash(DIGEST_ALGORITHM)
  if (typeof input === "string") {
    hash.update(input, "utf8")
  } else if (input instanceof Uint8Array) {
    hash.update(Buffer.from(input))
  } else {
    throw new DigestError(
      "INVALID_INPUT",
      `rawDigest input must be a string or a Uint8Array/Buffer (received ${describeValue(input)})`
    )
  }
  return hash.digest("hex")
}

/**
 * Digest an ordered bundle of log parts.
 *
 * Each part is canonicalised, then fed in as its UTF-8 byte length, a newline,
 * and the bytes. The part count leads the stream. Moving a byte between two
 * adjacent parts, or splitting one part into two, changes the digest.
 *
 * The order is the caller's: the lane-result record names its parts in
 * `logParts`, and re-hashing must walk that list in the same order.
 */
export function digestLogBundle(parts) {
  if (!Array.isArray(parts)) {
    throw new DigestError(
      "INVALID_INPUT",
      `digestLogBundle requires an array of log parts (received ${describeValue(parts)})`
    )
  }
  const hash = createHash(DIGEST_ALGORITHM)
  hash.update(`${parts.length}\n`, "utf8")
  for (const [index, part] of parts.entries()) {
    const canonical = canonicalizeLogText(
      toText(part, `digestLogBundle part ${index}`)
    )
    const bytes = Buffer.from(canonical, "utf8")
    hash.update(`${bytes.length}\n`, "utf8")
    hash.update(bytes)
  }
  return hash.digest("hex")
}

/** The summary's last line: `Log digest: <64 lowercase hex characters>`. */
export function formatDigestLine(digest) {
  if (!isDigestShaped(digest)) {
    throw new DigestError(
      "INVALID_DIGEST",
      `digest must be ${DIGEST_HEX_LENGTH} lowercase hexadecimal characters (received ${describeValue(digest)})`
    )
  }
  return `${DIGEST_LINE_PREFIX}${digest}`
}

/**
 * Read the digest back out of a rendered summary. Returns null when the last
 * non-empty line is not a digest line, so a caller can tell "no digest" from
 * "wrong digest" rather than comparing against undefined.
 */
export function parseDigestLine(text) {
  if (typeof text !== "string") return null
  const lines = text.split("\n").filter((line) => line.trim() !== "")
  const last = lines.at(-1)
  if (last === undefined || !last.startsWith(DIGEST_LINE_PREFIX)) return null
  const digest = last.slice(DIGEST_LINE_PREFIX.length).trim()
  return isDigestShaped(digest) ? digest : null
}
