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
 * Past that point it is bytes all the way to the hash. A digest offered as
 * proof that a log was not altered has to bind that log's bytes, so nothing
 * here decodes a buffer into a string on the way in: decoding replaces every
 * invalid UTF-8 sequence with U+FFFD, and the two distinct logs `41 80 42` and
 * `41 FF 42` would then attest to one and the same digest. A caller that hands
 * over a string is encoded to UTF-8 once, and those bytes are what is hashed.
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

const CARRIAGE_RETURN = 0x0d
const LINE_FEED = 0x0a

/** True for a 64-character lowercase hexadecimal SHA-256 digest. */
export function isDigestShaped(value) {
  return typeof value === "string" && DIGEST_HEX.test(value)
}

function toBytes(input, label) {
  // A string is encoded to UTF-8 here, once, and is never decoded again; a
  // buffer is taken exactly as it stands. Both paths reach the hash as bytes.
  if (typeof input === "string") return Buffer.from(input, "utf8")
  if (input instanceof Uint8Array) return Buffer.from(input)
  throw new DigestError(
    "INVALID_INPUT",
    `${label} must be a string or a Uint8Array/Buffer (received ${describeValue(input)})`
  )
}

function foldCarriageReturns(bytes) {
  if (!bytes.includes(CARRIAGE_RETURN)) return bytes
  const folded = Buffer.alloc(bytes.length)
  let length = 0
  for (let index = 0; index < bytes.length; index += 1) {
    // Only the CR of a CR LF pair goes; a lone CR is content and stays.
    if (bytes[index] === CARRIAGE_RETURN && bytes[index + 1] === LINE_FEED) {
      continue
    }
    folded[length] = bytes[index]
    length += 1
  }
  return folded.subarray(0, length)
}

/**
 * Canonicalise log bytes before hashing: CRLF to LF, then strip at most one
 * trailing newline. This is the form the digest binds, so a caller writing the
 * log to disk can store exactly these bytes.
 *
 * The scan is byte-wise, which is safe rather than merely convenient: no byte
 * of a multi-byte UTF-8 sequence is below 0x80, so a CR or LF byte is always a
 * real CR or LF and never the tail of some other character. It is also the
 * only way to canonicalise a log that is *not* valid UTF-8 without destroying
 * the very bytes the digest exists to bind.
 */
export function canonicalizeLogBytes(input, label = "log text") {
  const bytes = foldCarriageReturns(toBytes(input, label))
  return bytes.at(-1) === LINE_FEED ? bytes.subarray(0, -1) : bytes
}

/**
 * The text view of the canonical form, for a caller that wants to read or
 * render the log rather than hash it. A caller that needs the exact bytes the
 * digest attested to wants `canonicalizeLogBytes`: decoding is lossy for a log
 * that is not valid UTF-8, which is precisely why the digest does not go
 * through it.
 */
export function canonicalizeLogText(input) {
  return canonicalizeLogBytes(input, "log text").toString("utf8")
}

/**
 * Lowercase hex SHA-256 of the canonicalised bytes. Stable for identical
 * input, and stable across a trailing-newline or line-ending difference.
 */
export function logDigest(input) {
  return createHash(DIGEST_ALGORITHM)
    .update(canonicalizeLogBytes(input))
    .digest("hex")
}

/**
 * Lowercase hex SHA-256 of the raw bytes, with no canonicalisation. For the
 * cases where byte-exactness is the point - an artifact, a tarball - and the
 * newline rules above would be wrong.
 */
export function rawDigest(input) {
  return createHash(DIGEST_ALGORITHM)
    .update(toBytes(input, "rawDigest input"))
    .digest("hex")
}

/**
 * Digest an ordered bundle of log parts.
 *
 * Each part is canonicalised, then fed in as its byte length, a newline, and
 * those same bytes. The part count leads the stream. Moving a byte between two
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
    const bytes = canonicalizeLogBytes(part, `digestLogBundle part ${index}`)
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
