import assert from "node:assert/strict"
import { test } from "node:test"

import { parseEnvText, serializeEnvValue } from "../../scripts/env-file.mjs"

test("generated dotenv values round-trip parser metacharacters", () => {
  const values = [
    "secret#with-comment-marker",
    "line one\nline two",
    'quote " and backslash \\\\',
    " leading and trailing ",
    "",
  ]

  for (const value of values) {
    const parsed = parseEnvText(`SECRET=${serializeEnvValue(value)}\n`)
    assert.equal(parsed.SECRET, value)
  }
})

test("unquoted comments match Next dotenv semantics", () => {
  assert.equal(parseEnvText("SECRET=short#ignored\n").SECRET, "short")
})

test("unrepresentable dotenv values fail instead of being corrupted", () => {
  assert.throws(
    () => serializeEnvValue("'\"`#"),
    /cannot be represented safely/
  )
  assert.throws(
    () => serializeEnvValue("carriage\rreturn"),
    /cannot be represented safely/
  )
})
