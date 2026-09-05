import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { test } from "node:test"

import {
  DIGEST_HEX_LENGTH,
  DIGEST_LINE_PREFIX,
  DigestError,
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
