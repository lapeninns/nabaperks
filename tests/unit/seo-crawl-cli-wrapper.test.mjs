import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"

function runCrawlAudit(inputPath) {
  return spawnSync("pnpm", ["seo:crawl-audit", "--", inputPath], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 10_000,
  })
}

test("Given the documented pnpm delimiter When the crawl audit runs Then it emits findings for the requested fixture", () => {
  // Given
  const fixture = "tests/fixtures/seo-crawl-logs.csv"

  // When
  const result = runCrawlAudit(fixture)

  // Then
  assert.equal(result.status, 0)
  assert.equal(result.signal, null)
  assert.equal(result.stderr, "")
  assert.equal(
    JSON.parse(result.stdout.slice(result.stdout.indexOf("{"))).bot_requests,
    5
  )
})

test("Given malformed crawl CSV input When the documented wrapper runs Then it exits non-zero with the parser error", () => {
  // Given
  const directory = mkdtempSync(join(tmpdir(), "nabaperks-crawl-cli-"))
  const fixture = join(directory, "malformed.csv")
  writeFileSync(
    fixture,
    "timestamp,path,status,user_agent\n2026-01-01T00:00:00Z,/menu,not-a-status,Googlebot\n"
  )

  try {
    // When
    const result = runCrawlAudit(fixture)

    // Then
    assert.equal(result.status, 1)
    assert.equal(result.signal, null)
    assert.match(result.stdout, /ELIFECYCLE/)
    assert.match(result.stderr, /Row 2 has an invalid status/)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test("Given an injection-like missing crawl path When the documented wrapper runs Then it treats it as one literal failed input", () => {
  // Given
  const directory = mkdtempSync(join(tmpdir(), "nabaperks-crawl-cli-"))
  const sentinel = join(directory, "sentinel")
  const inputPath = `${join(directory, "missing")};touch ${sentinel}`

  try {
    // When
    const result = runCrawlAudit(inputPath)

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
