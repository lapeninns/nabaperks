import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { test } from "node:test"

import {
  DIGEST_HEX_LENGTH,
  DIGEST_LINE_PREFIX,
  DigestError,
  canonicalizeLogBytes,
  canonicalizeLogText,
  digestLogBundle,
  formatDigestLine,
  isDigestShaped,
  logDigest,
  parseDigestLine,
  rawDigest,
} from "../../ops/local-ci/core/digest.mjs"

/**
 * local CI — the evidence digest. A published result is only worth something
 * if the log it attests to can be matched against the log on disk months
 * later, so canonicalisation is part of the contract: line endings and a
 * trailing newline are properties of how a file was written, not of what it
 * says. The bundle digest is length-prefixed so a log reassembled in the wrong
 * split cannot verify.
 */

test("canonicalisation folds CRLF and strips at most one trailing newline", () => {
  assert.equal(canonicalizeLogText("a\r\nb\r\n"), "a\nb")
  assert.equal(canonicalizeLogText("a\nb\n"), "a\nb")
  assert.equal(canonicalizeLogText("a\nb"), "a\nb")
  assert.equal(canonicalizeLogText("a\nb\n\n"), "a\nb\n")
  assert.equal(canonicalizeLogText(""), "")
  assert.equal(canonicalizeLogText(Buffer.from("a\r\nb\n", "utf8")), "a\nb")
})

test("the digest is stable across a line-ending or trailing-newline difference", () => {
  const digest = logDigest("lane fast\npassed 118\n")
  assert.equal(logDigest("lane fast\r\npassed 118\r\n"), digest)
  assert.equal(logDigest("lane fast\npassed 118"), digest)
  assert.equal(
    logDigest(Buffer.from("lane fast\npassed 118\n", "utf8")),
    digest
  )
  assert.equal(isDigestShaped(digest), true)
  assert.equal(digest.length, DIGEST_HEX_LENGTH)

  // It is a plain SHA-256 of the canonical text, not a bespoke construction.
  assert.equal(
    digest,
    createHash("sha256").update("lane fast\npassed 118", "utf8").digest("hex")
  )
})

test("rawDigest hashes the bytes it was given, newlines and all", () => {
  assert.notEqual(rawDigest("a\n"), rawDigest("a"))
  assert.equal(
    rawDigest("a\n"),
    createHash("sha256").update("a\n", "utf8").digest("hex")
  )
})

test("a log bundle is length-prefixed, so a re-split bundle does not verify", () => {
  assert.notEqual(digestLogBundle(["ab", "c"]), digestLogBundle(["a", "bc"]))
  assert.notEqual(digestLogBundle(["abc"]), digestLogBundle(["ab", "c"]))
  assert.notEqual(digestLogBundle(["a", "b"]), digestLogBundle(["b", "a"]))
  assert.equal(digestLogBundle(["a", "b"]), digestLogBundle(["a", "b"]))
  assert.equal(digestLogBundle(["a\r\n"]), digestLogBundle(["a"]))
  assert.equal(isDigestShaped(digestLogBundle([])), true)
})

test("the digest line is the last line of the summary and reads back exactly", () => {
  const digest = logDigest("some lane output")
  const line = formatDigestLine(digest)
  assert.equal(line, `${DIGEST_LINE_PREFIX}${digest}`)
  assert.equal(parseDigestLine(`## Lanes\n\n| a |\n\n${line}`), digest)
  assert.equal(parseDigestLine(`${line}\n\n`), digest)
})

test("a missing or malformed digest line reads back as null, not as a wrong digest", () => {
  assert.equal(parseDigestLine("no digest here"), null)
  assert.equal(parseDigestLine(`${DIGEST_LINE_PREFIX}not-a-digest`), null)
  assert.equal(parseDigestLine(`${DIGEST_LINE_PREFIX}${"A".repeat(64)}`), null)
  assert.equal(parseDigestLine(""), null)
  assert.equal(parseDigestLine(null), null)
})

test("the digest helpers refuse input they cannot hash reproducibly", () => {
  assert.throws(
    () => logDigest(42),
    (error) => error instanceof DigestError && error.code === "INVALID_INPUT"
  )
  assert.throws(
    () => digestLogBundle("not-an-array"),
    (error) => error.code === "INVALID_INPUT"
  )
  assert.throws(
    () => digestLogBundle([{ path: "fast.log" }]),
    (error) => error.code === "INVALID_INPUT"
  )
  assert.throws(
    () => formatDigestLine("short"),
    (error) => error.code === "INVALID_DIGEST"
  )
})

test("a log that is not valid UTF-8 is bound by its bytes, not by its decoding", () => {
  // Decoding to a string first replaced every invalid sequence with U+FFFD, so
  // these two distinct logs attested to one and the same digest. The digest is
  // the evidence that a log was not altered; it has to bind the bytes.
  const lone = Buffer.from([0x41, 0x80, 0x42])
  const invalid = Buffer.from([0x41, 0xff, 0x42])
  assert.notEqual(logDigest(lone), logDigest(invalid))
  assert.notEqual(digestLogBundle([lone]), digestLogBundle([invalid]))

  // Canonicalisation is not skipped for input it cannot decode: the trailing
  // newline still goes, so the two digests still say different things.
  const trailing = Buffer.from([0x41, 0x80, 0x0a])
  assert.notEqual(logDigest(trailing), rawDigest(trailing))
  assert.equal(logDigest(trailing), logDigest(Buffer.from([0x41, 0x80])))

  // Canonicalisation still applies, and still applies byte-wise: CR LF folds,
  // one trailing LF goes, and the undecodable byte between them survives.
  assert.equal(
    canonicalizeLogBytes(
      Buffer.from([0x41, 0x80, 0x0d, 0x0a, 0x42, 0x0a])
    ).toString("hex"),
    "41800a42"
  )

  // And the length prefix keeps its job over bytes: a bundle re-split at the
  // undecodable byte does not verify against the bundle it was split from.
  assert.notEqual(
    digestLogBundle([lone]),
    digestLogBundle([Buffer.from([0x41]), Buffer.from([0x80, 0x42])])
  )
})

test("hashing bytes leaves the digest of a decodable log exactly where it was", () => {
  // Real lane logs are ASCII, so the values below are the ones the previous,
  // string-decoding implementation produced. They are hard-coded rather than
  // recomputed: the point is that no stored digest moved under anyone's feet.
  const ascii = "lane fast\npassed 118\n"
  assert.equal(
    logDigest(ascii),
    "8e8612f3d684e8f6e4cc01a2a4e89722a5c0bcb38c6869223bb619339d4eba02"
  )
  assert.equal(
    digestLogBundle([ascii]),
    "9bb655dde6b1335883c99347698fac335c9cf6d3f72f9e81a47f096ad9918f31"
  )
  assert.equal(
    digestLogBundle(["lane fast\r\npassed 118\r\n", "service redis\nready\n"]),
    "899a7cce69ea0ba9353bfe9ab5266e5eec822cfb40929d210752cc77344baac6"
  )
  assert.equal(
    digestLogBundle(["ab", "c"]),
    "1a584c64ab4ac35ef2651522b8d2de67309b45eeaed44d47d4576af0ecf32b3f"
  )

  // A string and its UTF-8 bytes hash alike wherever the bytes are decodable,
  // which is what lets the runbook re-hash a log it read as text.
  assert.equal(logDigest(Buffer.from(ascii, "utf8")), logDigest(ascii))
  assert.equal(
    digestLogBundle([Buffer.from("café ✓\n", "utf8")]),
    digestLogBundle(["café ✓\n"])
  )
})
