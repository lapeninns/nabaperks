import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"

import { parseCsv } from "../../scripts/seo-csv.mjs"

function runContentAudit(inputPath) {
  return spawnSync("pnpm", ["seo:content-audit", "--", inputPath], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 10_000,
  })
}

test("Given the documented pnpm delimiter When the SEO content audit runs Then it reads the requested fixture", () => {
  // Given
  const fixture = "tests/fixtures/seo-content-audit.csv"

  // When
  const result = runContentAudit(fixture)

  // Then
  assert.equal(result.status, 0)
  assert.equal(result.signal, null)
  assert.equal(result.stderr, "")
  assert.equal(
    parseCsv(result.stdout.slice(result.stdout.indexOf("url,"))).length,
    4
  )
})

test("Given malformed SEO content input When the documented wrapper runs Then it exits non-zero with the parser error", () => {
  // Given
  const directory = mkdtempSync(join(tmpdir(), "nabaperks-content-cli-"))
  const fixture = join(directory, "malformed.csv")
  writeFileSync(
    fixture,
    "url,pageviews,conversions,backlinks,internal_links,target_intent,preferred_url\n/menu,invalid,0,0,0,menu,\n"
  )

  try {
    // When
    const result = runContentAudit(fixture)

    // Then
    assert.equal(result.status, 1)
    assert.equal(result.signal, null)
    assert.match(result.stdout, /ELIFECYCLE/)
    assert.match(result.stderr, /Row 2 has an invalid pageviews value/)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test("Given an injection-like missing content path When the documented wrapper runs Then it treats it as one literal failed input", () => {
  // Given
  const directory = mkdtempSync(join(tmpdir(), "nabaperks-content-cli-"))
  const sentinel = join(directory, "sentinel")
  const inputPath = `${join(directory, "missing")};touch ${sentinel}`

  try {
    // When
    const result = runContentAudit(inputPath)

    // Then
    assert.equal(result.status, 1)
    assert.equal(result.signal, null)
    assert.match(result.stdout, /ELIFECYCLE/)
    assert.match(result.stderr, /ENOENT/)
    assert.equal(existsSync(sentinel), false)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
